import { PokeDataToTcgMappingService } from './PokeDataToTcgMappingService';
import { PokemonTcgApiService } from './PokemonTcgApiService';

// Define interfaces for PokeData card structure
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

interface PokeDataPricing extends PokeDataCard {
    pricing: Record<string, {
        currency: string;
        value: number;
    }>;
}

// Enhanced card structure that combines PokeData with Pokemon TCG images
interface EnhancedCard extends PokeDataCard {
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
            attacks?: any[];
            weaknesses?: any[];
            resistances?: any[];
        };
        enhancedAt: string;
    };
}

interface EnhancedPricingCard extends PokeDataPricing {
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
            attacks?: any[];
            weaknesses?: any[];
            resistances?: any[];
        };
        enhancedAt: string;
    };
}

/**
 * Service for enhancing PokeData cards with Pokemon TCG images and metadata
 * This is the core service for the PokeData-first architecture
 */
export class ImageEnhancementService {
    private mappingService: PokeDataToTcgMappingService;
    private pokemonTcgService: PokemonTcgApiService;

    constructor(
        mappingService: PokeDataToTcgMappingService,
        pokemonTcgService: PokemonTcgApiService
    ) {
        this.mappingService = mappingService;
        this.pokemonTcgService = pokemonTcgService;
    }

    /**
     * Normalize card number by removing leading zeros
     * Pokemon TCG API uses numbers without leading zeros (e.g., "2" not "002")
     * @param cardNumber - The card number to normalize
     * @returns Normalized card number without leading zeros
     */
    private normalizeCardNumber(cardNumber: string): string {
        // Remove leading zeros but preserve the number
        // "002" -> "2", "047" -> "47", "247" -> "247"
        const normalized = parseInt(cardNumber, 10).toString();
        console.log(`[ImageEnhancementService] Normalized card number: "${cardNumber}" -> "${normalized}"`);
        return normalized;
    }

    /**
     * Enhance a PokeData card with Pokemon TCG images and metadata
     * @param pokeDataCard - The PokeData card to enhance
     * @param pokeDataSetId - The PokeData set ID (used for mapping)
     * @returns Enhanced card with images and metadata when available
     */
    async enhanceCardWithImages(
        pokeDataCard: PokeDataCard, 
        pokeDataSetId: number
    ): Promise<EnhancedCard> {
        console.log(`[ImageEnhancementService] Enhancing card: ${pokeDataCard.name} (ID: ${pokeDataCard.id}) from set ${pokeDataSetId}`);
        
        try {
            // Step 1: Get Pokemon TCG set ID from PokeData set ID
            const tcgSetId = this.mappingService.getTcgSetId(pokeDataSetId);
            if (!tcgSetId) {
                console.log(`[ImageEnhancementService] No TCG mapping found for PokeData set ID ${pokeDataSetId}`);
                return { ...pokeDataCard };
            }

            // Step 2: Construct Pokemon TCG card ID with normalized card number
            const normalizedCardNumber = this.normalizeCardNumber(pokeDataCard.num);
            const tcgCardId = `${tcgSetId}-${normalizedCardNumber}`;
            console.log(`[ImageEnhancementService] Attempting to fetch TCG card: ${tcgCardId}`);

            // Step 3: Get Pokemon TCG card data
            const tcgCard = await this.pokemonTcgService.getCard(tcgCardId);
            if (!tcgCard) {
                console.log(`[ImageEnhancementService] No TCG card found for ID: ${tcgCardId}`);
                return { ...pokeDataCard };
            }

            // Step 4: Extract images and metadata
            const enhancement = {
                tcgSetId,
                tcgCardId,
                metadata: {
                    hp: tcgCard.cardName ? undefined : tcgCard.cardName, // Will be populated from TCG API response
                    types: [], // Will be populated from TCG API response
                    rarity: tcgCard.rarity
                },
                enhancedAt: new Date().toISOString()
            };

            const enhancedCard: EnhancedCard = {
                ...pokeDataCard,
                images: {
                    small: tcgCard.imageUrl || '',
                    large: tcgCard.imageUrlHiRes || ''
                },
                enhancement
            };

            console.log(`[ImageEnhancementService] Successfully enhanced card: ${pokeDataCard.name} with images from ${tcgCardId}`);
            return enhancedCard;

        } catch (error: any) {
            console.error(`[ImageEnhancementService] Error enhancing card ${pokeDataCard.name}: ${error.message}`);
            // Return original card if enhancement fails
            return { ...pokeDataCard };
        }
    }

    /**
     * Enhance a PokeData pricing card with Pokemon TCG images and metadata
     * This is used for the GetCardInfo function that includes pricing data
     * @param pokeDataPricing - The PokeData pricing card to enhance
     * @returns Enhanced pricing card with images and metadata when available
     */
    async enhancePricingCardWithImages(
        pokeDataPricing: PokeDataPricing
    ): Promise<EnhancedPricingCard> {
        console.log(`[ImageEnhancementService] Enhancing pricing card: ${pokeDataPricing.name} (ID: ${pokeDataPricing.id}) from set ${pokeDataPricing.set_id}`);
        
        try {
            // Step 1: Get Pokemon TCG set ID from PokeData set ID
            const tcgSetId = this.mappingService.getTcgSetId(pokeDataPricing.set_id);
            if (!tcgSetId) {
                console.log(`[ImageEnhancementService] No TCG mapping found for PokeData set ID ${pokeDataPricing.set_id}`);
                return { ...pokeDataPricing };
            }

            // Step 2: Construct Pokemon TCG card ID with normalized card number
            const normalizedCardNumber = this.normalizeCardNumber(pokeDataPricing.num);
            const tcgCardId = `${tcgSetId}-${normalizedCardNumber}`;
            console.log(`[ImageEnhancementService] Attempting to fetch TCG card: ${tcgCardId}`);

            // Step 3: Get Pokemon TCG card data
            const tcgCard = await this.pokemonTcgService.getCard(tcgCardId);
            if (!tcgCard) {
                console.log(`[ImageEnhancementService] No TCG card found for ID: ${tcgCardId}`);
                return { ...pokeDataPricing };
            }

            // Step 4: Extract images and metadata
            const enhancement = {
                tcgSetId,
                tcgCardId,
                metadata: {
                    rarity: tcgCard.rarity
                },
                enhancedAt: new Date().toISOString()
            };

            const enhancedPricingCard: EnhancedPricingCard = {
                ...pokeDataPricing,
                images: {
                    small: tcgCard.imageUrl || '',
                    large: tcgCard.imageUrlHiRes || ''
                },
                enhancement
            };

            console.log(`[ImageEnhancementService] Successfully enhanced pricing card: ${pokeDataPricing.name} with images from ${tcgCardId}`);
            return enhancedPricingCard;

        } catch (error: any) {
            console.error(`[ImageEnhancementService] Error enhancing pricing card ${pokeDataPricing.name}: ${error.message}`);
            // Return original card if enhancement fails
            return { ...pokeDataPricing };
        }
    }

    /**
     * Enhance multiple PokeData cards with Pokemon TCG images in batch
     * @param pokeDataCards - Array of PokeData cards to enhance
     * @param pokeDataSetId - The PokeData set ID (used for mapping)
     * @returns Array of enhanced cards
     */
    async enhanceCardsWithImages(
        pokeDataCards: PokeDataCard[], 
        pokeDataSetId: number
    ): Promise<EnhancedCard[]> {
        console.log(`[ImageEnhancementService] Batch enhancing ${pokeDataCards.length} cards from set ${pokeDataSetId}`);
        
        // Check if mapping exists before processing any cards
        const tcgSetId = this.mappingService.getTcgSetId(pokeDataSetId);
        if (!tcgSetId) {
            console.log(`[ImageEnhancementService] No TCG mapping found for PokeData set ID ${pokeDataSetId}, returning cards without enhancement`);
            return pokeDataCards.map(card => ({ ...card }));
        }

        // Process cards in parallel for better performance
        const enhancementPromises = pokeDataCards.map(card => 
            this.enhanceCardWithImages(card, pokeDataSetId)
        );

        try {
            const enhancedCards = await Promise.all(enhancementPromises);
            const successCount = enhancedCards.filter(card => card.images).length;
            console.log(`[ImageEnhancementService] Successfully enhanced ${successCount}/${pokeDataCards.length} cards with images`);
            return enhancedCards;
        } catch (error: any) {
            console.error(`[ImageEnhancementService] Error in batch enhancement: ${error.message}`);
            // Return original cards if batch enhancement fails
            return pokeDataCards.map(card => ({ ...card }));
        }
    }

    /**
     * Check if a PokeData set can be enhanced with Pokemon TCG images
     * @param pokeDataSetId - The PokeData set ID to check
     * @returns true if enhancement is possible, false otherwise
     */
    canEnhanceSet(pokeDataSetId: number): boolean {
        return this.mappingService.hasMapping(pokeDataSetId);
    }

    /**
     * Get enhancement statistics for debugging
     * @returns Object with enhancement capabilities info
     */
    getEnhancementStats() {
        const mappedSetIds = this.mappingService.getMappedPokeDataSetIds();
        const unmappedSets = this.mappingService.getUnmappedPokeDataSets();
        
        return {
            totalMappedSets: mappedSetIds.length,
            totalUnmappedSets: unmappedSets.length,
            mappedSetIds: mappedSetIds.slice(0, 10), // First 10 for debugging
            enhancementCoverage: `${mappedSetIds.length}/${mappedSetIds.length + unmappedSets.length} sets`
        };
    }
}

// Export types for use in other modules
export type { PokeDataCard, PokeDataPricing, EnhancedCard, EnhancedPricingCard };
