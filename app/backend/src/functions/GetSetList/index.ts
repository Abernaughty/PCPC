import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { pokeDataApiService, redisCacheService } from "../../index";
import { ApiResponse } from "../../models/ApiResponse";
import { monitoring } from "../../services/MonitoringService";
import {
  formatCacheEntry,
  getCacheAge,
  getSetListCacheKey,
  parseCacheEntry,
} from "../../utils/cacheUtils";
import { handleError } from "../../utils/errorUtils";

// PokeData Set interface (from PokeDataApiService)
interface PokeDataSet {
  code: string | null;
  id: number;
  language: "ENGLISH" | "JAPANESE";
  name: string;
  release_date: string;
}

// Enhanced set interface with additional metadata
interface EnhancedPokeDataSet extends PokeDataSet {
  cardCount?: number;
  releaseYear?: number;
  isRecent?: boolean;
}

export async function getSetList(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  // Track function invocation
  monitoring.trackEvent("function.invoked", {
    functionName: "GetSetList",
    correlationId,
  });

  try {
    context.log(
      `${correlationId} Processing PokeData-first request for set list`
    );

    // Parse query parameters
    const language = request.query.get("language") || "ENGLISH";
    const includeCardCounts = request.query.get("includeCardCounts") === "true";
    const forceRefresh = request.query.get("forceRefresh") === "true";
    const returnAll = request.query.get("all") === "true";
    const page = parseInt(request.query.get("page") || "1");
    const pageSize = parseInt(request.query.get("pageSize") || "100");

    // Long TTL for sets since they don't change frequently
    const setsTtl = parseInt(process.env.CACHE_TTL_SETS || "604800"); // 7 days default

    context.log(
      `${correlationId} Parameters: language=${language}, includeCardCounts=${includeCardCounts}, returnAll=${returnAll}, page=${page}, pageSize=${pageSize}`
    );

    // Check Redis cache first (if enabled and not forcing refresh)
    const cacheKey = `${getSetListCacheKey()}-pokedata-${language}`;
    let sets: PokeDataSet[] | null = null;
    let cacheHit = false;
    let cacheAge = 0;

    if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
      context.log(
        `${correlationId} Checking Redis cache with key: ${cacheKey}`
      );
      const cacheCheckStart = Date.now();
      const cachedEntry = await redisCacheService.get<{
        data: PokeDataSet[];
        timestamp: number;
        ttl: number;
      }>(cacheKey);
      const cacheCheckDuration = Date.now() - cacheCheckStart;

      sets = parseCacheEntry<PokeDataSet[]>(cachedEntry);

      if (sets) {
        context.log(
          `${correlationId} Cache hit for PokeData set list (${sets.length} sets)`
        );
        cacheHit = true;
        cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;

        // Track cache hit
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
        context.log(`${correlationId} Cache miss for PokeData set list`);

        // Track cache miss
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

    // If not in cache, fetch from PokeData API
    if (!sets) {
      context.log(`${correlationId} Fetching sets from PokeData API`);
      const apiStartTime = Date.now();

      try {
        const allSets = await pokeDataApiService.getAllSets();
        const apiDuration = Date.now() - apiStartTime;

        // Track API dependency
        monitoring.trackDependency(
          "PokeDataAPI",
          "HTTP",
          "GET /sets",
          apiDuration,
          true,
          {
            functionName: "GetSetList",
            correlationId,
            resultCount: allSets.length,
          }
        );

        // Filter by language if specified
        sets = allSets.filter(
          (set) => language === "ALL" || set.language === language
        );

        context.log(
          `${correlationId} PokeData API returned ${allSets.length} total sets, ${sets.length} for language ${language} (${apiDuration}ms)`
        );

        // Track metric for API call
        monitoring.trackMetric("api.pokedata.duration", apiDuration, {
          functionName: "GetSetList",
          language,
          totalSets: allSets.length,
          filteredSets: sets.length,
        });

        // Save to cache if found
        if (
          sets &&
          sets.length > 0 &&
          process.env.ENABLE_REDIS_CACHE === "true"
        ) {
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
          `${correlationId} Error fetching from PokeData API: ${error.message}`
        );

        // Track API failure
        monitoring.trackDependency(
          "PokeDataAPI",
          "HTTP",
          "GET /sets",
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

      return {
        jsonBody: errorResponse,
        status: 404,
      };
    }

    // Enhance sets with additional metadata
    const enhancedSets: EnhancedPokeDataSet[] = sets.map((set) => {
      const enhanced: EnhancedPokeDataSet = { ...set };

      // Add release year
      if (set.release_date) {
        enhanced.releaseYear = new Date(set.release_date).getFullYear();
      }

      // Mark recent sets (released in last 2 years)
      if (set.release_date) {
        const releaseDate = new Date(set.release_date);
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        enhanced.isRecent = releaseDate > twoYearsAgo;
      }

      return enhanced;
    });

    // Sort sets by release date (newest first)
    enhancedSets.sort((a, b) => {
      if (!a.release_date || !b.release_date) return 0;
      return (
        new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
      );
    });

    // Apply pagination or return all sets
    let finalSets: EnhancedPokeDataSet[];
    let paginationInfo: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };

    if (returnAll) {
      // Return all sets without pagination
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
      // Apply standard pagination
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

      context.log(
        `${correlationId} Returning page ${page}/${totalPages} with ${
          finalSets.length
        } sets (${startIndex + 1}-${
          startIndex + finalSets.length
        } of ${totalCount})`
      );
    }

    // If card counts are requested, we could fetch them here
    // For now, we'll skip this to maintain fast response times
    // This could be added as a separate endpoint or background process
    if (includeCardCounts) {
      context.log(
        `${correlationId} Card counts requested but not implemented yet for performance reasons`
      );
    }

    // Return the set list with pagination metadata
    const response: ApiResponse<{
      sets: EnhancedPokeDataSet[];
      pagination: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
      };
    }> = {
      status: 200,
      data: {
        sets: finalSets,
        pagination: paginationInfo,
      },
      timestamp: new Date().toISOString(),
      cached: cacheHit,
      cacheAge: cacheHit ? cacheAge : undefined,
    };

    const duration = Date.now() - startTime;

    // Track success metrics
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
      `${correlationId} Successfully returning ${finalSets.length} PokeData sets (${duration}ms)`
    );

    return {
      jsonBody: response,
      status: response.status,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;

    context.log(`${correlationId} Error in getSetList: ${error.message}`);

    // Track exception
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
    return {
      jsonBody: errorResponse,
      status: errorResponse.status,
    };
  }
}
