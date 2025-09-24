import axios from 'axios';
import { EnhancedPriceData } from '../models/Card';
import { CreditMonitoringService, CreditStatus } from './CreditMonitoringService';

// Define interfaces for PokeData API responses
interface PokeDataSet {
    code: string | null;
    id: number;
    language: 'ENGLISH' | 'JAPANESE';
    name: string;
    release_date: string;
}

interface PokeDataCard {
    id: number;
    language: string;
    name: string;
    num: string;
    release_date: string;
    secret: boolean;
    set_code: string | null;
    set_id: number;
    set_name: string;
}

interface PokeDataPricing {
    id: number;
    language: string;
    name: string;
    num: string;
    pricing: Record<string, {
        currency: string;
        value: number;
    }>;
}

export interface IPokeDataApiService {
    // Set related methods
    getAllSets(): Promise<PokeDataSet[]>;
    getSetIdByCode(setCode: string): Promise<number | null>;
    
    // Card related methods
    getCardsInSet(setId: number): Promise<PokeDataCard[]>;
    getCardsInSetByCode(setCode: string): Promise<PokeDataCard[]>;
    getCardIdBySetAndNumber(setId: number, cardNumber: string): Promise<number | null>;
    getCardIdBySetCodeAndNumber(setCode: string, cardNumber: string): Promise<number | null>;
    
    // Pricing methods
    getCardPricingById(pokeDataId: number): Promise<any>;
    getCardPricing(cardId: string, pokeDataId?: number): Promise<EnhancedPriceData | null>;
    
    // NEW: Full card details with pricing
    getFullCardDetailsById(pokeDataId: number): Promise<any>;
    
    // NEW: Credit monitoring methods
    checkCreditsRemaining(): Promise<{ creditsRemaining: number; status: string } | null>;
}

export class PokeDataApiService implements IPokeDataApiService {
    private apiKey: string;
    private baseUrl: string;
    private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    private creditMonitoringService: CreditMonitoringService;
    
    // Cache for sets and cards to minimize API calls
    private setsCache: {
        data: PokeDataSet[] | null;
        timestamp: number;
    } = { data: null, timestamp: 0 };
    
    private cardsCache: Record<number, {
        data: PokeDataCard[] | null;
        timestamp: number;
    }> = {};
    
    // Code to ID mapping cache
    private setCodeToIdMap: Record<string, number> = {};
    
    constructor(apiKey: string, baseUrl: string = 'https://www.pokedata.io/v0') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.creditMonitoringService = new CreditMonitoringService();
    }
    
    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }
    
    private isCacheValid(timestamp: number): boolean {
        return (Date.now() - timestamp) < this.cacheTTL;
    }
    
    private extractCardIdentifiers(cardId: string): { setCode: string, number: string } {
        // Extract the set code portion (before the dash) and the numeric portion (after the dash)
        const match = cardId.match(/(.*)-(\d+.*)/);
        
        if (match) {
            return {
                setCode: match[1], // The set code (e.g., "sv8pt5")
                number: match[2]   // The card number (e.g., "155")
            };
        }
        
        // Fallback if the format doesn't match
        return {
            setCode: '',
            number: cardId
        };
    }
    
    /**
     * Get all available sets from PokeData API
     * Caches results to minimize API calls (5 credits per call)
     */
    async getAllSets(): Promise<PokeDataSet[]> {
        console.log(`[PokeDataApiService] Getting all sets`);
        
        // Check cache first
        if (this.setsCache.data && this.isCacheValid(this.setsCache.timestamp)) {
            console.log(`[PokeDataApiService] Using cached sets data`);
            return this.setsCache.data;
        }
        
        try {
            const url = `${this.baseUrl}/sets`;
            
            console.log(`[PokeDataApiService] Making request to: ${url}`);
            
            const response = await axios.get(url, { headers: this.getHeaders() });
            
            if (Array.isArray(response.data)) {
                const sets = response.data as PokeDataSet[];
                console.log(`[PokeDataApiService] Retrieved ${sets.length} sets`);
                
                // Update cache
                this.setsCache = {
                    data: sets,
                    timestamp: Date.now()
                };
                
                // Update code to ID mapping
                sets.forEach(set => {
                    if (set.code) {
                        this.setCodeToIdMap[set.code.toLowerCase()] = set.id;
                    }
                });
                
                return sets;
            }
            
            console.log(`[PokeDataApiService] Unexpected response format for sets`);
            return [];
        } catch (error: any) {
            console.error(`[PokeDataApiService] Error getting sets: ${error.message}`);
            
            if (error.response) {
                console.error(`[PokeDataApiService] Response status: ${error.response.status}`);
                console.error(`[PokeDataApiService] Response data:`, error.response.data);
            }
            
            return [];
        }
    }
    
    /**
     * Get the numeric ID for a set using its code
     * This is a required step for subsequent API calls
     */
    async getSetIdByCode(setCode: string): Promise<number | null> {
        const normalizedCode = setCode.toLowerCase();
        
        // Check if we already have the mapping cached
        if (this.setCodeToIdMap[normalizedCode]) {
            return this.setCodeToIdMap[normalizedCode];
        }
        
        // If not in cache, fetch all sets
        const sets = await this.getAllSets();
        
        // Look for the set with matching code
        const matchingSet = sets.find(set => 
            set.code && set.code.toLowerCase() === normalizedCode
        );
        
        if (matchingSet) {
            // Cache the mapping
            this.setCodeToIdMap[normalizedCode] = matchingSet.id;
            return matchingSet.id;
        }
        
        console.log(`[PokeDataApiService] No set found with code: ${setCode}`);
        return null;
    }
    
    /**
     * Get all cards in a set using the set's numeric ID
     * @param setId The numeric ID of the set
     */
    async getCardsInSet(setId: number): Promise<PokeDataCard[]> {
        console.log(`[PokeDataApiService] Getting cards for set ID: ${setId}`);
        
        // Check cache first
        if (this.cardsCache[setId]?.data && this.isCacheValid(this.cardsCache[setId].timestamp)) {
            console.log(`[PokeDataApiService] Using cached cards data for set ID: ${setId}`);
            return this.cardsCache[setId].data || [];
        }
        
        try {
            const url = `${this.baseUrl}/set`;
            const params = {
                set_id: setId
            };
            
            console.log(`[PokeDataApiService] Making request to: ${url}`);
            console.log(`[PokeDataApiService] With params:`, params);
            
            const response = await axios.get(url, { 
                params,
                headers: this.getHeaders() 
            });
            
            if (response.data && Array.isArray(response.data)) {
                const cards = response.data as PokeDataCard[];
                console.log(`[PokeDataApiService] Found ${cards.length} cards for set ID ${setId}`);
                
                // Update cache
                this.cardsCache[setId] = {
                    data: cards,
                    timestamp: Date.now()
                };
                
                return cards;
            }
            
            console.log(`[PokeDataApiService] Unexpected response format for set cards`);
            return [];
        } catch (error: any) {
            console.error(`[PokeDataApiService] Error getting cards for set ID ${setId}: ${error.message}`);
            if (error.response) {
                console.error(`[PokeDataApiService] Response status: ${error.response.status}`);
                console.error(`[PokeDataApiService] Response data:`, error.response.data);
            }
            return [];
        }
    }
    
    /**
     * Get all cards in a set using the set's code
     * This is a convenience method that handles the set ID lookup
     * @param setCode The set code (e.g., "sv8pt5")
     */
    async getCardsInSetByCode(setCode: string): Promise<PokeDataCard[]> {
        console.log(`[PokeDataApiService] Getting cards for set code: ${setCode}`);
        
        // First get the set ID
        const setId = await this.getSetIdByCode(setCode);
        
        if (setId === null) {
            console.log(`[PokeDataApiService] Couldn't find set ID for code: ${setCode}`);
            return [];
        }
        
        // Then get the cards using the ID
        return this.getCardsInSet(setId);
    }
    
    /**
     * Find a card's numeric ID using its set ID and card number
     * @param setId The numeric ID of the set
     * @param cardNumber The card number within the set
     */
    async getCardIdBySetAndNumber(setId: number, cardNumber: string): Promise<number | null> {
        console.log(`[PokeDataApiService] Looking for card with number ${cardNumber} in set ID ${setId}`);
        
        // Get all cards in the set
        const cards = await this.getCardsInSet(setId);
        
        // Find matching card by number 
        // Note: In PokeData API, 'num' is the card number (like "076")
        // While 'id' is the unique numeric ID used for API operations
        const matchingCard = cards.find(card => 
            card.num && card.num === cardNumber
        );
        
        if (matchingCard) {
            console.log(`[PokeDataApiService] Found card ID ${matchingCard.id} for number ${cardNumber} in set ID ${setId}`);
            return matchingCard.id;
        }
        
        console.log(`[PokeDataApiService] No matching card found for number ${cardNumber} in set ID ${setId}`);
        return null;
    }
    
    /**
     * Find a card's numeric ID using its set code and card number
     * This is a convenience method that handles the set ID lookup internally
     * @param setCode The set code (e.g., "PRE")
     * @param cardNumber The card number within the set
     */
    async getCardIdBySetCodeAndNumber(setCode: string, cardNumber: string): Promise<number | null> {
        console.log(`[PokeDataApiService] Looking for card with number ${cardNumber} in set code ${setCode}`);
        
        // First get the set ID
        const setId = await this.getSetIdByCode(setCode);
        
        if (setId === null) {
            console.log(`[PokeDataApiService] Couldn't find set ID for code: ${setCode}`);
            return null;
        }
        
        // Then get the card ID using the numeric set ID
        return this.getCardIdBySetAndNumber(setId, cardNumber);
    }
    
    /**
     * Get full card details with pricing using PokeData's numeric ID
     * This returns the complete response including card details AND pricing
     * @param pokeDataId The numeric ID of the card in PokeData's system
     */
    async getFullCardDetailsById(pokeDataId: number): Promise<any> {
        console.log(`[PokeDataApiService] Getting full card details for PokeData ID: ${pokeDataId}`);
        
        try {
            const url = `${this.baseUrl}/pricing`;
            const params = {
                id: pokeDataId,
                asset_type: 'CARD'
            };
            
            console.log(`[PokeDataApiService] Making request to: ${url}`);
            console.log(`[PokeDataApiService] With params:`, params);
            
            const response = await axios.get(url, { 
                params,
                headers: this.getHeaders() 
            });
            
            if (response.data && response.data.pricing) {
                console.log(`[PokeDataApiService] Successfully retrieved full card details for ID ${pokeDataId}`);
                return response.data; // Return the FULL response, not just pricing
            }
            
            console.log(`[PokeDataApiService] No card data found for ID ${pokeDataId}`);
            return null;
        } catch (error: any) {
            console.error(`[PokeDataApiService] Error getting full card details for ID ${pokeDataId}: ${error.message}`);
            if (error.response) {
                console.error(`[PokeDataApiService] Response status: ${error.response.status}`);
                console.error(`[PokeDataApiService] Response data:`, error.response.data);
            }
            return null;
        }
    }
    
    /**
     * Get pricing data using PokeData's numeric ID (legacy method)
     * @param pokeDataId The numeric ID of the card in PokeData's system
     */
    async getCardPricingById(pokeDataId: number): Promise<any> {
        console.log(`[PokeDataApiService] Getting pricing for PokeData ID: ${pokeDataId}`);
        
        try {
            const url = `${this.baseUrl}/pricing`;
            const params = {
                id: pokeDataId,
                asset_type: 'CARD'
            };
            
            console.log(`[PokeDataApiService] Making request to: ${url}`);
            console.log(`[PokeDataApiService] With params:`, params);
            
            const response = await axios.get(url, { 
                params,
                headers: this.getHeaders() 
            });
            
            if (response.data && response.data.pricing) {
                console.log(`[PokeDataApiService] Successfully retrieved pricing data for ID ${pokeDataId}`);
                return response.data.pricing;
            }
            
            console.log(`[PokeDataApiService] No pricing data found for ID ${pokeDataId}`);
            return null;
        } catch (error: any) {
            console.error(`[PokeDataApiService] Error getting pricing for ID ${pokeDataId}: ${error.message}`);
            if (error.response) {
                console.error(`[PokeDataApiService] Response status: ${error.response.status}`);
                console.error(`[PokeDataApiService] Response data:`, error.response.data);
            }
            return null;
        }
    }
    
    /**
     * Get card pricing using the Pokemon TCG API card ID (e.g., "sv8pt5-161")
     * This method will:
     * 1. Try to use provided pokeDataId if available
     * 2. If not, try to find the PokeData ID using the set code and card number
     * 3. Fall back to legacy method if needed (just using card number)
     */
    async getCardPricing(cardId: string, pokeDataId?: number): Promise<EnhancedPriceData | null> {
        console.log(`[PokeDataApiService] Getting enhanced pricing for card: ${cardId}`);
        
        // If pokeDataId is provided, use it directly
        if (pokeDataId) {
            console.log(`[PokeDataApiService] Using provided PokeData ID: ${pokeDataId}`);
            const pricing = await this.getCardPricingById(pokeDataId);
            if (pricing) {
                return this.mapApiPricingToEnhancedPriceData({ pricing });
            }
            return null;
        }
        
        // Extract identifiers from card ID
        const identifiers = this.extractCardIdentifiers(cardId);
        
        // If we have a valid set code, try to find the card ID the proper way
        if (identifiers.setCode) {
            console.log(`[PokeDataApiService] Attempting to find PokeData ID for set ${identifiers.setCode} card ${identifiers.number}`);
            
            try {
                // Step 1: Get the set ID
                const setId = await this.getSetIdByCode(identifiers.setCode);
                
                if (setId) {
                    // Step 2: Get the card ID using set ID and card number
                    const cardPokeDataId = await this.getCardIdBySetAndNumber(setId, identifiers.number);
                    
                    if (cardPokeDataId) {
                        // Step 3: Get pricing using the found ID
                        console.log(`[PokeDataApiService] Found PokeData ID ${cardPokeDataId} for card ${cardId}`);
                        const pricing = await this.getCardPricingById(cardPokeDataId);
                        
                        if (pricing) {
                            return this.mapApiPricingToEnhancedPriceData({ pricing });
                        }
                    }
                }
            } catch (error: any) {
                console.error(`[PokeDataApiService] Error in ID-based lookup for ${cardId}: ${error.message}`);
            }
        }
        
        // Fall back to the legacy method if the proper approach failed
        console.log(`[PokeDataApiService] Falling back to legacy method using card number: ${identifiers.number}`);
        
        try {
            const url = `${this.baseUrl}/pricing`;
            const params = {
                id: identifiers.number,
                asset_type: 'CARD'
            };
            
            console.log(`[PokeDataApiService] Making request to: ${url}`);
            console.log(`[PokeDataApiService] With params:`, params);
            
            const response = await axios.get(url, { 
                params,
                headers: this.getHeaders() 
            });
            
            console.log(`[PokeDataApiService] API response status: ${response.status}`);
            
            if (response.data && response.data.name) {
                console.log(`[PokeDataApiService] Retrieved data for card: ${response.data.name}`);
                
                // Add warning if the card appears to be from a different set than expected
                if (identifiers.setCode && !response.data.name.toLowerCase().includes(identifiers.setCode.toLowerCase())) {
                    console.warn(`[PokeDataApiService] Warning: Card from different set than requested. Expected set code ${identifiers.setCode}, got data for ${response.data.name}`);
                }
            }
            
            return this.mapApiPricingToEnhancedPriceData(response.data);
        } catch (error: any) {
            console.error(`[PokeDataApiService] Error in fallback pricing lookup for card ${cardId}: ${error.message}`);
            
            if (error.response) {
                console.error(`[PokeDataApiService] Response status: ${error.response.status}`);
                console.error(`[PokeDataApiService] Response data:`, error.response.data);
            }
            
            return null;
        }
    }
    
    // Helper methods for mapping API responses to our models
    public mapApiPricingToEnhancedPriceData(apiPricing: any): EnhancedPriceData | null {
        if (!apiPricing) return null;
        
        console.log(`[PokeDataApiService] Mapping API pricing data:`, JSON.stringify(apiPricing).substring(0, 200) + '...');
        
        const enhancedPricing: EnhancedPriceData = {};
        
        // Initialize with empty objects for PSA and CGC grades
        const psaGrades: Record<string, { value: number }> = {};
        const cgcGradesObj: Record<string, { value: number }> = {};
        
        // Process PSA grades
        for (let i = 1; i <= 10; i++) {
            const grade = i === 10 ? '10.0' : `${i}.0`;
            const key = `PSA ${grade}`;
            
            if (apiPricing.pricing && apiPricing.pricing[key] && apiPricing.pricing[key].value > 0) {
                const gradeKey = String(i); // Store as "1", "2", etc.
                psaGrades[gradeKey] = { 
                    value: apiPricing.pricing[key].value
                };
            }
        }
        
        // Process CGC grades (including half grades)
        const cgcGradeValues = ['1.0', '2.0', '3.0', '4.0', '5.0', '6.0', '7.0', '7.5', '8.0', '8.5', '9.0', '9.5', '10.0'];
        
        cgcGradeValues.forEach(grade => {
            const key = `CGC ${grade}`;
            
            if (apiPricing.pricing && apiPricing.pricing[key] && apiPricing.pricing[key].value > 0) {
                // Convert "8.5" to "8_5" for storage
                const gradeKey = grade.replace('.', '_');
                cgcGradesObj[gradeKey] = { 
                    value: apiPricing.pricing[key].value
                };
            }
        });
        
        // Process eBay Raw pricing
        if (apiPricing.pricing && apiPricing.pricing['eBay Raw'] && apiPricing.pricing['eBay Raw'].value > 0) {
            enhancedPricing.ebayRaw = { 
                value: apiPricing.pricing['eBay Raw'].value
            };
        }
        
        // Only add grade objects if they have data
        if (Object.keys(psaGrades).length > 0) {
            enhancedPricing.psaGrades = psaGrades;
        }
        
        if (Object.keys(cgcGradesObj).length > 0) {
            enhancedPricing.cgcGrades = cgcGradesObj;
        }
        
        return Object.keys(enhancedPricing).length > 0 ? enhancedPricing : null;
    }

    /**
     * Check remaining PokeData API credits
     * This endpoint is FREE - no credits consumed
     */
    async checkCreditsRemaining(): Promise<{ creditsRemaining: number; status: string } | null> {
        console.log(`[PokeDataApiService] Checking remaining API credits`);
        
        try {
            const url = `${this.baseUrl}/account`;
            
            console.log(`[PokeDataApiService] Making credit check request to: ${url}`);
            
            const response = await axios.get(url, { headers: this.getHeaders() });
            
            if (response.data && typeof response.data.credits === 'number') {
                const creditsRemaining = response.data.credits;
                const creditLimit = response.data.credits_limit || undefined;
                
                console.log(`[PokeDataApiService] Current credits: ${creditsRemaining}${creditLimit ? ` / ${creditLimit}` : ''}`);
                
                // Determine status based on remaining credits
                let status = 'healthy';
                if (creditsRemaining <= 0) {
                    status = 'exhausted';
                } else if (creditLimit) {
                    const percentage = creditsRemaining / creditLimit;
                    if (percentage <= 0.05) status = 'critical';
                    else if (percentage <= 0.1) status = 'critical';
                    else if (percentage <= 0.2) status = 'warning';
                } else {
                    // Without knowing limit, use absolute thresholds
                    if (creditsRemaining <= 100) status = 'critical';
                    else if (creditsRemaining <= 500) status = 'warning';
                }
                
                return {
                    creditsRemaining,
                    status
                };
            }
            
            console.log(`[PokeDataApiService] Unexpected response format for account endpoint:`, response.data);
            return null;
        } catch (error: any) {
            console.error(`[PokeDataApiService] Error checking credits: ${error.message}`);
            
            if (error.response) {
                console.error(`[PokeDataApiService] Response status: ${error.response.status}`);
                console.error(`[PokeDataApiService] Response data:`, error.response.data);
            }
            
            return null;
        }
    }

    /**
     * Enhanced API call wrapper with credit monitoring
     * Automatically checks credits on specific error conditions
     */
    private async makeApiCallWithCreditCheck(
        operation: string,
        apiCall: () => Promise<any>,
        correlationId: string = `api-${Date.now()}`
    ): Promise<any> {
        try {
            return await apiCall();
        } catch (error: any) {
            // Check if this might be a credit-related error
            const shouldCheckCredits = this.shouldCheckCreditsForError(error);
            
            if (shouldCheckCredits) {
                console.warn(`${correlationId} API error detected, checking credits: ${error.message}`);
                
                // Check remaining credits
                const creditStatus = await this.checkCreditsRemaining();
                
                if (creditStatus) {
                    // Process credit status with monitoring service
                    await this.creditMonitoringService.processCreditStatus(
                        creditStatus.creditsRemaining,
                        operation,
                        'PokeDataApiService',
                        correlationId
                    );
                    
                    // Enhanced error message with credit information
                    if (creditStatus.status === 'exhausted') {
                        const enhancedError = new Error(
                            `API call failed due to exhausted PokeData credits (${creditStatus.creditsRemaining} remaining). Original error: ${error.message}`
                        );
                        (enhancedError as any).originalError = error;
                        (enhancedError as any).creditStatus = creditStatus;
                        throw enhancedError;
                    } else if (creditStatus.status === 'critical' || creditStatus.status === 'warning') {
                        console.warn(`${correlationId} 🟡 LOW CREDITS WARNING: ${creditStatus.creditsRemaining} PokeData credits remaining (${creditStatus.status})`);
                    }
                }
            }
            
            // Re-throw original error
            throw error;
        }
    }

    /**
     * Determine if we should check credits based on the error
     */
    private shouldCheckCreditsForError(error: any): boolean {
        if (!error.response) return false;
        
        const status = error.response.status;
        
        // Check credits on these status codes that might indicate quota issues
        return [401, 403, 404, 429].includes(status);
    }
}
