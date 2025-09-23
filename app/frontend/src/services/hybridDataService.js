import { pokeDataService } from './pokeDataService';
import { cloudDataService } from './cloudDataService';
import { featureFlagService } from './featureFlagService';
import { apiLogger } from './loggerService';

/**
 * Hybrid service that can use either local or cloud implementation
 * based on feature flags
 */
export const hybridDataService = {
  /**
   * Get the list of all Pokémon card sets
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Array>} Array of set objects
   */
  async getSetList(forceRefresh = false) {
    if (featureFlagService.useCloudApi()) {
      return cloudDataService.getSetList(forceRefresh, true);
    } else {
      return pokeDataService.getSetList(forceRefresh);
    }
  },
  
  /**
   * Get cards for a specific set
   * @param {string} setCode - The set code
   * @param {string} setId - The set ID
   * @returns {Promise<Array>} Array of card objects
   */
  async getCardsForSet(setCode, setId) {
    if (featureFlagService.useCloudApi()) {
      // Use setId for PokeData-first backend, fallback to setCode if setId not available
      const identifier = setId || setCode;
      const result = await cloudDataService.getCardsForSet(identifier);
      return result.items || [];
    } else {
      return pokeDataService.getCardsForSet(setCode, setId);
    }
  },
  
  /**
   * Get pricing data for a specific card
   * @param {string} cardId - The card ID
   * @returns {Promise<Object>} Card pricing data
   */
  async getCardPricing(cardId, setId) {
    if (featureFlagService.useCloudApi()) {
      return cloudDataService.getCardPricing(cardId, setId);
    } else {
      return pokeDataService.getCardPricing(cardId);
    }
  },
  
  /**
   * Get pricing data for a specific card with metadata
   * @param {string} cardId - The card ID
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Object>} Card pricing data with metadata
   */
  async getCardPricingWithMetadata(cardId, setId, forceRefresh = false) {
    if (featureFlagService.useCloudApi()) {
      return cloudDataService.getCardPricingWithMetadata(cardId, setId, forceRefresh);
    } else {
      return pokeDataService.getCardPricingWithMetadata(cardId, forceRefresh);
    }
  },
  
  /**
   * Preload current sets data
   * @returns {Promise<boolean>} True if successful
   */
  async preloadCurrentSets() {
    if (featureFlagService.useCloudApi()) {
      return true; // Cloud API does not require preloading
    } else {
      return pokeDataService.preloadCurrentSets();
    }
  },
  
  /**
   * Update current sets configuration
   * @returns {Promise<boolean>} True if successful
   */
  async updateCurrentSetsConfiguration() {
    if (featureFlagService.useCloudApi()) {
      return true; // Cloud API does not require updating configuration
    } else {
      return pokeDataService.updateCurrentSetsConfiguration();
    }
  }
};
