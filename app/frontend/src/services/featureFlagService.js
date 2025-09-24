/**
 * Feature Flag Service
 * Provides functionality to manage feature flags for gradual migration
 */

import { loggerService } from './loggerService';

// Feature flag names
const FEATURE_FLAGS = {
  USE_CLOUD_API: 'useCloudApi',
  USE_CLOUD_IMAGES: 'useCloudImages',
  USE_CLOUD_CACHING: 'useCloudCaching'
};

/**
 * Service for managing feature flags
 */
export const featureFlagService = {
  /**
   * Get the value of a feature flag
   * @param {string} flagName - The name of the flag
   * @param {boolean} defaultValue - Default value if flag is not set
   * @returns {boolean} The flag value
   */
  getFlag(flagName, defaultValue = false) {
    try {
      // First check localStorage
      const storedValue = localStorage.getItem(`feature_${flagName}`);
      if (storedValue !== null) {
        return storedValue === 'true';
      }
      
      // Then check URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const paramValue = urlParams.get(`feature_${flagName}`);
      if (paramValue !== null) {
        // Store in localStorage for future use
        localStorage.setItem(`feature_${flagName}`, paramValue);
        return paramValue === 'true';
      }
      
      // Fall back to default
      return defaultValue;
    } catch (error) {
      loggerService.error('Error getting feature flag', { flagName, error });
      return defaultValue;
    }
  },
  
  /**
   * Set the value of a feature flag
   * @param {string} flagName - The name of the flag
   * @param {boolean} value - The value to set
   */
  setFlag(flagName, value) {
    try {
      localStorage.setItem(`feature_${flagName}`, value.toString());
    } catch (error) {
      loggerService.error('Error setting feature flag', { flagName, value, error });
    }
  },
  
  /**
   * Check if cloud API should be used
   * @returns {boolean} True if cloud API should be used
   */
  useCloudApi() {
    return this.getFlag(FEATURE_FLAGS.USE_CLOUD_API, true);
  },
  
  /**
   * Check if cloud images should be used
   * @returns {boolean} True if cloud images should be used
   */
  useCloudImages() {
    return this.getFlag(FEATURE_FLAGS.USE_CLOUD_IMAGES, true);
  },
  
  /**
   * Check if cloud caching should be used
   * @returns {boolean} True if cloud caching should be used
   */
  useCloudCaching() {
    return this.getFlag(FEATURE_FLAGS.USE_CLOUD_CACHING, true);
  },
  
  /**
   * Reset all feature flags to their default values
   */
  resetAllFlags() {
    try {
      Object.values(FEATURE_FLAGS).forEach(flag => {
        localStorage.removeItem(`feature_${flag}`);
      });
    } catch (error) {
      loggerService.error('Error resetting feature flags', { error });
    }
  }
};
