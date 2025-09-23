// API Configuration - Updated to use environment variables
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
  
  // URL builder functions - Updated to match API Management endpoints
  buildPricingUrl(id) {
    if (this.authType === 'function') {
      return `${this.baseUrl}/cards/${encodeURIComponent(id)}?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/cards/${encodeURIComponent(id)}`;
  },
  
  buildSetsUrl() {
    if (this.authType === 'function') {
      return `${this.baseUrl}/sets?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/sets`;
  },
  
  buildCardsForSetUrl(setCode) {
    if (this.authType === 'function') {
      return `${this.baseUrl}/sets/${encodeURIComponent(setCode)}/cards?code=${encodeURIComponent(this.functionKey)}`;
    }
    return `${this.baseUrl}/sets/${encodeURIComponent(setCode)}/cards`;
  }
};
