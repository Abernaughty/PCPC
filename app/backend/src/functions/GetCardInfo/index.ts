import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { ApiResponse } from "../../models/ApiResponse";
import { getCardCacheKey, formatCacheEntry, parseCacheEntry, getCacheAge } from "../../utils/cacheUtils";
import { handleError, createNotFoundError, createBadRequestError } from "../../utils/errorUtils";
import { 
    cosmosDbService, 
    redisCacheService, 
    pokeDataApiService 
} from "../../index";
import { pokeDataToTcgMappingService } from "../../services/PokeDataToTcgMappingService";
import { PokemonTcgApiService } from "../../services/PokemonTcgApiService";
import { ImageEnhancementService } from "../../services/ImageEnhancementService";

// Initialize services for PokeData-first architecture
const pokemonTcgApiService = new PokemonTcgApiService(process.env.POKEMON_TCG_API_KEY || '');
const imageEnhancementService = new ImageEnhancementService(
    pokeDataToTcgMappingService,
    pokemonTcgApiService
);

// Enhanced card structure for PokeData-first approach
interface PokeDataFirstCard {
    id: string;
    source: "pokedata";
    pokeDataId: number;
    setId: number;
    setName: string;
    setCode: string;
    cardName: string;
    cardNumber: string;
    secret: boolean;
    language: string;
    releaseDate: string;
    pricing: {
        psa?: { [grade: string]: number };
        cgc?: { [grade: string]: number };
        tcgPlayer?: number;
        ebayRaw?: number;
        pokeDataRaw?: number;
    };
    images?: {
        small: string;
        large: string;
    };
    enhancement?: {
        tcgSetId: string;
        tcgCardId: string;
        metadata?: {
            hp?: string;
            types?: string[];
            rarity?: string;
        };
        enhancedAt: string;
    };
    lastUpdated: string;
}

/**
 * PokeData-First GetCardInfo Function
 * 
 * This function implements the new PokeData-first architecture:
 * 1. Expects PokeData card ID and set ID as path parameters (/api/sets/{setId}/cards/{cardId})
 * 2. Gets comprehensive pricing data from PokeData API (guaranteed)
 * 3. Enhances with Pokemon TCG images when mapping exists (optional)
 * 4. Returns complete card data with pricing always available
 */
export async function getCardInfo(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const timestamp = Date.now();
    const correlationId = `[pokedata-card-${request.params.cardId}-${timestamp}]`;
    const startTime = Date.now();
    
    try {
        // Get PokeData card ID and setId from route parameters
        const pokeDataCardId = request.params.cardId;
        const setIdParam = request.params.setId;
        
        if (!pokeDataCardId) {
            context.log(`${correlationId} ERROR: Missing PokeData card ID in request`);
            const errorResponse = createNotFoundError("PokeData Card ID", "missing", "GetCardInfo");
            return {
                jsonBody: errorResponse,
                status: errorResponse.status
            };
        }
        
        if (!setIdParam) {
            context.log(`${correlationId} ERROR: Missing setId path parameter`);
            const errorResponse = createNotFoundError("Set ID", "missing", "GetCardInfo");
            return {
                jsonBody: errorResponse,
                status: errorResponse.status
            };
        }
        
        // Validate setId is numeric
        const setId = parseInt(setIdParam);
        if (isNaN(setId)) {
            context.log(`${correlationId} ERROR: Invalid setId path parameter format: ${setIdParam}`);
            const errorResponse = createBadRequestError(
                `Invalid setId format in path. Expected numeric ID, got: ${setIdParam}`,
                "GetCardInfo"
            );
            return {
                jsonBody: errorResponse,
                status: errorResponse.status
            };
        }
        
        // Validate that it's a numeric PokeData ID
        const cardIdNum = parseInt(pokeDataCardId);
        if (isNaN(cardIdNum)) {
            context.log(`${correlationId} ERROR: Invalid PokeData card ID format: ${pokeDataCardId}`);
            const errorResponse = createBadRequestError(
                `Invalid PokeData card ID format. Expected numeric ID, got: ${pokeDataCardId}`,
                "GetCardInfo"
            );
            return {
                jsonBody: errorResponse,
                status: errorResponse.status
            };
        }
        
        context.log(`${correlationId} Processing PokeData-first request for card ID: ${pokeDataCardId}, setId: ${setId}`);
        
        // Parse query parameters
        const forceRefresh = request.query.get("forceRefresh") === "true";
        const cardsTtl = parseInt(process.env.CACHE_TTL_CARDS || "86400"); // 24 hours default
        
        context.log(`${correlationId} Request parameters - forceRefresh: ${forceRefresh}, TTL: ${cardsTtl}`);
        
        // Check cache first (if enabled and not forcing refresh)
        const cacheKey = getCardCacheKey(pokeDataCardId);
        let card: PokeDataFirstCard | null = null;
        let cacheHit = false;
        let cacheAge = 0;
        let cacheStartTime = Date.now();
        
        if (!forceRefresh && process.env.ENABLE_REDIS_CACHE === "true") {
            context.log(`${correlationId} Checking Redis cache for key: ${cacheKey}`);
            const cachedEntry = await redisCacheService.get<{ data: PokeDataFirstCard; timestamp: number; ttl: number }>(cacheKey);
            card = parseCacheEntry<PokeDataFirstCard>(cachedEntry);
            
            const cacheTime = Date.now() - cacheStartTime;
            
            if (card) {
                context.log(`${correlationId} Cache HIT for PokeData card: ${pokeDataCardId} (${cacheTime}ms)`);
                cacheHit = true;
                cacheAge = cachedEntry ? getCacheAge(cachedEntry.timestamp) : 0;
            } else {
                context.log(`${correlationId} Cache MISS for PokeData card: ${pokeDataCardId} (${cacheTime}ms)`);
            }
        } else {
            context.log(`${correlationId} Skipping cache - forceRefresh: ${forceRefresh}, Redis enabled: ${process.env.ENABLE_REDIS_CACHE}`);
        }
        
        // If not in cache, check Cosmos DB
        let dbStartTime = Date.now();
        if (!card) {
            context.log(`${correlationId} Checking Cosmos DB for PokeData card: ${pokeDataCardId}, setId: ${setId}`);
            const dbCard = await cosmosDbService.getCard(pokeDataCardId, setId);
            
            const dbTime = Date.now() - dbStartTime;
            
            if (dbCard) {
                // Convert from stored format to PokeDataFirstCard format if needed
                card = dbCard as unknown as PokeDataFirstCard;
                context.log(`${correlationId} Database HIT for PokeData card: ${pokeDataCardId} (${dbTime}ms)`);
                
                // Check if card already has complete image data
                if (card.images && card.images.small && card.images.large) {
                    context.log(`${correlationId} Card already has complete images - skipping enhancement`);
                    context.log(`${correlationId} Images found: small=${!!card.images.small}, large=${!!card.images.large}`);
                    
                    // Calculate total time and return immediately
                    const totalTime = Date.now() - startTime;
                    context.log(`${correlationId} Returning cached card with images - Total time: ${totalTime}ms`);
                    
                    const response: ApiResponse<PokeDataFirstCard> = {
                        status: 200,
                        data: card,
                        timestamp: new Date().toISOString(),
                        cached: false, // From database, not Redis cache
                        cacheAge: undefined
                    };
                    
                    return { 
                        jsonBody: response,
                        status: response.status,
                        headers: { "Cache-Control": `public, max-age=${cardsTtl}` }
                    };
                } else {
                    context.log(`${correlationId} Card missing images (small: ${!!card.images?.small}, large: ${!!card.images?.large}) - proceeding with enhancement`);
                }
            } else {
                context.log(`${correlationId} Database MISS for PokeData card: ${pokeDataCardId} (${dbTime}ms)`);
            }
        }
        
        // If not found anywhere, fetch from PokeData API
        if (!card) {
            context.log(`${correlationId} Fetching fresh data from PokeData API for card ID: ${pokeDataCardId}`);
            
            try {
                // Step 1: Get FULL card details from PokeData (PRIMARY GOAL)
                const apiStartTime = Date.now();
                const fullCardData = await pokeDataApiService.getFullCardDetailsById(cardIdNum);
                const apiTime = Date.now() - apiStartTime;
                
                if (!fullCardData) {
                    context.log(`${correlationId} ERROR: No card data found in PokeData for card ID: ${pokeDataCardId} (${apiTime}ms)`);
                    const errorResponse = createNotFoundError("PokeData Card", pokeDataCardId, "GetCardInfo");
                    return {
                        jsonBody: errorResponse,
                        status: errorResponse.status
                    };
                }
                
                context.log(`${correlationId} PokeData full card data retrieved successfully (${apiTime}ms)`);
                context.log(`${correlationId} Card: ${fullCardData.name} #${fullCardData.num} from ${fullCardData.set_name}`);
                
                // Step 2: Transform PokeData response to our format
                const transformedPricing: any = {};
                
                // Process PSA grades
                const psaGrades: { [grade: string]: number } = {};
                for (let i = 1; i <= 10; i++) {
                    const grade = i === 10 ? '10.0' : `${i}.0`;
                    const key = `PSA ${grade}`;
                    if (fullCardData.pricing[key] && fullCardData.pricing[key].value > 0) {
                        psaGrades[String(i)] = fullCardData.pricing[key].value;
                    }
                }
                if (Object.keys(psaGrades).length > 0) {
                    transformedPricing.psa = psaGrades;
                }
                
                // Process CGC grades
                const cgcGrades: { [grade: string]: number } = {};
                const cgcGradeValues = ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'];
                cgcGradeValues.forEach(grade => {
                    const key = `CGC ${grade}`;
                    if (fullCardData.pricing[key] && fullCardData.pricing[key].value > 0) {
                        const gradeKey = grade.replace('.', '_');
                        cgcGrades[gradeKey] = fullCardData.pricing[key].value;
                    }
                });
                if (Object.keys(cgcGrades).length > 0) {
                    transformedPricing.cgc = cgcGrades;
                }
                
                // Process other pricing sources
                if (fullCardData.pricing['TCGPlayer'] && fullCardData.pricing['TCGPlayer'].value > 0) {
                    transformedPricing.tcgPlayer = fullCardData.pricing['TCGPlayer'].value;
                }
                if (fullCardData.pricing['eBay Raw'] && fullCardData.pricing['eBay Raw'].value > 0) {
                    transformedPricing.ebayRaw = fullCardData.pricing['eBay Raw'].value;
                }
                if (fullCardData.pricing['Pokedata Raw'] && fullCardData.pricing['Pokedata Raw'].value > 0) {
                    transformedPricing.pokeDataRaw = fullCardData.pricing['Pokedata Raw'].value;
                }
                
                context.log(`${correlationId} Pricing transformed - ${Object.keys(transformedPricing).length} sources available`);
                
                // Step 3: Create base card structure
                card = {
                    id: pokeDataCardId, // Use clean numeric ID
                    source: "pokedata",
                    pokeDataId: cardIdNum,
                    setId: fullCardData.set_id,
                    setName: fullCardData.set_name,
                    setCode: fullCardData.set_code || '',
                    cardName: fullCardData.name,
                    cardNumber: fullCardData.num,
                    secret: fullCardData.secret || false,
                    language: fullCardData.language || 'ENGLISH',
                    releaseDate: fullCardData.release_date || '',
                    pricing: transformedPricing,
                    lastUpdated: new Date().toISOString()
                };
                
                context.log(`${correlationId} Base PokeData card structure created`);
                
            } catch (error: any) {
                context.log(`${correlationId} ERROR: PokeData API failed: ${error.message}`);
                const errorResponse = handleError(error, "GetCardInfo - PokeData API");
                return {
                    jsonBody: errorResponse,
                    status: errorResponse.status
                };
            }
        }
        
        // Step 4: Enhance with Pokemon TCG images (OPTIONAL)
        if (card) {
            context.log(`${correlationId} Attempting image enhancement for card: ${card.cardName}`);
            
            try {
                const enhancementStartTime = Date.now();
                
                // Use the ImageEnhancementService to add images
                const enhancedCard = await imageEnhancementService.enhancePricingCardWithImages({
                    id: card.pokeDataId,
                    language: card.language,
                    name: card.cardName,
                    num: card.cardNumber,
                    release_date: card.releaseDate,
                    secret: card.secret,
                    set_code: card.setCode,
                    set_id: card.setId,
                    set_name: card.setName,
                    pricing: {} // Not used in enhancement
                });
                
                const enhancementTime = Date.now() - enhancementStartTime;
                
                // Update card with enhancement data
                if (enhancedCard.images) {
                    // Ensure both small and large images with fallbacks
                    const smallImage = enhancedCard.images.small || enhancedCard.images.large || '';
                    const largeImage = enhancedCard.images.large || enhancedCard.images.small || '';
                    
                    if (smallImage && largeImage) {
                        card.images = {
                            small: smallImage,
                            large: largeImage
                        };
                        if (enhancedCard.enhancement) {
                            card.enhancement = {
                                tcgSetId: enhancedCard.enhancement.tcgSetId,
                                tcgCardId: enhancedCard.enhancement.tcgCardId,
                                metadata: enhancedCard.enhancement.metadata,
                                enhancedAt: new Date().toISOString()
                            };
                        }
                        context.log(`${correlationId} Image enhancement successful (${enhancementTime}ms)`);
                        context.log(`${correlationId} Images assigned: small=${!!smallImage}, large=${!!largeImage}`);
                        if (card.enhancement) {
                            context.log(`${correlationId} Enhanced with TCG card: ${card.enhancement.tcgCardId}`);
                        }
                    } else {
                        context.log(`${correlationId} Image enhancement failed - no valid images returned (${enhancementTime}ms)`);
                    }
                } else {
                    context.log(`${correlationId} Image enhancement skipped - no mapping available (${enhancementTime}ms)`);
                }
                
            } catch (error: any) {
                context.log(`${correlationId} Image enhancement failed (non-critical): ${error.message}`);
                // Continue without images - pricing data is still available
            }
        }
        
        // Step 5: Save to database and cache (only if newly fetched)
        if (card && !cacheHit) {
            // Save to Cosmos DB
            const saveStartTime = Date.now();
            await cosmosDbService.saveCard(card as any); // Type assertion for compatibility
            const saveTime = Date.now() - saveStartTime;
            context.log(`${correlationId} Card saved to Cosmos DB (${saveTime}ms)`);
            
            // Save to cache if enabled
            if (process.env.ENABLE_REDIS_CACHE === "true") {
                const cacheWriteStartTime = Date.now();
                await redisCacheService.set(cacheKey, formatCacheEntry(card, cardsTtl), cardsTtl);
                const cacheWriteTime = Date.now() - cacheWriteStartTime;
                context.log(`${correlationId} Card cached to Redis (${cacheWriteTime}ms)`);
            }
        }
        
        // Calculate total operation time
        const totalTime = Date.now() - startTime;
        context.log(`${correlationId} PokeData-first request complete - Total time: ${totalTime}ms`);
        
        // Return the enhanced card data
        const response: ApiResponse<PokeDataFirstCard> = {
            status: 200,
            data: card!,
            timestamp: new Date().toISOString(),
            cached: cacheHit,
            cacheAge: cacheHit ? cacheAge : undefined
        };
        
        context.log(`${correlationId} Returning PokeData-first response - cached: ${cacheHit}, pricing sources: ${Object.keys(card!.pricing).length}, images: ${!!card!.images}`);
        
        return { 
            jsonBody: response,
            status: response.status,
            headers: {
                "Cache-Control": `public, max-age=${cardsTtl}`
            }
        };
        
    } catch (error: any) {
        const totalTime = Date.now() - startTime;
        context.log(`${correlationId} ERROR after ${totalTime}ms: ${error.message}`);
        const errorResponse = handleError(error, "GetCardInfo - PokeData-First");
        return {
            jsonBody: errorResponse,
            status: errorResponse.status
        };
    }
}
