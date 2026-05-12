import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { ApiResponse, PokemonSet } from "@pcpc/shared";
import { redisCacheService, scrydexApiService } from "../../index";
import { monitoring } from "../../services/MonitoringService";
import {
  formatCacheEntry,
  getCacheAge,
  getSetListCacheKey,
  parseCacheEntry,
} from "../../utils/cacheUtils";
import { handleError } from "../../utils/errorUtils";
import { mapScrydexExpansionToSet } from "../../utils/scrydexToCosmos";

interface EnhancedSet extends PokemonSet {
  releaseYear?: number;
  isRecent?: boolean;
}

export async function getSetList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  monitoring.trackEvent("function.invoked", {
    functionName: "GetSetList",
    correlationId,
  });

  try {
    context.log(`${correlationId} Processing Scrydex request for set list`);

    const language = (request.query.get("language") || "en").toLowerCase();
    const forceRefresh = request.query.get("forceRefresh") === "true";
    const returnAll = request.query.get("all") === "true";
    const page = parseInt(request.query.get("page") || "1");
    const pageSize = parseInt(request.query.get("pageSize") || "100");

    const setsTtl = parseInt(process.env.CACHE_TTL_SETS || "604800"); // 7 days

    context.log(
      `${correlationId} Parameters: language=${language}, returnAll=${returnAll}, page=${page}, pageSize=${pageSize}, forceRefresh=${forceRefresh}`
    );

    const cacheKey = `${getSetListCacheKey()}-scrydex-${language}`;
    let sets: PokemonSet[] | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
      context.log(`${correlationId} Checking Redis cache with key: ${cacheKey}`);
      const cacheCheckStart = Date.now();
      const cachedEntry = await redisCacheService.get<{
        data: PokemonSet[];
        timestamp: number;
        ttl: number;
      }>(cacheKey);
      const cacheCheckDuration = Date.now() - cacheCheckStart;

      sets = parseCacheEntry<PokemonSet[]>(cachedEntry);

      if (sets) {
        context.log(
          `${correlationId} Cache hit for Scrydex set list (${sets.length} sets)`
        );
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;

        monitoring.trackEvent("cache.hit", {
          functionName: "GetSetList",
          correlationId,
          cacheKey,
          itemCount: sets.length,
          cacheAge,
        });
        monitoring.trackMetric("cache.check.duration", cacheCheckDuration, {
          functionName: "GetSetList",
          result: "hit",
        });
      } else {
        context.log(`${correlationId} Cache miss for Scrydex set list`);
        monitoring.trackEvent("cache.miss", {
          functionName: "GetSetList",
          correlationId,
          cacheKey,
        });
        monitoring.trackMetric("cache.check.duration", cacheCheckDuration, {
          functionName: "GetSetList",
          result: "miss",
        });
      }
    }

    if (!sets) {
      context.log(`${correlationId} Fetching expansions from Scrydex API`);
      const apiStartTime = Date.now();

      try {
        const expansions = await scrydexApiService.getAllExpansions(language);
        const apiDuration = Date.now() - apiStartTime;

        monitoring.trackDependency(
          "Scrydex API",
          "HTTP",
          "GET /expansions",
          apiDuration,
          true,
          {
            functionName: "GetSetList",
            correlationId,
            resultCount: expansions.length,
          }
        );

        sets = expansions.map((expansion) => mapScrydexExpansionToSet(expansion));

        context.log(
          `${correlationId} Scrydex API returned ${expansions.length} expansions for language ${language} (${apiDuration}ms)`
        );

        monitoring.trackMetric("api.scrydex.duration", apiDuration, {
          functionName: "GetSetList",
          language,
          totalSets: expansions.length,
        });

        if (sets.length > 0 && process.env.ENABLE_REDIS_CACHE === "true") {
          context.log(
            `${correlationId} Saving ${sets.length} sets to Redis cache`
          );
          await redisCacheService.set(
            cacheKey,
            formatCacheEntry(sets, setsTtl),
            setsTtl
          );
        }
      } catch (error: any) {
        context.log(
          `${correlationId} Error fetching from Scrydex API: ${error.message}`
        );
        monitoring.trackDependency(
          "Scrydex API",
          "HTTP",
          "GET /expansions",
          Date.now() - apiStartTime,
          false,
          {
            functionName: "GetSetList",
            correlationId,
            error: error.message,
          }
        );
        throw error;
      }
    }

    if (!sets || sets.length === 0) {
      context.log(`${correlationId} No sets found for language: ${language}`);
      const errorResponse: ApiResponse<null> = {
        status: 404,
        error: `No sets found for language: ${language}`,
        timestamp: new Date().toISOString(),
      };
      return { jsonBody: errorResponse, status: 404 };
    }

    const enhancedSets: EnhancedSet[] = sets.map((set) => {
      const enhanced: EnhancedSet = { ...set };

      if (set.releaseDate) {
        const releaseDate = new Date(set.releaseDate);
        if (!Number.isNaN(releaseDate.getTime())) {
          enhanced.releaseYear = releaseDate.getFullYear();
          const twoYearsAgo = new Date();
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
          enhanced.isRecent = releaseDate > twoYearsAgo;
        }
      }

      return enhanced;
    });

    enhancedSets.sort((a, b) => {
      if (!a.releaseDate || !b.releaseDate) return 0;
      return (
        new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
      );
    });

    let finalSets: EnhancedSet[];
    let paginationInfo: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };

    if (returnAll) {
      finalSets = enhancedSets;
      paginationInfo = {
        page: 1,
        pageSize: enhancedSets.length,
        totalCount: enhancedSets.length,
        totalPages: 1,
      };
      context.log(
        `${correlationId} Returning ALL ${enhancedSets.length} sets (all=true parameter)`
      );
    } else {
      const totalCount = enhancedSets.length;
      const totalPages = Math.ceil(totalCount / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalCount);
      finalSets = enhancedSets.slice(startIndex, endIndex);

      paginationInfo = { page, pageSize, totalCount, totalPages };

      context.log(
        `${correlationId} Returning page ${page}/${totalPages} with ${finalSets.length} sets`
      );
    }

    const response: ApiResponse<{
      sets: EnhancedSet[];
      pagination: typeof paginationInfo;
    }> = {
      status: 200,
      data: { sets: finalSets, pagination: paginationInfo },
      timestamp: new Date().toISOString(),
      cached: cacheHit,
      cacheAge: cacheHit ? cacheAge : undefined,
    };

    const duration = Date.now() - startTime;
    monitoring.trackMetric("function.duration", duration, {
      functionName: "GetSetList",
      correlationId,
      cached: cacheHit,
      resultCount: finalSets.length,
    });
    monitoring.trackEvent("function.success", {
      functionName: "GetSetList",
      correlationId,
      duration,
      cached: cacheHit,
      resultCount: finalSets.length,
      language,
      returnAll,
    });

    context.log(
      `${correlationId} Successfully returning ${finalSets.length} Scrydex sets (${duration}ms)`
    );

    return { jsonBody: response, status: response.status };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    context.log(`${correlationId} Error in getSetList: ${error.message}`);

    monitoring.trackException(error, {
      functionName: "GetSetList",
      correlationId,
      duration,
    });
    monitoring.trackEvent("function.error", {
      functionName: "GetSetList",
      correlationId,
      duration,
      errorMessage: error.message,
    });

    const errorResponse = handleError(error, "GetSetList");
    return { jsonBody: errorResponse, status: errorResponse.status };
  }
}
