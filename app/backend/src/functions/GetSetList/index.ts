import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ApiResponse } from "../../models/ApiResponse";
import { getSetListCacheKey, formatCacheEntry, parseCacheEntry, getCacheAge } from "../../utils/cacheUtils";
import { handleError } from "../../utils/errorUtils";
import { cosmosDbService, redisCacheService, pokeDataApiService } from "../../index";

// PokeData Set interface (from PokeDataApiService)
interface PokeDataSet {
    code: string | null;
    id: number;
    language: 'ENGLISH' | 'JAPANESE';
    name: string;
    release_date: string;
}

// Enhanced set interface with additional metadata
interface EnhancedPokeDataSet extends PokeDataSet {
    cardCount?: number;
    releaseYear?: number;
    isRecent?: boolean;
}

export async function getSetList(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const correlationId = `[setlist-${Date.now()}]`;
    
    try {
        context.log(`${correlationId} Processing PokeData-first request for set list`);
        
        // Parse query parameters
        const language = request.query.get("language") || "ENGLISH";
        const includeCardCounts = request.query.get("includeCardCounts") === "true";
        const forceRefresh = request.query.get("forceRefresh") === "true";
        const returnAll = request.query.get("all") === "true";
        const page = parseInt(request.query.get("page") || "1");
        const pageSize = parseInt(request.query.get("pageSize") || "100");
        
        // Long TTL for sets since they don't change frequently
        const setsTtl = parseInt(process.env.CACHE_TTL_SETS || "604800"); // 7 days default
        
        context.log(`${correlationId} Parameters: language=${language}, includeCardCounts=${includeCardCounts}, returnAll=${returnAll}, page=${page}, pageSize=${pageSize}`);
        
        // Check Redis cache first (if enabled and not forcing refresh)
        const cacheKey = `${getSetListCacheKey()}-pokedata-${language}`;
        let sets: PokeDataSet[] | null = null;
        let cacheHit = false;
        let cacheAge = 0;
        
        if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
            context.log(`${correlationId} Checking Redis cache with key: ${cacheKey}`);
            const cachedEntry = await redisCacheService.get<{ data: PokeDataSet[]; timestamp: number; ttl: number }>(cacheKey);
            sets = parseCacheEntry<PokeDataSet[]>(cachedEntry);
            
            if (sets) {
                context.log(`${correlationId} Cache hit for PokeData set list (${sets.length} sets)`);
                cacheHit = true;
                cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;
            } else {
                context.log(`${correlationId} Cache miss for PokeData set list`);
            }
        }
        
        // If not in cache, fetch from PokeData API
        if (!sets) {
            context.log(`${correlationId} Fetching sets from PokeData API`);
            const startTime = Date.now();
            
            try {
                const allSets = await pokeDataApiService.getAllSets();
                const apiTime = Date.now() - startTime;
                
                // Filter by language if specified
                sets = allSets.filter(set => 
                    language === "ALL" || set.language === language
                );
                
                context.log(`${correlationId} PokeData API returned ${allSets.length} total sets, ${sets.length} for language ${language} (${apiTime}ms)`);
                
                // Save to cache if found
                if (sets && sets.length > 0 && process.env.ENABLE_REDIS_CACHE === "true") {
                    context.log(`${correlationId} Saving ${sets.length} sets to Redis cache`);
                    await redisCacheService.set(cacheKey, formatCacheEntry(sets, setsTtl), setsTtl);
                }
            } catch (error: any) {
                context.log(`${correlationId} Error fetching from PokeData API: ${error.message}`);
                throw error;
            }
        }
        
        if (!sets || sets.length === 0) {
            context.log(`${correlationId} No sets found for language: ${language}`);
            const errorResponse: ApiResponse<null> = {
                status: 404,
                error: `No sets found for language: ${language}`,
                timestamp: new Date().toISOString()
            };
            
            return {
                jsonBody: errorResponse,
                status: 404
            };
        }
        
        // Enhance sets with additional metadata
        const enhancedSets: EnhancedPokeDataSet[] = sets.map(set => {
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
            return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
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
                totalPages: 1
            };
            context.log(`${correlationId} Returning ALL ${enhancedSets.length} sets (all=true parameter)`);
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
                totalPages
            };
            
            context.log(`${correlationId} Returning page ${page}/${totalPages} with ${finalSets.length} sets (${startIndex + 1}-${startIndex + finalSets.length} of ${totalCount})`);
        }
        
        // If card counts are requested, we could fetch them here
        // For now, we'll skip this to maintain fast response times
        // This could be added as a separate endpoint or background process
        if (includeCardCounts) {
            context.log(`${correlationId} Card counts requested but not implemented yet for performance reasons`);
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
                pagination: paginationInfo
            },
            timestamp: new Date().toISOString(),
            cached: cacheHit,
            cacheAge: cacheHit ? cacheAge : undefined
        };
        
        context.log(`${correlationId} Successfully returning ${finalSets.length} PokeData sets`);
        
        return { 
            jsonBody: response,
            status: response.status
        };
    } catch (error: any) {
        context.log(`${correlationId} Error in getSetList: ${error.message}`);
        const errorResponse = handleError(error, "GetSetList");
        return {
            jsonBody: errorResponse,
            status: errorResponse.status
        };
    }
}