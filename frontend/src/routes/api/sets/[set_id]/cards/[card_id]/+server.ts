import type { RequestHandler } from './$types';
import { getPokeDataApiService } from '$lib/server/services/pokeDataApi';
import { getCosmosDbService } from '$lib/server/services/cosmosDb';
import { getRedisCacheService } from '$lib/server/services/redisCache';
import { monitoring } from '$lib/server/services/monitoring';
import { apiError, apiSuccess } from '$lib/server/utils/errors';
import {
  CacheKeys,
  formatCacheEntry,
  getCacheAge,
  parseCacheEntry,
  type CacheEntry,
} from '$lib/server/utils/cache';
import { getConfig } from '$lib/server/config';
import type { Card } from '$lib/server/models/types';

export const GET: RequestHandler = async ({ params, url }) => {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  const setId = parseInt(params.set_id, 10);
  const cardId = params.card_id;
  const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

  monitoring.trackEvent('function.invoked', {
    functionName: 'GetCardInfo',
    correlationId,
    setId,
    cardId,
  });

  console.log(`[GetCardInfo] Fetching card ${cardId} from set ${setId}`);

  try {
    const config = getConfig();
    const cacheKey = `${CacheKeys.card(cardId)}-set-${setId}`;
    let card: Card | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    // Check Redis cache
    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === 'true') {
      console.log(`[GetCardInfo] Checking Redis cache with key: ${cacheKey}`);
      const redisService = getRedisCacheService();
      const cachedEntry = await redisService.get<CacheEntry<Card>>(cacheKey);

      card = parseCacheEntry<Card>(cachedEntry);

      if (card) {
        console.log(`[GetCardInfo] Cache hit for card ${cardId}`);
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;

        monitoring.trackEvent('cache.hit', {
          functionName: 'GetCardInfo',
          correlationId,
          cardId,
          cacheKey,
          cacheAge,
        });
      } else {
        console.log(`[GetCardInfo] Cache miss for card ${cardId}`);

        monitoring.trackEvent('cache.miss', {
          functionName: 'GetCardInfo',
          correlationId,
          cardId,
          cacheKey,
        });
      }
    }

    // Check Cosmos DB
    if (!card) {
      console.log(`[GetCardInfo] Checking Cosmos DB for card ${cardId}`);
      const cosmosService = getCosmosDbService();
      const cardIdNum = parseInt(cardId, 10);
      card = await cosmosService.getCard(cardId, setId);

      if (card) {
        console.log(`[GetCardInfo] Found card ${cardId} in Cosmos DB`);
      }
    }

    // Fetch full card details from PokeData
    if (!card) {
      console.log(`[GetCardInfo] Fetching card details from PokeData API`);
      const apiStartTime = Date.now();

      try {
        const pokeDataService = getPokeDataApiService();
        const cardIdNum = parseInt(cardId, 10);
        const fullCardData = await pokeDataService.getFullCardDetailsById(cardIdNum);

        if (!fullCardData) {
          console.log(`[GetCardInfo] Card ${cardId} not found in PokeData API`);
          return apiError(`Card ${cardId} not found`, 404);
        }

        const apiDuration = Date.now() - apiStartTime;

        monitoring.trackMetric('api.pokedata.duration', apiDuration, {
          functionName: 'GetCardInfo',
          cardId,
        });

        // Create card from API response
        card = {
          id: fullCardData.id.toString(),
          setCode: fullCardData.set_code || '',
          setId: fullCardData.set_id,
          setName: fullCardData.set_name,
          cardId: fullCardData.id.toString(),
          cardName: fullCardData.name,
          cardNumber: fullCardData.num,
          rarity: '',
          pokeDataId: fullCardData.id,
          lastUpdated: new Date().toISOString(),
        };

        // Save to Cosmos DB
        console.log(`[GetCardInfo] Saving card ${cardId} to Cosmos DB`);
        const cosmosService = getCosmosDbService();
        await cosmosService.saveCard(card);
      } catch (error: any) {
        console.error(
          `[GetCardInfo] Error fetching from PokeData API: ${error.message}`
        );
        throw error;
      }
    }

    // Fetch fresh pricing if requested or not available
    if (forceRefresh || !card.enhancedPricing) {
      console.log(`[GetCardInfo] Fetching pricing for card ${cardId}`);
      const pricingStartTime = Date.now();

      try {
        const pokeDataService = getPokeDataApiService();
        const pricing = await pokeDataService.getCardPricing(
          cardId,
          card.pokeDataId
        );

        if (pricing) {
          card.enhancedPricing = pricing;
          card.pricingLastUpdated = new Date().toISOString();

          const pricingDuration = Date.now() - pricingStartTime;
          console.log(
            `[GetCardInfo] Updated pricing for card ${cardId} (${pricingDuration}ms)`
          );

          // Update in Cosmos DB
          const cosmosService = getCosmosDbService();
          await cosmosService.updateCard(card);
        }
      } catch (error: any) {
        console.warn(
          `[GetCardInfo] Failed to fetch pricing for card ${cardId}: ${error.message}`
        );
        // Don't fail the entire request if pricing fails
      }
    }

    if (!card) {
      console.log(`[GetCardInfo] Card ${cardId} not found`);
      return apiError(`Card ${cardId} not found`, 404);
    }

    // Cache the card
    if (!cacheHit && process.env.ENABLE_REDIS_CACHE === 'true') {
      console.log(`[GetCardInfo] Caching card ${cardId}`);
      const redisService = getRedisCacheService();
      await redisService.set(
        cacheKey,
        formatCacheEntry(card, config.cacheTtlCards),
        config.cacheTtlCards
      );
    }

    const duration = Date.now() - startTime;

    monitoring.trackMetric('function.duration', duration, {
      functionName: 'GetCardInfo',
      correlationId,
      cached: cacheHit,
      hasPricing: !!card.enhancedPricing,
    });

    monitoring.trackEvent('function.success', {
      functionName: 'GetCardInfo',
      correlationId,
      duration,
      cached: cacheHit,
      cardId,
      setId,
      hasPricing: !!card.enhancedPricing,
    });

    console.log(`[GetCardInfo] Successfully returning card ${cardId} (${duration}ms)`);

    return apiSuccess(card, 200, cacheHit);
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`[GetCardInfo] Error: ${error.message}`);

    monitoring.trackException(error, {
      functionName: 'GetCardInfo',
      correlationId,
      cardId,
      setId,
      duration,
    });

    monitoring.trackEvent('function.error', {
      functionName: 'GetCardInfo',
      correlationId,
      cardId,
      setId,
      duration,
      errorMessage: error.message,
    });

    return apiError(error.message || 'Failed to fetch card', 500);
  }
};
