import type { RequestHandler } from './$types';
import { getScrydexApiService, normalizeLanguageCode } from '$lib/server/services/scrydexApi';
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
    const language = url.searchParams.get('language') || 'en';
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';
    const returnAll = url.searchParams.get('all') === 'true';
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '100');

    const config = getConfig();
    const setsTtl = config.cacheTtlSets;

    console.log(
      `[GetSets] Parameters: language=${language}, returnAll=${returnAll}, page=${page}, pageSize=${pageSize}`
    );

    const cacheKey = `${CacheKeys.setList()}-scrydex-${language}`;
    let sets: any[] | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    // Check Redis cache
    if (!forceRefresh && config.enableRedisCache) {
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

    // Fetch from Scrydex API if not cached
    if (!sets) {
      console.log(`[GetSets] Fetching sets from Scrydex API`);
      const apiStartTime = Date.now();

      try {
        const scrydexService = getScrydexApiService();
        const expansions = await scrydexService.getAllExpansions(language);
        const apiDuration = Date.now() - apiStartTime;

        // Map Scrydex expansions to our internal PokemonSet shape
        sets = expansions.map((expansion) => {
          const normalizedLangCode = normalizeLanguageCode(expansion.language_code);
          const isJP = normalizedLangCode === 'JP';

          // For JP sets: prefer English translation, keep original as nativeName
          const translatedName = expansion.translation?.en?.name;
          const displayName = (isJP && translatedName) ? translatedName : expansion.name;
          // Only set nativeName if we actually translated (original differs from display)
          const nativeName = (isJP && translatedName && translatedName !== expansion.name)
            ? expansion.name
            : undefined;

          return {
            id: expansion.id,
            code: expansion.code,
            name: displayName,
            nativeName,
            series: expansion.series,
            releaseDate: expansion.release_date,
            total: expansion.total,
            printedTotal: expansion.printed_total,
            language: expansion.language,
            languageCode: normalizedLangCode,
            isOnlineOnly: expansion.is_online_only,
            logo: expansion.logo,
            symbol: expansion.symbol,
          };
        });

        console.log(
          `[GetSets] Scrydex API returned ${expansions.length} expansions for language ${language} (${apiDuration}ms)`
        );

        monitoring.trackMetric('api.scrydex.duration', apiDuration, {
          functionName: 'GetSets',
          language,
          totalSets: expansions.length,
        });

        // Save to cache
        if (sets && sets.length > 0 && config.enableRedisCache) {
          console.log(`[GetSets] Saving ${sets.length} sets to Redis cache`);
          const redisService = getRedisCacheService();
          await redisService.set(
            cacheKey,
            formatCacheEntry(sets, setsTtl),
            setsTtl
          );
        }
      } catch (error: any) {
        console.log(`[GetSets] Error fetching from Scrydex API: ${error.message}`);
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

      if (set.releaseDate) {
        enhanced.releaseYear = new Date(set.releaseDate).getFullYear();
        const releaseDate = new Date(set.releaseDate);
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        enhanced.isRecent = releaseDate > twoYearsAgo;
      }

      return enhanced;
    });

    // Sort by release date (newest first)
    enhancedSets.sort((a, b) => {
      if (!a.releaseDate || !b.releaseDate) return 0;
      return (
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
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
