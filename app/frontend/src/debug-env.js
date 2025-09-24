// API Configuration Debug Script
// Include this file in your application to debug API configuration
// IMPORTANT: Remove this file before deploying to production!

import { API_CONFIG } from './data/apiConfig';

(function() {
  console.log('=== API Configuration Debug ===');
  console.log('Running debug check at:', new Date().toISOString());
  
  // Check Node environment
  console.log('NODE_ENV: development (hardcoded)');
  
  // Check API configuration
  console.log('API Base URL:', API_CONFIG.baseUrl);
  
  // Safely check API credentials
  console.log('Subscription Key exists:', !!API_CONFIG.subscriptionKey);
  if (API_CONFIG.subscriptionKey) {
    console.log('Subscription Key length:', API_CONFIG.subscriptionKey.length);
    console.log('Subscription Key first 4 chars:', API_CONFIG.subscriptionKey.substring(0, 4) + '...');
  }
  
  // Check headers
  const headers = API_CONFIG.getHeaders();
  console.log('API Headers:', Object.keys(headers).join(', '));
  
  // Check build information
  console.log('BUILD_TIME:', process.env.BUILD_TIME || 'not set');
  
  console.log('=== End API Configuration Debug ===');
})();
