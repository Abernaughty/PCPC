import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  cosmosDbService,
  monitoringService,
  pokeDataApiService,
  pokemonTcgApiService,
  redisCacheService,
  pokeDataToTcgMappingService,
} from "../../index";
import { ApiResponse } from "../../models/ApiResponse";
import { ImageEnhancementService } from "../../services/ImageEnhancementService";
import {
  formatCacheEntry,
  getCacheAge,
  getCardCacheKey,
  parseCacheEntry,
} from "../../utils/cacheUtils";
import {
  createBadRequestError,
  createNotFoundError,
  handleError,
} from "../../utils/errorUtils";

// Initialize services for image enhancement
const imageEnhancementService = new ImageEnhancementService(
  pokeDataToTcgMappingService,
  pokemonTcgApiService
);

// Enhanced card structure for PokeData-first approach
interface PokeDataFirstCard {
  id: string;
  source: "pokedata";
  pokeDataId: number;
  setId: number;
  setName: string;
  setCode: string;
  cardName: string;
  cardNumber: string;
  secret: boolean;
  language: string;
  releaseDate: string;
  pricing: {
    psa?: { [grade: string]: number };
    cgc?: { [grade: string]: number };
    tcgPlayer?: number;
    ebayRaw?: number;
    pokeDataRaw?: number;
  };
  images?: {
    small: string;
    large: string;
  };
  enhancement?: {
    tcgSetId: string;
    tcgCardId: string;
    metadata?: {
      hp?: string;
      types?: string[];
      rarity?: string;
    };
    enhancedAt: string;
  };
  lastUpdated: string;
}

/**
 * Helper function to create base card structure from PokeData API
 */
async function createBaseCard(
  cardIdNum: number,
  setId: number,
  correlationId: string,
  context: InvocationContext
): Promise<PokeDataFirstCard> {
  context.log(
    `${correlationId} Creating base card structure from PokeData API for ID: ${cardIdNum}`
  );

  // Get basic card info from PokeData API
  const apiStartTime = Date.now();
  const fullCardData = await pokeDataApiService.getFullCardDetailsById(
    cardIdNum
  );
  const apiTime = Date.now() - apiStartTime;

  if (!fullCardData) {
    throw new Error(`No card data found in PokeData for card ID: ${cardIdNum}`);
  }

  context.log(
    `${correlationId} PokeData card data retrieved (${apiTime}ms): ${fullCardData.name} #${fullCardData.num}`
  );

  // Create base card structure (without pricing and images - will be added separately)
  const baseCard: PokeDataFirstCard = {
    id: String(cardIdNum),
    source: "pokedata",
    pokeDataId: cardIdNum,
    setId: fullCardData.set_id,
    setName: fullCardData.set_name,
    setCode: fullCardData.set_code || "",
    cardName: fullCardData.name,
    cardNumber: fullCardData.num,
    secret: fullCardData.secret || false,
    language: fullCardData.language || "ENGLISH",
    releaseDate: fullCardData.release_date || "",
    pricing: {}, // Will be populated separately with fresh data
    lastUpdated: new Date().toISOString(),
  };

  return baseCard;
}

/**
 * Helper function to enhance card with image URLs
 */
async function enhanceCardWithImages(
  card: PokeDataFirstCard,
  correlationId: string,
  context: InvocationContext
): Promise<PokeDataFirstCard> {
  context.log(`${correlationId} Enhancing card with image URLs`);

  try {
    const enhancementStartTime = Date.now();

    const enhancedCard =
      await imageEnhancementService.enhancePricingCardWithImages({
        id: card.pokeDataId,
        language: card.language,
        name: card.cardName,
        num: card.cardNumber,
        release_date: card.releaseDate,
        secret: card.secret,
        set_code: card.setCode,
        set_id: card.setId,
        set_name: card.setName,
        pricing: {}, // Not used in enhancement
      });

    const enhancementTime = Date.now() - enhancementStartTime;

    // Add images and enhancement data if available
    if (enhancedCard.images) {
      const smallImage =
        enhancedCard.images.small || enhancedCard.images.large || "";
      const largeImage =
        enhancedCard.images.large || enhancedCard.images.small || "";

      if (smallImage && largeImage) {
        card.images = {
          small: smallImage,
          large: largeImage,
        };
        if (enhancedCard.enhancement) {
          card.enhancement = {
            tcgSetId: enhancedCard.enhancement.tcgSetId,
            tcgCardId: enhancedCard.enhancement.tcgCardId,
            metadata: enhancedCard.enhancement.metadata,
            enhancedAt: new Date().toISOString(),
          };
        }
        context.log(
          `${correlationId} Image enhancement successful (${enhancementTime}ms)`
        );
        if (card.enhancement) {
          context.log(
            `${correlationId} Enhanced with TCG card: ${card.enhancement.tcgCardId}`
          );
        }
      } else {
        context.log(
          `${correlationId} Image enhancement failed - no valid images returned (${enhancementTime}ms)`
        );
      }
    } else {
      context.log(
        `${correlationId} Image enhancement skipped - no mapping available (${enhancementTime}ms)`
      );
    }
  } catch (error: any) {
    context.log(
      `${correlationId} Image enhancement failed (non-critical): ${error.message}`
    );
    // Continue without images - card creation should still succeed
  }

  return card;
}

/**
 * Helper function to fetch fresh pricing data from PokeData API
 */
async function fetchFreshPricing(
  cardIdNum: number,
  correlationId: string,
  context: InvocationContext
): Promise<any> {
  context.log(`${correlationId} Fetching fresh pricing data from PokeData API`);

  const apiStartTime = Date.now();
  const fullCardData = await pokeDataApiService.getFullCardDetailsById(
    cardIdNum
  );
  const apiTime = Date.now() - apiStartTime;

  if (!fullCardData || !fullCardData.pricing) {
    context.log(
      `${correlationId} No pricing data available from PokeData API (${apiTime}ms)`
    );
    return {};
  }

  context.log(
    `${correlationId} PokeData pricing data retrieved (${apiTime}ms)`
  );

  // Transform pricing data to our format
  const transformedPricing: any = {};

  // Process PSA grades
  const psaGrades: { [grade: string]: number } = {};
  for (let i = 1; i <= 10; i++) {
    const grade = i === 10 ? "10.0" : `${i}.0`;
    const key = `PSA ${grade}`;
    if (fullCardData.pricing[key] && fullCardData.pricing[key].value > 0) {
      psaGrades[String(i)] = fullCardData.pricing[key].value;
    }
  }
  if (Object.keys(psaGrades).length > 0) {
    transformedPricing.psa = psaGrades;
  }

  // Process CGC grades
  const cgcGrades: { [grade: string]: number } = {};
  const cgcGradeValues = [
    "1.0",
    "2.0",
    "3.0",
    "4.0",
    "5.0",
    "6.0",
    "7.0",
    "7.5",
    "8.0",
    "8.5",
    "9.0",
    "9.5",
    "10.0",
  ];
  cgcGradeValues.forEach((grade) => {
    const key = `CGC ${grade}`;
    if (fullCardData.pricing[key] && fullCardData.pricing[key].value > 0) {
      const gradeKey = grade.replace(".", "_");
      cgcGrades[gradeKey] = fullCardData.pricing[key].value;
    }
  });
  if (Object.keys(cgcGrades).length > 0) {
    transformedPricing.cgc = cgcGrades;
  }

  // Process other pricing sources
  if (
    fullCardData.pricing["TCGPlayer"] &&
    fullCardData.pricing["TCGPlayer"].value > 0
  ) {
    transformedPricing.tcgPlayer = fullCardData.pricing["TCGPlayer"].value;
  }
  if (
    fullCardData.pricing["eBay Raw"] &&
    fullCardData.pricing["eBay Raw"].value > 0
  ) {
    transformedPricing.ebayRaw = fullCardData.pricing["eBay Raw"].value;
  }
  if (
    fullCardData.pricing["Pokedata Raw"] &&
    fullCardData.pricing["Pokedata Raw"].value > 0
  ) {
    transformedPricing.pokeDataRaw = fullCardData.pricing["Pokedata Raw"].value;
  }

  const pricingSourceCount = Object.keys(transformedPricing).length;
  context.log(
    `${correlationId} Pricing transformed - ${pricingSourceCount} sources available`
  );

  return transformedPricing;
}

/**
 * GetCardInfo Function - Always-Fresh Pricing with Image Enhancement
 *
 * FLOW:
 * 1. Validate Parameters
 * 2. Check Redis Cache (if enabled and not force refresh) → Return if hit
 * 3. Check Cosmos DB for card metadata
 * 4. If not in DB OR missing images:
 *    - Create base card structure (if needed)
 *    - Generate image URLs with ImageEnhancementService
 *    - Save enhanced card to DB
 * 5. Fetch fresh pricing from PokeData API (ALWAYS)
 * 6. Combine metadata + fresh pricing
 * 7. Cache complete result
 * 8. Return complete card
 */
export async function getCardInfo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const timestamp = Date.now();
  const correlationId = monitoringService.createCorrelationId();
  const startTime = Date.now();

  // Track function invocation
  monitoringService.trackEvent("function.invoked", {
    functionName: "GetCardInfo",
    cardId: request.params.cardId || "unknown",
    setId: request.params.setId || "unknown",
    correlationId,
  });

  try {
    // STEP 1: Validate Parameters
    const pokeDataCardId = request.params.cardId;
    const setIdParam = request.params.setId;

    if (!pokeDataCardId) {
      context.log(
        `${correlationId} ERROR: Missing PokeData card ID in request`
      );
      const errorResponse = createNotFoundError(
        "PokeData Card ID",
        "missing",
        "GetCardInfo"
      );
      return {
        jsonBody: errorResponse,
        status: errorResponse.status,
      };
    }

    if (!setIdParam) {
      context.log(`${correlationId} ERROR: Missing setId path parameter`);
      const errorResponse = createNotFoundError(
        "Set ID",
        "missing",
        "GetCardInfo"
      );
      return {
        jsonBody: errorResponse,
        status: errorResponse.status,
      };
    }

    // Validate setId is numeric
    const setId = parseInt(setIdParam);
    if (isNaN(setId)) {
      context.log(
        `${correlationId} ERROR: Invalid setId path parameter format: ${setIdParam}`
      );
      const errorResponse = createBadRequestError(
        `Invalid setId format in path. Expected numeric ID, got: ${setIdParam}`,
        "GetCardInfo"
      );
      return {
        jsonBody: errorResponse,
        status: errorResponse.status,
      };
    }

    // Validate that it's a numeric PokeData ID
    const cardIdNum = parseInt(pokeDataCardId);
    if (isNaN(cardIdNum)) {
      context.log(
        `${correlationId} ERROR: Invalid PokeData card ID format: ${pokeDataCardId}`
      );
      const errorResponse = createBadRequestError(
        `Invalid PokeData card ID format. Expected numeric ID, got: ${pokeDataCardId}`,
        "GetCardInfo"
      );
      return {
        jsonBody: errorResponse,
        status: errorResponse.status,
      };
    }

    context.log(
      `${correlationId} Processing request for card ID: ${pokeDataCardId}, setId: ${setId}`
    );

    // Parse query parameters
    const forceRefresh = request.query.get("forceRefresh") === "true";
    const cardsTtl = parseInt(process.env.CACHE_TTL_CARDS || "3600"); // 1 hour default

    context.log(
      `${correlationId} Request parameters - forceRefresh: ${forceRefresh}, TTL: ${cardsTtl}`
    );

    // Track request parameters
    monitoringService.trackEvent("request.parameters", {
      cardId: pokeDataCardId,
      setId: String(setId),
      forceRefresh,
      correlationId,
    });

    // STEP 2: Check Redis Cache (if enabled and not force refresh)
    const cacheKey = getCardCacheKey(pokeDataCardId);
    let completeCard: PokeDataFirstCard | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheStartTime = Date.now();
      context.log(`${correlationId} Checking Redis cache: ${cacheKey}`);
      const cachedEntry = await redisCacheService.get<{
        data: PokeDataFirstCard;
        timestamp: number;
        ttl: number;
      }>(cacheKey);
      completeCard = parseCacheEntry<PokeDataFirstCard>(cachedEntry);

      const cacheTime = Date.now() - cacheStartTime;

      if (completeCard) {
        context.log(`${correlationId} Cache HIT (${cacheTime}ms)`);
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;

        // Track cache hit
        monitoringService.trackEvent("cache.hit", {
          cardId: pokeDataCardId,
          correlationId,
        });
        monitoringService.trackMetric("cache.check.duration", cacheTime);

        // Return cached complete card immediately
        const response: ApiResponse<PokeDataFirstCard> = {
          status: 200,
          data: completeCard,
          timestamp: new Date().toISOString(),
          cached: true,
          cacheAge: cacheAge,
        };

        const totalTime = Date.now() - startTime;
        context.log(
          `${correlationId} Returning cached card - Total time: ${totalTime}ms`
        );

        // Track successful cache return
        monitoringService.trackEvent("function.success", {
          functionName: "GetCardInfo",
          cardId: pokeDataCardId,
          cached: true,
          duration: totalTime,
          correlationId,
        });
        monitoringService.trackMetric("function.duration", totalTime);

        return {
          jsonBody: response,
          status: response.status,
          headers: { "Cache-Control": `public, max-age=${cardsTtl}` },
        };
      } else {
        context.log(`${correlationId} Cache MISS (${cacheTime}ms)`);

        // Track cache miss
        monitoringService.trackEvent("cache.miss", {
          cardId: pokeDataCardId,
          correlationId,
        });
        monitoringService.trackMetric("cache.check.duration", cacheTime);
      }
    } else {
      context.log(
        `${correlationId} Skipping cache - forceRefresh: ${forceRefresh}, Redis enabled: ${process.env.ENABLE_REDIS_CACHE}`
      );
    }

    // STEP 3: Check Cosmos DB for card metadata
    let cardMetadata: PokeDataFirstCard | null = null;
    const dbStartTime = Date.now();

    context.log(`${correlationId} Checking Cosmos DB for card metadata`);
    const dbCard = await cosmosDbService.getCard(pokeDataCardId, setId);
    const dbTime = Date.now() - dbStartTime;

    if (dbCard) {
      cardMetadata = dbCard as unknown as PokeDataFirstCard;
      context.log(
        `${correlationId} Database HIT (${dbTime}ms) - images: ${!!cardMetadata.images}`
      );

      // Track database hit
      monitoringService.trackEvent("database.hit", {
        cardId: pokeDataCardId,
        hasImages: !!cardMetadata.images,
        correlationId,
      });
      monitoringService.trackMetric("cosmosdb.query.duration", dbTime);
      monitoringService.trackDependency(
        "Cosmos DB",
        "Query",
        `getCard(${pokeDataCardId})`,
        dbTime,
        true
      );
    } else {
      context.log(`${correlationId} Database MISS (${dbTime}ms)`);

      // Track database miss
      monitoringService.trackEvent("database.miss", {
        cardId: pokeDataCardId,
        correlationId,
      });
      monitoringService.trackMetric("cosmosdb.query.duration", dbTime);
      monitoringService.trackDependency(
        "Cosmos DB",
        "Query",
        `getCard(${pokeDataCardId})`,
        dbTime,
        false
      );
    }

    // STEP 4: If not in DB OR missing images, create/enhance card
    if (!cardMetadata || !cardMetadata.images) {
      if (!cardMetadata) {
        context.log(`${correlationId} Creating new card`);

        // Track card creation
        const createStartTime = Date.now();
        cardMetadata = await createBaseCard(
          cardIdNum,
          setId,
          correlationId,
          context
        );
        const createTime = Date.now() - createStartTime;

        monitoringService.trackEvent("card.created", {
          cardId: pokeDataCardId,
          correlationId,
        });
        monitoringService.trackMetric("card.creation.duration", createTime);
      } else {
        context.log(`${correlationId} Card exists but missing images`);
      }

      // Generate image URLs with enhancement tracking
      const enhanceStartTime = Date.now();
      cardMetadata = await enhanceCardWithImages(
        cardMetadata,
        correlationId,
        context
      );
      const enhanceTime = Date.now() - enhanceStartTime;

      // Track image enhancement success/failure
      if (cardMetadata.images) {
        monitoringService.trackEvent("image.enhancement.success", {
          cardId: pokeDataCardId,
          hasEnhancement: !!cardMetadata.enhancement,
          tcgCardId: cardMetadata.enhancement?.tcgCardId || "none",
          correlationId,
        });
        monitoringService.trackMetric(
          "image.enhancement.duration",
          enhanceTime
        );
      } else {
        monitoringService.trackEvent("image.enhancement.failed", {
          cardId: pokeDataCardId,
          reason: "No images returned",
          correlationId,
        });
        monitoringService.trackMetric(
          "image.enhancement.duration",
          enhanceTime
        );
      }

      // Save card with images to DB
      const saveStartTime = Date.now();
      await cosmosDbService.saveCard(cardMetadata as any);
      const saveTime = Date.now() - saveStartTime;
      context.log(`${correlationId} Card saved to Cosmos DB (${saveTime}ms)`);

      monitoringService.trackMetric("card.save.duration", saveTime);
      monitoringService.trackDependency(
        "Cosmos DB",
        "Save",
        `saveCard(${pokeDataCardId})`,
        saveTime,
        true
      );
    }

    // STEP 5: Fetch fresh pricing from PokeData API (ALWAYS)
    let freshPricing: any = {};
    const pricingStartTime = Date.now();
    try {
      freshPricing = await fetchFreshPricing(cardIdNum, correlationId, context);
      const pricingTime = Date.now() - pricingStartTime;

      // Track pricing fetch success
      const pricingSourceCount = Object.keys(freshPricing).length;
      monitoringService.trackEvent("pricing.fetch.success", {
        cardId: pokeDataCardId,
        sourcesAvailable: pricingSourceCount,
        hasPSA: !!freshPricing.psa,
        hasCGC: !!freshPricing.cgc,
        hasTCGPlayer: !!freshPricing.tcgPlayer,
        correlationId,
      });
      monitoringService.trackMetric("pricing.fetch.duration", pricingTime);
      monitoringService.trackMetric(
        "pricing.sources.count",
        pricingSourceCount
      );
      monitoringService.trackDependency(
        "PokeData API",
        "HTTP",
        `getFullCardDetailsById(${cardIdNum})`,
        pricingTime,
        true
      );
    } catch (error: any) {
      const pricingTime = Date.now() - pricingStartTime;
      context.log(
        `${correlationId} WARNING: Failed to fetch pricing (non-critical): ${error.message}`
      );

      // Track pricing fetch failure
      monitoringService.trackEvent("pricing.fetch.failed", {
        cardId: pokeDataCardId,
        error: error.message,
        correlationId,
      });
      monitoringService.trackMetric("pricing.fetch.duration", pricingTime);
      monitoringService.trackDependency(
        "PokeData API",
        "HTTP",
        `getFullCardDetailsById(${cardIdNum})`,
        pricingTime,
        false
      );

      // Continue with empty pricing rather than failing
    }

    // STEP 6: Combine metadata + fresh pricing
    completeCard = {
      ...cardMetadata,
      pricing: freshPricing,
      lastUpdated: new Date().toISOString(),
    };

    // Calculate data completeness score
    let completenessScore = 0;
    const hasPricing = freshPricing && Object.keys(freshPricing).length > 0;
    const hasImages = !!completeCard.images;
    const hasEnhancement = !!completeCard.enhancement;

    if (hasPricing) completenessScore += 40;
    if (hasImages) completenessScore += 30;
    if (hasEnhancement) completenessScore += 30;

    // Track data completeness
    monitoringService.trackMetric(
      "card.data_completeness_score",
      completenessScore
    );
    monitoringService.trackMetric("card.has_pricing", hasPricing ? 1 : 0);
    monitoringService.trackMetric("card.has_images", hasImages ? 1 : 0);
    monitoringService.trackMetric(
      "card.has_enhancement",
      hasEnhancement ? 1 : 0
    );

    if (completenessScore < 100) {
      monitoringService.trackEvent("card.incomplete_data", {
        cardId: pokeDataCardId,
        score: completenessScore,
        hasPricing,
        hasImages,
        hasEnhancement,
        correlationId,
      });
    } else {
      monitoringService.trackEvent("card.data_complete", {
        cardId: pokeDataCardId,
        correlationId,
      });
    }

    // STEP 7: Cache complete result
    if (process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheWriteStartTime = Date.now();
      await redisCacheService.set(
        cacheKey,
        formatCacheEntry(completeCard, cardsTtl),
        cardsTtl
      );
      const cacheWriteTime = Date.now() - cacheWriteStartTime;
      context.log(
        `${correlationId} Complete card cached (${cacheWriteTime}ms)`
      );
    }

    // STEP 8: Return complete card
    const response: ApiResponse<PokeDataFirstCard> = {
      status: 200,
      data: completeCard,
      timestamp: new Date().toISOString(),
      cached: false,
      cacheAge: undefined,
    };

    const totalTime = Date.now() - startTime;
    const pricingSourceCount = Object.keys(completeCard.pricing).length;
    context.log(
      `${correlationId} Request complete - Total time: ${totalTime}ms, pricing sources: ${pricingSourceCount}, images: ${!!completeCard.images}`
    );

    // Track successful completion
    monitoringService.trackEvent("function.success", {
      functionName: "GetCardInfo",
      cardId: pokeDataCardId,
      pricingSources: pricingSourceCount,
      hasImages: !!completeCard.images,
      hasEnhancement: !!completeCard.enhancement,
      cached: false,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    return {
      jsonBody: response,
      status: response.status,
      headers: {
        "Cache-Control": `public, max-age=${cardsTtl}`,
      },
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    context.log(
      `${correlationId} ERROR after ${totalTime}ms: ${error.message}`
    );

    // Track error
    monitoringService.trackException(error, {
      functionName: "GetCardInfo",
      cardId: request.params.cardId || "unknown",
      setId: request.params.setId || "unknown",
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackEvent("function.error", {
      functionName: "GetCardInfo",
      error: error.message,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    const errorResponse = handleError(error, "GetCardInfo");
    return {
      jsonBody: errorResponse,
      status: errorResponse.status,
    };
  }
}
