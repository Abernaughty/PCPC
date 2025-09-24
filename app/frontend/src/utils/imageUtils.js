import { featureFlagService } from '../services/featureFlagService';

/**
 * Process image URLs for a card
 * @param {Object} card - The card object
 * @returns {Object} Card with processed image URLs
 */
export function processCardImages(card) {
  if (!card) return card;
  
  // Clone the card to avoid modifying the original
  const processedCard = { ...card };
  
  if (featureFlagService.useCloudImages()) {
    // Use CDN URLs if available
    if (processedCard.cdnImageUrl) {
      processedCard.imageUrl = processedCard.cdnImageUrl;
    }
    
    if (processedCard.cdnImageUrlHiRes) {
      processedCard.imageUrlHiRes = processedCard.cdnImageUrlHiRes;
    }
  }
  
  return processedCard;
}

/**
 * Get the appropriate image URL for a card
 * @param {Object} card - The card object
 * @param {boolean} highRes - Whether to get the high-resolution image
 * @returns {string|null} The image URL or null if not available
 */
export function getCardImageUrl(card, highRes = false) {
  if (!card) return null;
  
  if (featureFlagService.useCloudImages()) {
    // Try to use CDN URLs first
    if (highRes && card.cdnImageUrlHiRes) {
      return card.cdnImageUrlHiRes;
    } else if (!highRes && card.cdnImageUrl) {
      return card.cdnImageUrl;
    }
  }
  
  // Fall back to standard URLs
  if (highRes && card.imageUrlHiRes) {
    return card.imageUrlHiRes;
  } else if (!highRes && card.imageUrl) {
    return card.imageUrl;
  }
  
  // No image available
  return null;
}

/**
 * Check if a card has an image
 * @param {Object} card - The card object
 * @param {boolean} highRes - Whether to check for high-resolution image
 * @returns {boolean} True if the card has an image
 */
export function hasCardImage(card, highRes = false) {
  return getCardImageUrl(card, highRes) !== null;
}
