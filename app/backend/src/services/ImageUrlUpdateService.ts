import { CosmosDbService } from './CosmosDbService';
import { Card } from '../models/Card';
import * as fs from 'fs';
import * as path from 'path';

export interface ImageUrlUpdateResult {
    totalCards: number;
    updatedCards: number;
    skippedCards: number;
    errors: number;
    setId: number;
    setName: string;
}

export class ImageUrlUpdateService {
    private cosmosDbService: CosmosDbService;
    private setMapping: any;
    
    constructor(cosmosDbService: CosmosDbService) {
        this.cosmosDbService = cosmosDbService;
        // Load set mapping
        const mappingPath = path.join(__dirname, '../../data/set-mapping.json');
        const mappingData = fs.readFileSync(mappingPath, 'utf8');
        this.setMapping = JSON.parse(mappingData);
    }
    
    /**
     * Get TCG set ID from PokeData set ID using the mapping
     */
    private getTcgSetId(pokeDataSetId: number): string | null {
        // Search through mappings to find the TCG set ID
        for (const [tcgId, mapping] of Object.entries(this.setMapping.mappings)) {
            if ((mapping as any).pokeDataId === pokeDataSetId) {
                return tcgId;
            }
        }
        return null;
    }
    
    /**
     * Construct image URLs for a card
     */
    private constructImageUrls(tcgSetId: string, cardNumber: string): { small: string; large: string } {
        // Remove leading zeros from card number (e.g., "020" -> "20")
        // But keep at least one zero if the number is "000" or similar
        const cleanCardNumber = cardNumber.replace(/^0+/, '') || '0';
        
        return {
            small: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}.png`,
            large: `https://images.pokemontcg.io/${tcgSetId}/${cleanCardNumber}_hires.png`
        };
    }
    
    /**
     * Update image URLs for all cards in a set
     */
    async updateSetImageUrls(setId: number): Promise<ImageUrlUpdateResult> {
        const result: ImageUrlUpdateResult = {
            totalCards: 0,
            updatedCards: 0,
            skippedCards: 0,
            errors: 0,
            setId: setId,
            setName: ''
        };
        
        console.log(`[ImageUrlUpdateService] Starting image URL update for set ${setId}`);
        
        // Get TCG set ID from mapping
        const tcgSetId = this.getTcgSetId(setId);
        if (!tcgSetId) {
            console.error(`[ImageUrlUpdateService] No TCG mapping found for set ${setId}`);
            return result;
        }
        
        console.log(`[ImageUrlUpdateService] Found TCG set ID: ${tcgSetId} for PokeData set ${setId}`);
        
        // Get all cards for this set
        const cards = await this.cosmosDbService.getCardsBySetId(setId.toString());
        result.totalCards = cards.length;
        
        if (cards.length > 0) {
            result.setName = cards[0].setName || '';
        }
        
        console.log(`[ImageUrlUpdateService] Found ${cards.length} cards to process`);
        
        // Process cards in batches
        const BATCH_SIZE = 50;
        const updatedCards: Card[] = [];
        
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            
            try {
                // Check if card already has image URLs
                if (card.imageUrl && card.imageUrlHiRes) {
                    console.log(`[ImageUrlUpdateService] Card ${card.cardNumber} already has image URLs, skipping`);
                    result.skippedCards++;
                    continue;
                }
                
                // Construct image URLs
                const imageUrls = this.constructImageUrls(tcgSetId, card.cardNumber);
                
                // Update card with new URLs
                card.imageUrl = imageUrls.small;
                card.imageUrlHiRes = imageUrls.large;
                
                // Also update the images object if it exists
                if (!card.images) {
                    card.images = {
                        small: imageUrls.small,
                        large: imageUrls.large,
                        original: imageUrls.large,
                        variants: {}
                    };
                } else {
                    card.images.small = imageUrls.small;
                    card.images.large = imageUrls.large;
                    if (!card.images.original) {
                        card.images.original = imageUrls.large;
                    }
                }
                
                updatedCards.push(card);
                
                // Save in batches
                if (updatedCards.length >= BATCH_SIZE || i === cards.length - 1) {
                    console.log(`[ImageUrlUpdateService] Saving batch of ${updatedCards.length} cards`);
                    await this.cosmosDbService.saveCards(updatedCards);
                    result.updatedCards += updatedCards.length;
                    updatedCards.length = 0; // Clear the batch
                }
                
            } catch (error) {
                console.error(`[ImageUrlUpdateService] Error processing card ${card.cardNumber}:`, error);
                result.errors++;
            }
        }
        
        console.log(`[ImageUrlUpdateService] Completed image URL update for set ${setId}`);
        console.log(`[ImageUrlUpdateService] Results: ${result.updatedCards} updated, ${result.skippedCards} skipped, ${result.errors} errors`);
        
        return result;
    }
    
    /**
     * Update image URLs for all mapped sets
     */
    async updateAllSetsImageUrls(): Promise<ImageUrlUpdateResult[]> {
        const results: ImageUrlUpdateResult[] = [];
        
        console.log('[ImageUrlUpdateService] Starting image URL update for all mapped sets');
        
        // Get unique set IDs from mappings
        const setIds = new Set<number>();
        for (const mapping of Object.values(this.setMapping.mappings)) {
            setIds.add((mapping as any).pokeDataId);
        }
        
        console.log(`[ImageUrlUpdateService] Found ${setIds.size} mapped sets to process`);
        
        // Process each set
        for (const setId of setIds) {
            try {
                const result = await this.updateSetImageUrls(setId);
                results.push(result);
                
                // Add a small delay between sets to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[ImageUrlUpdateService] Error processing set ${setId}:`, error);
            }
        }
        
        // Summary
        const totalCards = results.reduce((sum, r) => sum + r.totalCards, 0);
        const totalUpdated = results.reduce((sum, r) => sum + r.updatedCards, 0);
        const totalSkipped = results.reduce((sum, r) => sum + r.skippedCards, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
        
        console.log('[ImageUrlUpdateService] ========================================');
        console.log('[ImageUrlUpdateService] Image URL Update Complete');
        console.log(`[ImageUrlUpdateService] Total cards processed: ${totalCards}`);
        console.log(`[ImageUrlUpdateService] Total cards updated: ${totalUpdated}`);
        console.log(`[ImageUrlUpdateService] Total cards skipped: ${totalSkipped}`);
        console.log(`[ImageUrlUpdateService] Total errors: ${totalErrors}`);
        console.log('[ImageUrlUpdateService] ========================================');
        
        return results;
    }
    
    /**
     * Check if a card needs image URL update
     */
    async checkCardNeedsUpdate(cardId: string, setId: number): Promise<boolean> {
        try {
            const card = await this.cosmosDbService.getCard(cardId, setId);
            if (!card) {
                return false;
            }
            
            // Card needs update if it doesn't have image URLs
            return !card.imageUrl || !card.imageUrlHiRes;
        } catch (error) {
            console.error(`[ImageUrlUpdateService] Error checking card ${cardId}:`, error);
            return false;
        }
    }
}
