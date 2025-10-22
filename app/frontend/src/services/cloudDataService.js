import { API_CONFIG } from "../data/cloudApiConfig";
import { apiLogger } from "./loggerService";
import { monitoringService } from "./monitoringService";

/**
 * Service for Pokémon data operations using cloud-based Azure Functions
 */
export const cloudDataService = {
  /**
   * Get the list of all Pokémon card sets
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @param {boolean} groupByExpansion - Whether to group sets by expansion series
   * @returns {Promise<Array|Object>} Array of set objects or grouped sets object
   */
  async getSetList(forceRefresh = true, groupByExpansion = true) {
    const timer = monitoringService.startTimer();

    try {
      // Track API call start
      monitoringService.trackEvent("api.getSetList.started", {
        forceRefresh,
        groupByExpansion,
      });

      apiLogger.info("Getting set list from cloud API", {
        forceRefresh,
        groupByExpansion,
      });

      const url = new URL(API_CONFIG.buildSetsUrl());

      // Add query parameters
      if (forceRefresh) {
        url.searchParams.append("forceRefresh", "true");
      }

      if (groupByExpansion) {
        url.searchParams.append("groupByExpansion", "true");
      }

      // Request all sets (English + Japanese) instead of just English
      url.searchParams.append("language", "ALL");

      // Request all sets without pagination
      url.searchParams.append("all", "true");

      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders(),
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");

        // Track API error
        monitoringService.trackEvent("api.getSetList.error", {
          status: response.status,
          statusText: response.statusText,
          duration,
        });

        monitoringService.trackMetric("api.getSetList.duration", duration, {
          success: false,
          status: response.status,
        });

        apiLogger.error("Cloud API error for sets", {
          status: response.status,
          error: errorText,
        });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const apiResponse = await response.json();
      const fromCache = apiResponse.cached || false;

      // Track cache hit/miss
      monitoringService.trackEvent(
        fromCache ? "api.getSetList.cache.hit" : "api.getSetList.cache.miss",
        { duration }
      );

      apiLogger.debug("API response for sets", {
        status: response.status,
        cached: fromCache,
      });

      // Handle PokeData-first response structure
      let setsArray = [];

      if (apiResponse && apiResponse.data) {
        // PokeData-first response structure: { data: { sets: [...] } }
        if (apiResponse.data.sets && Array.isArray(apiResponse.data.sets)) {
          setsArray = apiResponse.data.sets;
        } else if (Array.isArray(apiResponse.data)) {
          // Direct array in data wrapper
          setsArray = apiResponse.data;
        }
      } else if (apiResponse && Array.isArray(apiResponse)) {
        // Direct array response (fallback)
        setsArray = apiResponse;
      } else {
        apiLogger.warn("Unexpected API response format", {
          responseType: typeof apiResponse,
          hasData: !!apiResponse,
        });

        monitoringService.trackEvent("api.getSetList.unexpected_format", {
          responseType: typeof apiResponse,
        });

        return [];
      }

      // Transform PokeData sets to frontend format
      setsArray = setsArray.map((set) => ({
        id: set.setId || set.id,
        name: set.setName || set.name,
        code: set.setCode || set.code,
        // Keep original PokeData properties for backend compatibility
        setId: set.setId,
        setName: set.setName,
        setCode: set.setCode,
        language: set.language,
        releaseYear: set.releaseYear,
        isRecent: set.isRecent,
      }));

      // Check if the response contains grouped sets (objects with type: 'group')
      if (
        groupByExpansion &&
        setsArray.length > 0 &&
        setsArray[0].type === "group"
      ) {
        apiLogger.debug(
          "Transforming grouped sets format from backend to frontend"
        );

        // Transform from backend format to frontend format
        const transformedGroups = {};

        setsArray.forEach((group) => {
          if (
            group.type === "group" &&
            group.name &&
            Array.isArray(group.items)
          ) {
            transformedGroups[group.name] = group.items;
            apiLogger.debug("Transformed group", {
              groupName: group.name,
              setCount: group.items.length,
            });
          } else {
            apiLogger.warn("Skipping invalid group in API response", { group });
          }
        });

        const groupCount = Object.keys(transformedGroups).length;

        // Track successful API call with metrics
        monitoringService.trackEvent("api.getSetList.success", {
          duration,
          fromCache,
          grouped: true,
          groupCount,
        });

        monitoringService.trackMetric("api.getSetList.duration", duration, {
          success: true,
          fromCache,
          grouped: true,
        });

        monitoringService.trackMetric("api.getSetList.groupCount", groupCount);

        apiLogger.success(
          "Transformation complete, returning grouped sets object",
          { groupCount }
        );
        return transformedGroups;
      }

      // Track successful API call with metrics
      monitoringService.trackEvent("api.getSetList.success", {
        duration,
        fromCache,
        grouped: false,
        setCount: setsArray.length,
      });

      monitoringService.trackMetric("api.getSetList.duration", duration, {
        success: true,
        fromCache,
        grouped: false,
      });

      monitoringService.trackMetric(
        "api.getSetList.setCount",
        setsArray.length
      );

      apiLogger.success("Returning set list as array", {
        setCount: setsArray.length,
      });
      return setsArray;
    } catch (error) {
      const duration = timer();

      // Track exception
      monitoringService.trackException(error, {
        method: "getSetList",
        forceRefresh,
        groupByExpansion,
        duration,
      });

      apiLogger.error("Error fetching sets from cloud API", { error });
      throw error;
    }
  },

  /**
   * Get cards for a specific set
   * @param {string} setId - The set ID (PokeData-first backend expects numeric setId)
   * @param {Object} options - Additional options
   * @param {boolean} options.forceRefresh - Whether to force a refresh from the API
   * @param {number} options.page - Page number for pagination (used only when fetchAllPages is false)
   * @param {number} options.pageSize - Number of items per page
   * @param {boolean} options.fetchAllPages - Whether to fetch all pages (default: true)
   * @returns {Promise<Object>} Paginated array of card objects or all cards if fetchAllPages=true
   */
  async getCardsForSet(setId, options = {}) {
    const timer = monitoringService.startTimer();

    try {
      if (!setId) {
        apiLogger.error("Set ID is required to fetch cards");

        monitoringService.trackEvent("api.getCardsForSet.validation_error", {
          error: "missing_setId",
        });

        return {
          items: [],
          totalCount: 0,
          pageNumber: 1,
          pageSize: 100,
          totalPages: 0,
        };
      }

      const fetchAllPages = options.fetchAllPages !== false;
      const pageSize = options.pageSize || 500;

      monitoringService.trackEvent("api.getCardsForSet.started", {
        setId,
        fetchAllPages,
        pageSize,
        forceRefresh: options.forceRefresh || false,
      });

      apiLogger.info("Fetching cards for set from cloud API", {
        setId,
        options,
      });

      const initialPage = options.page || 1;

      // If we're not fetching all pages, just get the requested page
      if (!fetchAllPages) {
        const result = await this.fetchCardsPage(
          setId,
          initialPage,
          pageSize,
          options.forceRefresh
        );

        const duration = timer();

        monitoringService.trackEvent("api.getCardsForSet.success", {
          setId,
          duration,
          fetchAllPages: false,
          cardCount: result.items.length,
        });

        monitoringService.trackMetric("api.getCardsForSet.duration", duration, {
          setId,
          fetchAllPages: false,
        });

        return result;
      }

      // If we are fetching all pages, start with page 1
      let allCards = [];
      let currentPage = initialPage;
      let totalPages = 1;
      let totalCount = 0;
      let apiCallCount = 0;

      apiLogger.debug("Fetching all pages for set", { setId, pageSize });

      // Fetch first page to get total pages
      const firstPageResult = await this.fetchCardsPage(
        setId,
        currentPage,
        pageSize,
        options.forceRefresh
      );

      apiCallCount++;

      // Extract pagination info
      totalPages = firstPageResult.totalPages || 1;
      totalCount = firstPageResult.totalCount || 0;

      // Add cards from first page
      allCards = [...allCards, ...firstPageResult.items];

      apiLogger.debug("Retrieved first page", {
        setId,
        currentPage,
        totalPages,
        cardsInPage: firstPageResult.items.length,
        totalCount,
      });

      // Fetch remaining pages if any
      while (currentPage < totalPages) {
        currentPage++;
        apiLogger.debug("Fetching additional page", {
          setId,
          currentPage,
          totalPages,
        });

        const pageResult = await this.fetchCardsPage(
          setId,
          currentPage,
          pageSize,
          options.forceRefresh
        );

        apiCallCount++;

        // Add cards from this page
        allCards = [...allCards, ...pageResult.items];

        apiLogger.debug("Retrieved additional page", {
          setId,
          currentPage,
          totalPages,
          cardsInPage: pageResult.items.length,
          runningTotal: allCards.length,
          totalCount,
        });
      }

      // Return all cards with pagination metadata
      const result = {
        items: allCards,
        totalCount: totalCount,
        pageNumber: 1,
        pageSize: allCards.length,
        totalPages: 1,
      };

      const duration = timer();

      // Track successful multi-page fetch
      monitoringService.trackEvent("api.getCardsForSet.success", {
        setId,
        duration,
        fetchAllPages: true,
        cardCount: allCards.length,
        apiCallCount,
        totalPages,
      });

      monitoringService.trackMetric("api.getCardsForSet.duration", duration, {
        setId,
        fetchAllPages: true,
      });

      monitoringService.trackMetric(
        "api.getCardsForSet.cardCount",
        allCards.length,
        {
          setId,
        }
      );

      monitoringService.trackMetric(
        "api.getCardsForSet.apiCallCount",
        apiCallCount,
        {
          setId,
        }
      );

      apiLogger.success("Successfully retrieved all cards for set", {
        setId,
        totalCards: allCards.length,
      });
      return result;
    } catch (error) {
      const duration = timer();

      monitoringService.trackException(error, {
        method: "getCardsForSet",
        setId,
        duration,
      });

      apiLogger.error("Error fetching cards for set from cloud API", {
        setId,
        error,
      });
      throw error;
    }
  },

  /**
   * Fetch a single page of cards for a set
   * @private
   * @param {string} setId - The set ID
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @param {boolean} forceRefresh - Whether to force refresh from API
   * @returns {Promise<Object>} Paginated card data
   */
  async fetchCardsPage(setId, page, pageSize, forceRefresh = true) {
    const timer = monitoringService.startTimer();

    try {
      const url = new URL(API_CONFIG.buildCardsForSetUrl(setId));

      // Add query parameters
      if (forceRefresh) {
        url.searchParams.append("forceRefresh", "true");
      }

      url.searchParams.append("page", page.toString());
      url.searchParams.append("pageSize", pageSize.toString());

      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders(),
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");

        monitoringService.trackEvent("api.fetchCardsPage.error", {
          setId,
          page,
          status: response.status,
          duration,
        });

        apiLogger.error("API error for set page", {
          setId,
          page,
          status: response.status,
          error: errorText,
        });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const apiResponse = await response.json();

      // Extract the cards data from the response
      let cardsData = {
        items: [],
        totalCount: 0,
        pageNumber: page,
        pageSize: pageSize,
        totalPages: 1,
      };

      if (apiResponse && typeof apiResponse === "object") {
        if (apiResponse.data && typeof apiResponse.data === "object") {
          cardsData = apiResponse.data;
        } else if (Array.isArray(apiResponse)) {
          cardsData = {
            items: apiResponse,
            totalCount: apiResponse.length,
            pageNumber: page,
            pageSize: pageSize,
            totalPages: 1,
          };
        } else if (apiResponse.cards && Array.isArray(apiResponse.cards)) {
          cardsData = {
            items: apiResponse.cards,
            totalCount: apiResponse.cards.length,
            pageNumber: page,
            pageSize: pageSize,
            totalPages: 1,
          };
        }
      }

      // Transform card data to match expected format
      if (cardsData.items && Array.isArray(cardsData.items)) {
        cardsData.items = cardsData.items.map((card) => {
          const transformedCard = {
            ...card,
            name:
              card.name ||
              card.cardName ||
              `${card.setName} ${card.cardNumber || card.id}`,
            num: card.num || card.cardNumber || "",
            image_url:
              card.image_url ||
              card.imageUrl ||
              (card.images ? card.images.small || card.images.large : ""),
          };

          return transformedCard;
        });
      }

      monitoringService.trackEvent("api.fetchCardsPage.success", {
        setId,
        page,
        duration,
        cardCount: cardsData.items.length,
      });

      monitoringService.trackMetric("api.fetchCardsPage.duration", duration, {
        setId,
        page,
      });

      return cardsData;
    } catch (error) {
      const duration = timer();

      monitoringService.trackException(error, {
        method: "fetchCardsPage",
        setId,
        page,
        duration,
      });

      apiLogger.error("Error fetching cards for set page", {
        setId,
        page,
        error,
      });
      throw error;
    }
  },

  /**
   * Get pricing data for a specific card
   * @param {string} cardId - The card ID
   * @param {string} setId - The set ID
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Object>} Card data with pricing information
   */
  async getCardPricing(cardId, setId, forceRefresh = true) {
    const timer = monitoringService.startTimer();

    try {
      if (!cardId) {
        monitoringService.trackEvent("api.getCardPricing.validation_error", {
          error: "missing_cardId",
        });
        throw new Error("Card ID is required to fetch pricing data");
      }

      if (!setId) {
        monitoringService.trackEvent("api.getCardPricing.validation_error", {
          error: "missing_setId",
        });
        throw new Error("Set ID is required to fetch pricing data");
      }

      monitoringService.trackEvent("api.getCardPricing.started", {
        cardId,
        setId,
        forceRefresh,
      });

      apiLogger.info("Getting pricing data for card from cloud API", {
        cardId,
        setId,
        forceRefresh,
      });

      const url = new URL(API_CONFIG.buildCardInfoUrl(cardId, setId));

      if (forceRefresh) {
        url.searchParams.append("forceRefresh", "true");
      }

      apiLogger.debug("Making pricing request", { url: url.toString() });

      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders(),
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");

        monitoringService.trackEvent("api.getCardPricing.error", {
          cardId,
          setId,
          status: response.status,
          duration,
        });

        apiLogger.error("API error for card pricing", {
          cardId,
          status: response.status,
          error: errorText,
        });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const apiResponse = await response.json();
      const fromCache = apiResponse.cached || false;

      // Track cache hit/miss
      monitoringService.trackEvent(
        fromCache
          ? "api.getCardPricing.cache.hit"
          : "api.getCardPricing.cache.miss",
        { cardId, setId, duration }
      );

      apiLogger.debug("Pricing API response received", {
        cardId,
        cached: fromCache,
      });

      // Extract the card data from the response
      let cardData = null;

      if (apiResponse && typeof apiResponse === "object") {
        if (apiResponse.data) {
          cardData = apiResponse.data;
        } else if (apiResponse.card) {
          cardData = apiResponse.card;
        } else if (
          !apiResponse.data &&
          !apiResponse.card &&
          Object.keys(apiResponse).length > 0
        ) {
          cardData = apiResponse;
        }
      }

      if (!cardData) {
        apiLogger.warn("No valid card data found in API response", { cardId });

        monitoringService.trackEvent("api.getCardPricing.no_data", {
          cardId,
          setId,
          duration,
        });

        return null;
      }

      // Transform the card data to include pricing in the expected format
      const transformedCard = {
        ...cardData,
        pricing: {},
      };

      let pricingSourceCount = 0;

      // Handle PokeData-first pricing structure
      if (cardData.pricing) {
        apiLogger.debug("Transforming PokeData-first pricing structure", {
          cardId,
          pricingKeys: Object.keys(cardData.pricing),
        });

        // Transform PSA grades
        if (cardData.pricing.psa) {
          Object.entries(cardData.pricing.psa).forEach(([grade, value]) => {
            transformedCard.pricing[`psa-${grade}`] = {
              value: value,
              currency: "USD",
            };
            pricingSourceCount++;
          });
        }

        // Transform CGC grades
        if (cardData.pricing.cgc) {
          Object.entries(cardData.pricing.cgc).forEach(([grade, value]) => {
            const cleanGrade = grade.includes("_")
              ? grade.replace("_", ".")
              : grade;
            transformedCard.pricing[`cgc-${cleanGrade}`] = {
              value: value,
              currency: "USD",
            };
            pricingSourceCount++;
          });
        }

        // Transform TCGPlayer price
        if (cardData.pricing.tcgPlayer) {
          transformedCard.pricing.market = {
            value: cardData.pricing.tcgPlayer,
            currency: "USD",
          };
          pricingSourceCount++;
        }

        // Transform eBay raw price
        if (cardData.pricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = {
            value: cardData.pricing.ebayRaw,
            currency: "USD",
          };
          pricingSourceCount++;
        }

        // Transform PokeData raw price
        if (cardData.pricing.pokeDataRaw) {
          transformedCard.pricing.pokeDataRaw = {
            value: cardData.pricing.pokeDataRaw,
            currency: "USD",
          };
          pricingSourceCount++;
        }
      }
      // Fallback: Handle legacy enhancedPricing structure
      else if (cardData.enhancedPricing) {
        apiLogger.debug("Using legacy enhancedPricing structure", {
          cardId,
          enhancedPricingKeys: Object.keys(cardData.enhancedPricing),
        });

        if (cardData.enhancedPricing.psaGrades) {
          Object.entries(cardData.enhancedPricing.psaGrades).forEach(
            ([grade, priceInfo]) => {
              transformedCard.pricing[`psa-${grade}`] = priceInfo;
              pricingSourceCount++;
            }
          );
        }
        if (cardData.enhancedPricing.cgcGrades) {
          Object.entries(cardData.enhancedPricing.cgcGrades).forEach(
            ([grade, priceInfo]) => {
              transformedCard.pricing[`cgc-${grade}`] = priceInfo;
              pricingSourceCount++;
            }
          );
        }
        if (cardData.enhancedPricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = cardData.enhancedPricing.ebayRaw;
          pricingSourceCount++;
        }
      }
      // Final fallback: Use TCG Player pricing
      else if (cardData.tcgPlayerPrice) {
        apiLogger.debug("Using TCGPlayer pricing as fallback", {
          cardId,
          tcgPlayerKeys: Object.keys(cardData.tcgPlayerPrice),
        });

        if (cardData.tcgPlayerPrice.market) {
          transformedCard.pricing.market = {
            value: cardData.tcgPlayerPrice.market,
            currency: "USD",
          };
          pricingSourceCount++;
        }
        if (cardData.tcgPlayerPrice.low) {
          transformedCard.pricing.low = {
            value: cardData.tcgPlayerPrice.low,
            currency: "USD",
          };
          pricingSourceCount++;
        }
        if (cardData.tcgPlayerPrice.mid) {
          transformedCard.pricing.mid = {
            value: cardData.tcgPlayerPrice.mid,
            currency: "USD",
          };
          pricingSourceCount++;
        }
        if (cardData.tcgPlayerPrice.high) {
          transformedCard.pricing.high = {
            value: cardData.tcgPlayerPrice.high,
            currency: "USD",
          };
          pricingSourceCount++;
        }
      }

      // Transform image structure
      if (cardData.images) {
        transformedCard.image_url =
          cardData.images.large || cardData.images.small;
        apiLogger.debug("Transformed image URL", {
          cardId,
          imageUrl: transformedCard.image_url,
        });
      }

      // Ensure card name is available
      if (!transformedCard.name && cardData.cardName) {
        transformedCard.name = cardData.cardName;
      }

      // Ensure card number is available
      if (!transformedCard.num && cardData.cardNumber) {
        transformedCard.num = cardData.cardNumber;
      }

      // Ensure set name is available
      if (!transformedCard.set_name && cardData.setName) {
        transformedCard.set_name = cardData.setName;
      }

      // Track successful pricing fetch
      monitoringService.trackEvent("api.getCardPricing.success", {
        cardId,
        setId,
        duration,
        fromCache,
        pricingSourceCount,
        hasPricing: Object.keys(transformedCard.pricing).length > 0,
      });

      monitoringService.trackMetric("api.getCardPricing.duration", duration, {
        cardId,
        fromCache,
      });

      monitoringService.trackMetric(
        "api.getCardPricing.pricingSourceCount",
        pricingSourceCount,
        {
          cardId,
        }
      );

      apiLogger.success("Successfully processed pricing data for card", {
        cardId,
        pricingKeys: Object.keys(transformedCard.pricing),
      });
      return transformedCard;
    } catch (error) {
      const duration = timer();

      monitoringService.trackException(error, {
        method: "getCardPricing",
        cardId,
        setId,
        duration,
      });

      apiLogger.error("Error fetching pricing for card from cloud API", {
        cardId,
        error,
      });
      throw error;
    }
  },

  /**
   * Get pricing data for a specific card with metadata
   * @param {string} cardId - The card ID
   * @param {string} setId - The set ID
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Object>} Card pricing data with metadata
   */
  async getCardPricingWithMetadata(cardId, setId, forceRefresh = true) {
    const timer = monitoringService.startTimer();

    try {
      if (!cardId) {
        monitoringService.trackEvent(
          "api.getCardPricingWithMetadata.validation_error",
          {
            error: "missing_cardId",
          }
        );
        throw new Error("Card ID is required to fetch pricing data");
      }

      if (!setId) {
        monitoringService.trackEvent(
          "api.getCardPricingWithMetadata.validation_error",
          {
            error: "missing_setId",
          }
        );
        throw new Error("Set ID is required to fetch pricing data");
      }

      monitoringService.trackEvent("api.getCardPricingWithMetadata.started", {
        cardId,
        setId,
        forceRefresh,
      });

      apiLogger.info(
        "Getting pricing data with metadata for card from cloud API",
        { cardId, setId, forceRefresh }
      );

      const url = new URL(API_CONFIG.buildCardInfoUrl(cardId, setId));

      if (forceRefresh) {
        url.searchParams.append("forceRefresh", "true");
      }

      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders(),
      });

      const duration = timer();

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");

        monitoringService.trackEvent("api.getCardPricingWithMetadata.error", {
          cardId,
          setId,
          status: response.status,
          duration,
        });

        apiLogger.error("API error for card pricing with metadata", {
          cardId,
          status: response.status,
          error: errorText,
        });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const apiResponse = await response.json();
      const fromCache = apiResponse.cached || false;

      // Track cache hit/miss
      monitoringService.trackEvent(
        fromCache
          ? "api.getCardPricingWithMetadata.cache.hit"
          : "api.getCardPricingWithMetadata.cache.miss",
        { cardId, setId, duration }
      );

      apiLogger.debug("Pricing API response for card with metadata", {
        cardId,
        cached: fromCache,
      });

      // Extract the card data from the response
      let cardData = null;

      if (apiResponse && typeof apiResponse === "object") {
        if (apiResponse.data) {
          cardData = apiResponse.data;
        } else if (apiResponse.card) {
          cardData = apiResponse.card;
        } else if (
          !apiResponse.data &&
          !apiResponse.card &&
          Object.keys(apiResponse).length > 0
        ) {
          cardData = apiResponse;
        }
      }

      if (!cardData) {
        apiLogger.warn(
          "No valid card data found in API response for card with metadata",
          { cardId }
        );

        monitoringService.trackEvent("api.getCardPricingWithMetadata.no_data", {
          cardId,
          setId,
          duration,
        });

        return {
          data: null,
          timestamp: Date.now(),
          fromCache: false,
          cacheAge: 0,
        };
      }

      // Get metadata from response or use defaults
      const timestamp = apiResponse.timestamp
        ? new Date(apiResponse.timestamp).getTime()
        : Date.now();
      const cacheAge = apiResponse.cacheAge || 0;

      // Add stale indicator logic
      const now = Date.now();
      const dataAge = now - timestamp;
      const isStale = dataAge > 24 * 60 * 60 * 1000; // 24 hours

      // Transform the card data to include pricing in the expected format
      const transformedCard = {
        ...cardData,
        pricing: {},
      };

      let pricingSourceCount = 0;

      // Handle PokeData-first pricing structure
      if (cardData.pricing) {
        apiLogger.debug(
          "Transforming PokeData-first pricing structure with metadata",
          { cardId, pricingKeys: Object.keys(cardData.pricing) }
        );

        // Transform PSA grades
        if (cardData.pricing.psa) {
          Object.entries(cardData.pricing.psa).forEach(([grade, value]) => {
            transformedCard.pricing[`psa-${grade}`] = {
              value: value,
              currency: "USD",
            };
            pricingSourceCount++;
          });
        }

        // Transform CGC grades
        if (cardData.pricing.cgc) {
          Object.entries(cardData.pricing.cgc).forEach(([grade, value]) => {
            const cleanGrade = grade.replace("_", ".");
            transformedCard.pricing[`cgc-${cleanGrade}`] = {
              value: value,
              currency: "USD",
            };
            pricingSourceCount++;
          });
        }

        // Transform TCGPlayer price
        if (cardData.pricing.tcgPlayer) {
          transformedCard.pricing.market = {
            value: cardData.pricing.tcgPlayer,
            currency: "USD",
          };
          pricingSourceCount++;
        }

        // Transform eBay raw price
        if (cardData.pricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = {
            value: cardData.pricing.ebayRaw,
            currency: "USD",
          };
          pricingSourceCount++;
        }

        // Transform PokeData raw price
        if (cardData.pricing.pokeDataRaw) {
          transformedCard.pricing.pokeDataRaw = {
            value: cardData.pricing.pokeDataRaw,
            currency: "USD",
          };
          pricingSourceCount++;
        }
      }
      // Fallback: Handle legacy enhancedPricing structure
      else if (cardData.enhancedPricing) {
        apiLogger.debug(
          "Using legacy enhancedPricing structure with metadata",
          { cardId, enhancedPricingKeys: Object.keys(cardData.enhancedPricing) }
        );

        if (cardData.enhancedPricing.psaGrades) {
          Object.entries(cardData.enhancedPricing.psaGrades).forEach(
            ([grade, priceInfo]) => {
              transformedCard.pricing[`psa-${grade}`] = priceInfo;
              pricingSourceCount++;
            }
          );
        }
        if (cardData.enhancedPricing.cgcGrades) {
          Object.entries(cardData.enhancedPricing.cgcGrades).forEach(
            ([grade, priceInfo]) => {
              transformedCard.pricing[`cgc-${grade}`] = priceInfo;
              pricingSourceCount++;
            }
          );
        }
        if (cardData.enhancedPricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = cardData.enhancedPricing.ebayRaw;
          pricingSourceCount++;
        }
      }
      // Final fallback: Use TCG Player pricing
      else if (cardData.tcgPlayerPrice) {
        apiLogger.debug("Using TCGPlayer pricing as fallback with metadata", {
          cardId,
          tcgPlayerKeys: Object.keys(cardData.tcgPlayerPrice),
        });

        if (cardData.tcgPlayerPrice.market) {
          transformedCard.pricing.market = {
            value: cardData.tcgPlayerPrice.market,
            currency: "USD",
          };
          pricingSourceCount++;
        }
        if (cardData.tcgPlayerPrice.low) {
          transformedCard.pricing.low = {
            value: cardData.tcgPlayerPrice.low,
            currency: "USD",
          };
          pricingSourceCount++;
        }
        if (cardData.tcgPlayerPrice.mid) {
          transformedCard.pricing.mid = {
            value: cardData.tcgPlayerPrice.mid,
            currency: "USD",
          };
          pricingSourceCount++;
        }
        if (cardData.tcgPlayerPrice.high) {
          transformedCard.pricing.high = {
            value: cardData.tcgPlayerPrice.high,
            currency: "USD",
          };
          pricingSourceCount++;
        }
      }

      // Transform image structure
      if (cardData.images) {
        transformedCard.image_url =
          cardData.images.large || cardData.images.small;
        apiLogger.debug("Transformed image URL with metadata", {
          cardId,
          imageUrl: transformedCard.image_url,
        });
      }

      // Ensure card name is available
      if (!transformedCard.name && cardData.cardName) {
        transformedCard.name = cardData.cardName;
      }

      // Ensure card number is available
      if (!transformedCard.num && cardData.cardNumber) {
        transformedCard.num = cardData.cardNumber;
      }

      // Ensure set name is available
      if (!transformedCard.set_name && cardData.setName) {
        transformedCard.set_name = cardData.setName;
      }

      // Track successful pricing fetch with metadata
      monitoringService.trackEvent("api.getCardPricingWithMetadata.success", {
        cardId,
        setId,
        duration,
        fromCache,
        isStale,
        pricingSourceCount,
        hasPricing: Object.keys(transformedCard.pricing).length > 0,
      });

      monitoringService.trackMetric(
        "api.getCardPricingWithMetadata.duration",
        duration,
        {
          cardId,
          fromCache,
          isStale,
        }
      );

      monitoringService.trackMetric(
        "api.getCardPricingWithMetadata.pricingSourceCount",
        pricingSourceCount,
        {
          cardId,
        }
      );

      if (isStale) {
        monitoringService.trackEvent(
          "api.getCardPricingWithMetadata.stale_data",
          {
            cardId,
            setId,
            dataAge,
          }
        );
      }

      apiLogger.success(
        "Successfully processed pricing data for card with metadata",
        {
          cardId,
          pricingKeys: Object.keys(transformedCard.pricing),
          fromCache,
          isStale,
        }
      );

      return {
        data: transformedCard,
        timestamp: timestamp,
        fromCache: fromCache,
        cacheAge: cacheAge,
        isStale: isStale,
      };
    } catch (error) {
      const duration = timer();

      monitoringService.trackException(error, {
        method: "getCardPricingWithMetadata",
        cardId,
        setId,
        duration,
      });

      apiLogger.error(
        "Error fetching pricing for card from cloud API with metadata",
        { cardId, error }
      );
      throw error;
    }
  },
};
