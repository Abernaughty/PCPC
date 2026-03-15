import type { RequestHandler } from './$types';
import { getPokeDataApiService } from '$lib/server/services/pokeDataApi';
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

export const GET: RequestHandler = async ({ url }) => {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  monitoring.trackEvent('function.invoked', {
    functionName: 'GetSets',
    correlationId,
  });

  try {
    const language = url.searchParams.get('language') || 'ENGLISH';
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const returnAll = url.searchParams.get('all') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '100');

    const config = getConfig();
    const setsTtl = config.cacheTtlSets;

    console.log(
      `[GetSets] Parameters: language=${language}, returnAll=${returnAll}, page=${page}, pageSize=${pageSize}`
    );

    const cacheKey = `${CacheKeys.setList()}-pokedata-${language}`;
    let sets: any[] | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    // Check Redis cache
    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === 'true') {
      console.log(`[GetSets] Checking Redis cache with key: ${cacheKey}`);
      const cacheCheckStart = Date.now();
      const redisService = getRedisCacheService();
      const cachedEntry = await redisService.get<CacheEntry<any[]>>(cacheKey);
      const cacheCheckDuration = Date.now() - cacheCheckStart;

      sets = parseCacheEntry<any[]>(cachedEntry);

      if (sets) {
        console.log(`[GetSets] Cache hit for set list (${sets.length} sets)`);
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;

        monitoring.trackEvent('cache.hit', {
          functionName: 'GetSets',
          correlationId,
          cacheKey,
          itemCount: sets.length,
          cacheAge,
        });

        monitoring.trackMetric('cache.check.duration', cacheCheckDuration, {
          functionName: 'GetSets',
          result: 'hit',
        });
      } else {
        console.log(`[GetSets] Cache miss for set list`);

        monitoring.trackEvent('cache.miss', {
          functionName: 'GetSets',
          correlationId,
          cacheKey,
        });

        monitoring.trackMetric('cache.check.duration', cacheCheckDuration, {
          functionName: 'GetSets',
          result: 'miss',
        });
      }
    }

    // Fetch from PokeData API if not cached
    if (!sets) {
      console.log(`[GetSets] Fetching sets from PokeData API`);
      const apiStartTime = Date.now();

      try {
        const pokeDataService = getPokeDataApiService();
        const allSets = await pokeDataService.getAllSets();
        const apiDuration = Date.now() - apiStartTime;

        sets = allSets.filter(
          (set) => language === 'ALL' || set.language === language
        );

        console.log(
          `[GetSets] PokeData API returned ${allSets.length} total sets, ${sets.length} for language ${language} (${apiDuration}ms)`
        );

        monitoring.trackMetric('api.pokedata.duration', apiDuration, {
          functionName: 'GetSets',
          language,
          totalSets: allSets.length,
          filteredSets: sets.length,
        });

        // Save to cache
        if (sets && sets.length > 0 && process.env.ENABLE_REDIS_CACHE === 'true') {
          console.log(`[GetSets] Saving ${sets.length} sets to Redis cache`);
          const redisService = getRedisCacheService();
          await redisService.set(
            cacheKey,
            formatCacheEntry(sets, setsTtl),
            setsTtl
          );
        }
      } catch (error: any) {
        console.log(`[GetSets] Error fetching from PokeData API: ${error.message}`);
        throw error;
      }
    }

    if (!sets || sets.length === 0) {
      console.log(`[GetSets] No sets found for language: ${language}`);
      return apiError(`No sets found for language: ${language}`, 404);
    }

    // Enhance sets
    const enhancedSets = sets.map((set) => {
      const enhanced: any = { ...set };

      if (set.release_date) {
        enhanced.releaseYear = new Date(set.release_date).getFullYear();
        const releaseDate = new Date(set.release_date);
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        enhanced.isRecent = releaseDate > twoYearsAgo;
      }

      return enhanced;
    });

    // Sort by release date (newest first)
    enhancedSets.sort((a, b) => {
      if (!a.release_date || !b.release_date) return 0;
      return (
        new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
      );
    });

    // Apply pagination
    let finalSets: any[];
    let paginationInfo: any;

    if (returnAll) {
      finalSets = enhancedSets;
      paginationInfo = {
        page: 1,
        pageSize: enhancedSets.length,
        totalCount: enhancedSets.length,
        totalPages: 1,
      };
      console.log(`[GetSets] Returning ALL ${enhancedSets.length} sets`);
    } else {
      const totalCount = enhancedSets.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalCount);
      finalSets = enhancedSets.slice(startIndex, endIndex);

      paginationInfo = {
        page,
        pageSize,
        totalCount,
        totalPages,
      };

      console.log(
        `[GetSets] Returning page ${page}/${totalPages} with ${finalSets.length} sets`
      );
    }

    const duration = Date.now() - startTime;

    monitoring.trackMetric('function.duration', duration, {
      functionName: 'GetSets',
      correlationId,
      cached: cacheHit,
      resultCount: finalSets.length,
    });

    monitoring.trackEvent('function.success', {
      functionName: 'GetSets',
      correlationId,
      duration,
      cached: cacheHit,
      resultCount: finalSets.length,
      language,
      returnAll,
    });

    console.log(
      `[GetSets] Successfully returning ${finalSets.length} sets (${duration}ms)`
    );

    return apiSuccess(
      {
        sets: finalSets,
        pagination: paginationInfo,
      },
      200,
      cacheHit
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.log(`[GetSets] Error: ${error.message}`);

    monitoring.trackException(error, {
      functionName: 'GetSets',
      correlationId,
      duration,
    });

    monitoring.trackEvent('function.error', {
      functionName: 'GetSets',
      correlationId,
      duration,
      errorMessage: error.message,
    });

    return apiError(error.message || 'Failed to fetch sets', 500);
  }
};
