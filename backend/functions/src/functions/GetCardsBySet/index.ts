import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { ApiResponse, Card, PaginatedResponse } from "@pcpc/shared";
import {
  cosmosDbService,
  monitoringService,
  redisCacheService,
  scrydexApiService,
} from "../../index";
import {
  formatCacheEntry,
  getCacheAge,
  getCardsForSetCacheKey,
  parseCacheEntry,
} from "../../utils/cacheUtils";
import {
  createBadRequestError,
  createNotFoundError,
  handleError,
} from "../../utils/errorUtils";
import {
  cardHasPricing,
  mapScrydexCardToCard,
} from "../../utils/scrydexToCosmos";

function cardsHavePricingData(cards: Card[]): boolean {
  if (cards.length === 0) return false;
  const withPricing = cards.filter(cardHasPricing).length;
  return withPricing > cards.length * 0.1;
}

export async function getCardsBySet(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const setIdParam = request.params.setId;
  const correlationId = monitoringService.createCorrelationId();
  const startTime = Date.now();

  monitoringService.trackEvent("function.invoked", {
    functionName: "GetCardsBySet",
    setId: setIdParam || "unknown",
    correlationId,
  });

  try {
    if (!setIdParam) {
      context.log(`${correlationId} ERROR: Missing set ID in request`);
      const errorResponse = createBadRequestError(
        "Set ID is required",
        "GetCardsBySet"
      );
      return { jsonBody: errorResponse, status: errorResponse.status };
    }

    const setId = setIdParam.trim();
    if (setId.length === 0) {
      const errorResponse = createBadRequestError(
        "Set ID is required",
        "GetCardsBySet"
      );
      return { jsonBody: errorResponse, status: errorResponse.status };
    }

    context.log(`${correlationId} Processing Scrydex request for setId: ${setId}`);

    const forceRefresh = request.query.get("forceRefresh") === "true";
    const page = parseInt(request.query.get("page") || "1");
    const pageSize = Math.min(
      parseInt(request.query.get("pageSize") || "500"),
      500
    );
    const cardsTtl = parseInt(process.env.CACHE_TTL_CARDS || "86400");

    if (page < 1 || pageSize < 1) {
      const errorResponse = createBadRequestError(
        "Invalid pagination parameters. Page and pageSize must be >= 1.",
        "GetCardsBySet"
      );
      return { jsonBody: errorResponse, status: errorResponse.status };
    }

    context.log(
      `${correlationId} Parameters - setId: ${setId}, page: ${page}, pageSize: ${pageSize}, forceRefresh: ${forceRefresh}`
    );

    monitoringService.trackEvent("request.parameters", {
      setId,
      page,
      pageSize,
      forceRefresh,
      correlationId,
    });

    const cacheKey = `${getCardsForSetCacheKey(`scrydex-${setId}`)}-page-${page}-size-${pageSize}`;
    let cards: Card[] | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
      context.log(`${correlationId} Checking Redis cache for key: ${cacheKey}`);
      const cacheStartTime = Date.now();
      const cachedEntry = await redisCacheService.get<{
        data: Card[];
        timestamp: number;
        ttl: number;
      }>(cacheKey);
      cards = parseCacheEntry<Card[]>(cachedEntry);
      const cacheTime = Date.now() - cacheStartTime;

      if (cards) {
        context.log(
          `${correlationId} Cache HIT for set ${setId} (${cacheTime}ms) - ${cards.length} cards`
        );
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;
        monitoringService.trackEvent("cache.hit", {
          setId,
          cardCount: cards.length,
          correlationId,
        });
      } else {
        context.log(
          `${correlationId} Cache MISS for set ${setId} (${cacheTime}ms)`
        );
        monitoringService.trackEvent("cache.miss", { setId, correlationId });
      }
      monitoringService.trackMetric("cache.check.duration", cacheTime);
    }

    // Cosmos lookup. Optionally fetch expected total from Scrydex to detect stale partial data.
    let expectedTotal = 0;
    if (!cards) {
      try {
        const expansion = await scrydexApiService.getExpansion(setId);
        if (expansion) {
          expectedTotal = expansion.total || 0;
          context.log(
            `${correlationId} Set ${setId} expected total: ${expectedTotal}`
          );
        }
      } catch (err: any) {
        context.log(
          `${correlationId} Could not fetch set metadata for ${setId}: ${err.message} (non-fatal)`
        );
      }
    }

    if (!cards) {
      context.log(`${correlationId} Checking Cosmos DB for set: ${setId}`);
      const dbStartTime = Date.now();
      const dbCards = await cosmosDbService.getCardsBySetId(setId);
      const dbTime = Date.now() - dbStartTime;

      if (dbCards && dbCards.length > 0) {
        // Staleness check: count mismatch
        if (expectedTotal > 0 && dbCards.length < expectedTotal) {
          context.log(
            `${correlationId} Cosmos DB has stale data: ${dbCards.length} cards vs ${expectedTotal} expected. Falling through to Scrydex.`
          );
          monitoringService.trackEvent("cosmos.stale", {
            setId,
            cosmosCount: dbCards.length,
            expectedTotal,
            reason: "count_mismatch",
            correlationId,
          });
        }
        // Staleness check: pricing absent
        else if (!cardsHavePricingData(dbCards)) {
          const withPricing = dbCards.filter(cardHasPricing).length;
          context.log(
            `${correlationId} Cosmos DB cards lack pricing: ${withPricing}/${dbCards.length} have pricing. Falling through to Scrydex.`
          );
          monitoringService.trackEvent("cosmos.stale", {
            setId,
            cosmosCount: dbCards.length,
            cardsWithPricing: withPricing,
            reason: "no_pricing",
            correlationId,
          });
        } else {
          cards = dbCards;
          monitoringService.trackEvent("database.hit", {
            setId,
            cardCount: dbCards.length,
            correlationId,
          });
          context.log(
            `${correlationId} Database HIT for set ${setId} (${dbTime}ms) - ${cards.length} cards`
          );
        }
      } else {
        monitoringService.trackEvent("database.miss", { setId, correlationId });
        context.log(`${correlationId} Database MISS for set ${setId} (${dbTime}ms)`);
      }
      monitoringService.trackMetric("cosmosdb.query.duration", dbTime);
    }

    // Fetch from Scrydex
    if (!cards || cards.length === 0) {
      context.log(
        `${correlationId} Fetching cards from Scrydex API for set: ${setId}`
      );
      const apiStartTime = Date.now();

      try {
        const scrydexCards = await scrydexApiService.getAllCardsInExpansion(setId);
        const apiTime = Date.now() - apiStartTime;

        if (!scrydexCards || scrydexCards.length === 0) {
          context.log(
            `${correlationId} No cards found in Scrydex for set ${setId} (${apiTime}ms)`
          );
          const errorResponse = createNotFoundError(
            "Cards for set",
            setId,
            "GetCardsBySet"
          );
          return { jsonBody: errorResponse, status: errorResponse.status };
        }

        context.log(
          `${correlationId} Scrydex returned ${scrydexCards.length} cards (${apiTime}ms)`
        );

        monitoringService.trackEvent("api.fetch.success", {
          setId,
          cardCount: scrydexCards.length,
          correlationId,
        });
        monitoringService.trackMetric("api.scrydex.duration", apiTime);
        monitoringService.trackDependency(
          "Scrydex API",
          "HTTP",
          `getAllCardsInExpansion(${setId})`,
          apiTime,
          true
        );

        const now = new Date().toISOString();
        cards = scrydexCards.map((card) => mapScrydexCardToCard(card, now));

        const saveStartTime = Date.now();
        await cosmosDbService.saveCards(cards);
        const saveTime = Date.now() - saveStartTime;
        context.log(
          `${correlationId} Batch saved ${cards.length} cards to Cosmos (${saveTime}ms)`
        );
        monitoringService.trackMetric("batch.save.duration", saveTime);

        if (process.env.ENABLE_REDIS_CACHE === "true") {
          await redisCacheService.set(
            cacheKey,
            formatCacheEntry(cards, cardsTtl),
            cardsTtl
          );
          context.log(
            `${correlationId} Cached ${cards.length} cards to Redis`
          );
        }
      } catch (error: any) {
        context.log(`${correlationId} ERROR: Scrydex API failed: ${error.message}`);
        monitoringService.trackException(error, {
          functionName: "GetCardsBySet",
          operation: "Scrydex API",
          setId,
          correlationId,
        });
        const errorResponse = handleError(error, "GetCardsBySet - Scrydex API");
        return { jsonBody: errorResponse, status: errorResponse.status };
      }
    }

    const totalCount = cards.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);
    const paginatedCards = cards.slice(startIndex, endIndex);

    context.log(
      `${correlationId} Pagination - Total: ${totalCount}, Page: ${page}/${totalPages}, Returning: ${paginatedCards.length}`
    );

    const totalTime = Date.now() - startTime;
    const pricingIncluded = cards.some((c) => cardHasPricing(c));

    const paginatedResponse: PaginatedResponse<Card> = {
      items: paginatedCards,
      totalCount,
      pageSize,
      pageNumber: page,
      totalPages,
    };

    const response: ApiResponse<PaginatedResponse<Card>> = {
      status: 200,
      data: paginatedResponse,
      timestamp: new Date().toISOString(),
      cached: cacheHit,
      cacheAge: cacheHit ? cacheAge : undefined,
    };

    monitoringService.trackEvent("function.success", {
      functionName: "GetCardsBySet",
      setId,
      totalCards: totalCount,
      cached: cacheHit,
      pricingIncluded,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    return {
      jsonBody: response,
      status: response.status,
      headers: { "Cache-Control": `public, max-age=${cardsTtl}` },
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    context.log(
      `${correlationId} ERROR after ${totalTime}ms: ${error.message}`
    );
    monitoringService.trackException(error, {
      functionName: "GetCardsBySet",
      setId: setIdParam || "unknown",
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackEvent("function.error", {
      functionName: "GetCardsBySet",
      error: error.message,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    const errorResponse = handleError(error, "GetCardsBySet");
    return { jsonBody: errorResponse, status: errorResponse.status };
  }
}
