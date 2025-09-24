// Cloud API Configuration - Updated to use environment variables
import { getApiConfig } from '../config/environment.js';

// Get configuration from environment
const envConfig = getApiConfig();

export const API_CONFIG = {
  // Base URL for the API (from environment)
  baseUrl: envConfig.baseUrl,
  
  // Subscription key for API Management (from environment)
  subscriptionKey: envConfig.subscriptionKey,
  
  // Function key for Azure Functions (from environment, if applicable)
  functionKey: envConfig.functionKey,
  
  // Authentication type
  authType: envConfig.authType,
  
  // Headers function to get standard headers
  getHeaders() {
    return envConfig.getHeaders();
  },
  
  // URL builder functions for API Management endpoints
  buildSetsUrl() {
    if (this.authType === 'function') {
      return `${this.baseUrl}/sets?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/sets`;
  },
  
  buildCardsForSetUrl(setId) {
    if (this.authType === 'function') {
      return `${this.baseUrl}/sets/${encodeURIComponent(setId)}/cards?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/sets/${encodeURIComponent(setId)}/cards`;
  },
  
  buildCardInfoUrl(cardId, setId) {
    if (!setId) {
      throw new Error('setId is required for buildCardInfoUrl');
    }
    if (this.authType === 'function') {
      return `${this.baseUrl}/sets/${encodeURIComponent(setId)}/cards/${encodeURIComponent(cardId)}?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/sets/${encodeURIComponent(setId)}/cards/${encodeURIComponent(cardId)}`;
  },
  
  // Added for compatibility with existing code
  buildPricingUrl(id, setId) {
    if (!setId) {
      throw new Error('setId is required for buildPricingUrl');
    }
    if (this.authType === 'function') {
      return `${this.baseUrl}/sets/${encodeURIComponent(setId)}/cards/${encodeURIComponent(id)}?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/sets/${encodeURIComponent(setId)}/cards/${encodeURIComponent(id)}`;
  }
};
