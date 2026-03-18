import type { RequestHandler } from './$types';
import {
  getScrydexApiService,
  mapScrydexVariantToCardVariant,
} from '$lib/server/services/scrydexApi';
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
import type { Card, CardImage } from '$lib/server/models/types';

/** Check whether a card has any actual price values in its variants */
function cardHasPricing(card: Card | null): boolean {
  if (!card?.variants || card.variants.length === 0) return false;
  return card.variants.some((v) => v.prices && v.prices.length > 0);
}

/** Map backend Card → frontend PokemonCard shape */
function cardToFrontend(card: Card) {
  return {
    id: card.id,
    name: card.cardName,
    number: card.cardNumber,
    cardNumber: card.cardNumber,
    printedNumber: card.printedNumber,
    rarity: card.rarity,
    rarityCode: card.rarityCode,
    artist: card.artist,
    images: card.images,
    variants: card.variants,
    setCode: card.setCode,
    setId: card.setId,
    setName: card.setName,
    pricingLastUpdated: card.pricingLastUpdated,
  };
}

export const GET: RequestHandler = async ({ params, url }) => {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  const setId = params.set_id;
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
    if (!forceRefresh && config.enableRedisCache) {
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
      card = await cosmosService.getCard(cardId, setId);

      if (card) {
        console.log(`[GetCardInfo] Found card ${cardId} in Cosmos DB`);
      }
    }

    // Fetch from Scrydex API (single call includes pricing via ?include=prices)
    // Also fetch if the card exists but has no pricing data (e.g. saved from list endpoint)
    const needsPricing = !cardHasPricing(card);
    if (!card || forceRefresh || needsPricing) {
      if (card && needsPricing) {
        console.log(
          `[GetCardInfo] Card ${cardId} exists but has no pricing data, fetching from Scrydex API`
        );
      } else {
        console.log(`[GetCardInfo] Fetching card details from Scrydex API`);
      }
      const apiStartTime = Date.now();

      try {
        const scrydexService = getScrydexApiService();
        const scrydexCard = await scrydexService.getCard(cardId, true);

        if (!scrydexCard) {
          if (!card) {
            console.log(`[GetCardInfo] Card ${cardId} not found in Scrydex API`);
            return apiError(`Card ${cardId} not found`, 404);
          }
          // If we have a cached/DB card but Scrydex failed, continue with what we have
          console.warn(
            `[GetCardInfo] Scrydex API returned null for ${cardId}, using existing data`
          );
        } else {
          const apiDuration = Date.now() - apiStartTime;

          monitoring.trackMetric('api.scrydex.duration', apiDuration, {
            functionName: 'GetCardInfo',
            cardId,
          });

          const images: CardImage[] | undefined = scrydexCard.images?.map((img) => ({
            type: img.type,
            small: img.small,
            medium: img.medium,
            large: img.large,
          }));

          // Build card from Scrydex response (pricing is included inline)
          card = {
            id: scrydexCard.id,
            setCode: scrydexCard.expansion.code,
            setId: scrydexCard.expansion.id,
            setName: scrydexCard.expansion.name,
            cardId: scrydexCard.id,
            cardName: scrydexCard.name,
            cardNumber: scrydexCard.number,
            printedNumber: scrydexCard.printed_number,
            rarity: scrydexCard.rarity || '',
            rarityCode: scrydexCard.rarity_code,
            artist: scrydexCard.artist,
            images,
            variants: scrydexCard.variants?.map(mapScrydexVariantToCardVariant),
            language: scrydexCard.language,
            languageCode: scrydexCard.language_code,
            lastUpdated: new Date().toISOString(),
            pricingLastUpdated: new Date().toISOString(),
          };

          // Save to Cosmos DB
          console.log(`[GetCardInfo] Saving card ${cardId} to Cosmos DB`);
          const cosmosService = getCosmosDbService();
          await cosmosService.saveCard(card);
        }
      } catch (error: any) {
        if (!card) {
          console.error(
            `[GetCardInfo] Error fetching from Scrydex API: ${error.message}`
          );
          throw error;
        }
        // If we have existing data, log warning but don't fail
        console.warn(
          `[GetCardInfo] Failed to refresh from Scrydex API: ${error.message}, using existing data`
        );
      }
    }

    if (!card) {
      console.log(`[GetCardInfo] Card ${cardId} not found`);
      return apiError(`Card ${cardId} not found`, 404);
    }

    // Cache the card
    if (!cacheHit && config.enableRedisCache) {
      console.log(`[GetCardInfo] Caching card ${cardId}`);
      const redisService = getRedisCacheService();
      await redisService.set(
        cacheKey,
        formatCacheEntry(card, config.cacheTtlCards),
        config.cacheTtlCards
      );
    }

    const duration = Date.now() - startTime;
    const hasPricing = cardHasPricing(card);

    monitoring.trackMetric('function.duration', duration, {
      functionName: 'GetCardInfo',
      correlationId,
      cached: cacheHit,
      hasPricing,
    });

    monitoring.trackEvent('function.success', {
      functionName: 'GetCardInfo',
      correlationId,
      duration,
      cached: cacheHit,
      cardId,
      setId,
      hasPricing,
    });

    console.log(`[GetCardInfo] Successfully returning card ${cardId} (${duration}ms)`);

    return apiSuccess(cardToFrontend(card), 200, cacheHit);
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
