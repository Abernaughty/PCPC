/**
 * Debug Utilities - Environment
 * 
 * This module provides utilities for debugging environment and API configuration.
 * IMPORTANT: This file should not be included in production builds!
 */

import { API_CONFIG } from '../../data/apiConfig';
import { loggerService } from '../../services/loggerService';

/**
 * Debug API configuration
 * Logs information about the API configuration and environment
 */
export function debugApiConfig() {
  // Always run for now (removed production check)
  
  loggerService.groupCollapsed('API Configuration Debug');
  loggerService.debug('Running debug check at:', new Date().toISOString());
  
  // Check Node environment
  loggerService.debug('NODE_ENV: development (hardcoded)');
  
  // Check API configuration
  loggerService.debug('API Base URL:', API_CONFIG.baseUrl);
  
  // Safely check API credentials
  loggerService.debug('Subscription Key exists:', !!API_CONFIG.subscriptionKey);
  if (API_CONFIG.subscriptionKey) {
    loggerService.debug('Subscription Key length:', API_CONFIG.subscriptionKey.length);
    loggerService.debug('Subscription Key first 4 chars:', API_CONFIG.subscriptionKey.substring(0, 4) + '...');
  }
  
  // Check headers
  const headers = API_CONFIG.getHeaders();
  loggerService.debug('API Headers:', Object.keys(headers).join(', '));
  
  // Check build information
  loggerService.debug('BUILD_TIME:', process.env.BUILD_TIME || 'not set');
  
  loggerService.groupEnd();
  
  return {
    environment: 'development',
    apiBaseUrl: API_CONFIG.baseUrl,
    hasSubscriptionKey: !!API_CONFIG.subscriptionKey,
    headers: Object.keys(headers),
    buildTime: process.env.BUILD_TIME || 'not set'
  };
}

// Export a default object with all environment utilities
export default {
  debugApiConfig
};
