import { Card } from '../models/Card';
import { ImageOptions, ImageSourceStrategy } from '../models/Config';
import { IBlobStorageService } from '../services/BlobStorageService';

/**
 * Process image URLs for a card based on configuration
 * @param card The card to process
 * @param options Image configuration options
 * @returns The card with processed image URLs
 */
export async function processImageUrls(
    card: Card,
    options: ImageOptions & { blobStorageService: IBlobStorageService }
): Promise<Card> {
    const { cdnEndpoint, sourceStrategy, enableCdn, blobStorageService } = options;
    
    // If CDN is disabled or strategy is external, return original URLs
    if (!enableCdn || sourceStrategy === ImageSourceStrategy.External) {
        return {
            ...card,
            images: {
                small: card.imageUrl || '',
                large: card.imageUrlHiRes || '',
                original: card.imageUrl || ''
            }
        };
    }
    
    // Construct blob paths
    const smallImagePath = `cards/${card.setCode.toLowerCase()}/${card.cardNumber}.png`;
    const largeImagePath = `cards/${card.setCode.toLowerCase()}/${card.cardNumber}_hires.png`;
    
    // Check if images exist in blob storage
    const smallExists = await blobStorageService.exists(smallImagePath);
    const largeExists = await blobStorageService.exists(largeImagePath);
    
    // Determine URLs based on strategy and existence
    let smallImageUrl = card.imageUrl || '';
    let largeImageUrl = card.imageUrlHiRes || '';
    
    if (sourceStrategy === ImageSourceStrategy.Internal) {
        // Internal strategy - always use CDN URLs, even if they don't exist yet
        smallImageUrl = `${cdnEndpoint}/${smallImagePath}`;
        largeImageUrl = `${cdnEndpoint}/${largeImagePath}`;
    } else {
        // Hybrid strategy - use CDN URLs if they exist, otherwise use original URLs
        if (smallExists) {
            smallImageUrl = `${cdnEndpoint}/${smallImagePath}`;
        }
        
        if (largeExists) {
            largeImageUrl = `${cdnEndpoint}/${largeImagePath}`;
        }
    }
    
    return {
        ...card,
        images: {
            small: smallImageUrl,
            large: largeImageUrl,
            original: card.imageUrl || ''
        }
    };
}

/**
 * Generate a CDN URL for a card image
 * @param card The card
 * @param size The image size ('small' or 'large')
 * @param cdnEndpoint The CDN endpoint URL
 * @returns The CDN URL for the card image
 */
export function generateCardImageUrl(card: Card, size: 'small' | 'large', cdnEndpoint: string): string {
    const setCode = card.setCode.toLowerCase();
    const cardNumber = card.cardNumber;
    
    if (size === 'small') {
        return `${cdnEndpoint}/cards/${setCode}/${cardNumber}.png`;
    } else {
        return `${cdnEndpoint}/cards/${setCode}/${cardNumber}_hires.png`;
    }
}

/**
 * Extract set code and card number from a card ID
 * @param cardId The card ID (e.g., 'sv8pt5-161')
 * @returns An object with setCode and cardNumber
 */
export function parseCardId(cardId: string): { setCode: string; cardNumber: string } {
    const parts = cardId.split('-');
    
    if (parts.length !== 2) {
        throw new Error(`Invalid card ID format: ${cardId}`);
    }
    
    return {
        setCode: parts[0],
        cardNumber: parts[1]
    };
}
