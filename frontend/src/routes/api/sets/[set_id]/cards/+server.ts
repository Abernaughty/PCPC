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
  };
}

export const GET: RequestHandler = async ({ params, url }) => {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  const setId = params.set_id;
  const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
  const page = parseInt(url.searchParams.get('page') || '1');
  const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '500'), 500);

  monitoring.trackEvent('function.invoked', {
    functionName: 'GetCardsBySet',
    correlationId,
    setId,
  });

  console.log(
    `[GetCardsBySet] Fetching cards for set ${setId}, page ${page}, pageSize ${pageSize}`
  );

  try {
    const config = getConfig();
    const cacheKey = `${CacheKeys.cardsForSet(setId)}-page-${page}-size-${pageSize}`;
    let cards: Card[] | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    // Check Redis cache
    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === 'true') {
      console.log(`[GetCardsBySet] Checking Redis cache with key: ${cacheKey}`);
      const redisService = getRedisCacheService();
      const cachedEntry = await redisService.get<CacheEntry<Card[]>>(cacheKey);

      cards = parseCacheEntry<Card[]>(cachedEntry);

      if (cards) {
        console.log(`[GetCardsBySet] Cache hit for set ${setId} (${cards.length} cards)`);
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;

        monitoring.trackEvent('cache.hit', {
          functionName: 'GetCardsBySet',
          correlationId,
          setId,
          cacheKey,
          itemCount: cards.length,
          cacheAge,
        });
      } else {
        console.log(`[GetCardsBySet] Cache miss for set ${setId}`);

        monitoring.trackEvent('cache.miss', {
          functionName: 'GetCardsBySet',
          correlationId,
          setId,
          cacheKey,
        });
      }
    }

    // Check Cosmos DB
    if (!cards) {
      console.log(`[GetCardsBySet] Checking Cosmos DB for set ${setId}`);
      const cosmosService = getCosmosDbService();
      cards = await cosmosService.getCardsBySetId(setId);

      if (cards && cards.length > 0) {
        console.log(
          `[GetCardsBySet] Found ${cards.length} cards in Cosmos DB for set ${setId}`
        );
      }
    }

    // Fetch from Scrydex API
    if (!cards || cards.length === 0) {
      console.log(`[GetCardsBySet] Fetching cards from Scrydex API for set ${setId}`);
      const apiStartTime = Date.now();

      try {
        const scrydexService = getScrydexApiService();
        const response = await scrydexService.getCardsInExpansion(setId);
        const apiDuration = Date.now() - apiStartTime;

        console.log(
          `[GetCardsBySet] Scrydex API returned ${response.data.length} cards (${apiDuration}ms)`
        );

        monitoring.trackMetric('api.scrydex.duration', apiDuration, {
          functionName: 'GetCardsBySet',
          setId,
          cardCount: response.data.length,
        });

        // Transform Scrydex cards to internal Card format and save to Cosmos DB
        const cosmosService = getCosmosDbService();
        const cardsToSave = response.data.map((card) => {
          const images: CardImage[] | undefined = card.images?.map((img) => ({
            type: img.type,
            small: img.small,
            medium: img.medium,
            large: img.large,
          }));

          const cosmosCard: Card = {
            id: card.id,
            setCode: card.expansion.code,
            setId: card.expansion.id,
            setName: card.expansion.name,
            cardId: card.id,
            cardName: card.name,
            cardNumber: card.number,
            printedNumber: card.printed_number,
            rarity: card.rarity || '',
            rarityCode: card.rarity_code,
            artist: card.artist,
            images,
            variants: card.variants?.map(mapScrydexVariantToCardVariant),
            language: card.language,
            languageCode: card.language_code,
            lastUpdated: new Date().toISOString(),
          };
          return cosmosCard;
        });

        if (cardsToSave.length > 0) {
          console.log(`[GetCardsBySet] Saving ${cardsToSave.length} cards to Cosmos DB`);
          await cosmosService.saveCards(cardsToSave);
        }

        cards = cardsToSave;
      } catch (error: any) {
        console.error(
          `[GetCardsBySet] Error fetching from Scrydex API: ${error.message}`
        );
        throw error;
      }
    }

    if (!cards || cards.length === 0) {
      console.log(`[GetCardsBySet] No cards found for set ${setId}`);
      return apiError(`No cards found for set ${setId}`, 404);
    }

    // Map to frontend shape and apply pagination
    const frontendCards = cards.map(cardToFrontend);
    const totalCount = frontendCards.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalCount);
    const paginatedCards = frontendCards.slice(startIndex, endIndex);

    // Cache the paginated result
    if (!cacheHit && process.env.ENABLE_REDIS_CACHE === 'true') {
      console.log(`[GetCardsBySet] Caching ${paginatedCards.length} cards`);
      const redisService = getRedisCacheService();
      await redisService.set(
        cacheKey,
        formatCacheEntry(paginatedCards, config.cacheTtlCards),
        config.cacheTtlCards
      );
    }

    const duration = Date.now() - startTime;

    monitoring.trackMetric('function.duration', duration, {
      functionName: 'GetCardsBySet',
      correlationId,
      cached: cacheHit,
      resultCount: paginatedCards.length,
    });

    monitoring.trackEvent('function.success', {
      functionName: 'GetCardsBySet',
      correlationId,
      duration,
      cached: cacheHit,
      setId,
      page,
      pageSize,
      resultCount: paginatedCards.length,
    });

    console.log(
      `[GetCardsBySet] Successfully returning ${paginatedCards.length} cards (${duration}ms)`
    );

    return apiSuccess(
      {
        cards: paginatedCards,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages,
        },
      },
      200,
      cacheHit
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`[GetCardsBySet] Error: ${error.message}`);

    monitoring.trackException(error, {
      functionName: 'GetCardsBySet',
      correlationId,
      setId,
      duration,
    });

    monitoring.trackEvent('function.error', {
      functionName: 'GetCardsBySet',
      correlationId,
      setId,
      duration,
      errorMessage: error.message,
    });

    return apiError(error.message || 'Failed to fetch cards', 500);
  }
};
