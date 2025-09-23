/**
 * API Credentials Debug Tool
 * 
 * This script can be loaded in the browser to diagnose API credential issues.
 * To use it, include it in your HTML or load it directly in the browser console.
 * 
 * Usage in browser console:
 * 1. fetch('/debug-api.js').then(r => r.text()).then(t => eval(t))
 * 2. debugApiCredentials()
 */

// Make sure the function is added to the global window object
window.debugApiCredentials = function() {
  console.log('=== API Credentials Debug Tool ===');
  console.log('Running at:', new Date().toISOString());
  
  try {
    // Check if API_CONFIG is available in global scope
    if (typeof API_CONFIG === 'undefined') {
      console.error('❌ API_CONFIG is not defined in global scope');
      console.log('This might mean:');
      console.log('1. The apiConfig.js file is not being loaded');
      console.log('2. API_CONFIG is not exported correctly');
      console.log('3. There\'s a loading order issue');
      return;
    }
    
    // Log API configuration
    console.log('✅ API_CONFIG is defined');
    console.log('API Base URL:', API_CONFIG.baseUrl);
    console.log('Subscription Key exists:', !!API_CONFIG.subscriptionKey);
    console.log('Subscription Key length:', API_CONFIG.subscriptionKey ? API_CONFIG.subscriptionKey.length : 0);
    console.log('Environment:', API_CONFIG.environment);
    
    // Test header generation
    const headers = API_CONFIG.getHeaders();
    console.log('Generated Headers:');
    Object.entries(headers).forEach(([key, value]) => {
      // Safely display header values
      const displayValue = typeof value === 'string' && value.length > 8 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`- ${key}: ${displayValue}`);
      
      // Check for empty or malformed values
      if (key === 'Ocp-Apim-Subscription-Key') {
        if (!value || value.length === 0) {
          console.error('❌ Subscription Key header is empty');
        } else {
          console.log('✅ Subscription Key header is present');
        }
      }
    });
    
    // Test a mock API call
    console.log('Simulating API call headers...');
    const mockUrl = API_CONFIG.buildSetsUrl();
    console.log('URL that would be called:', mockUrl);
    
    // Check for common issues
    if (API_CONFIG.subscriptionKey === '') {
      console.error('❌ Subscription Key is empty - check configuration in apiConfig.js');
    }
    
    console.log('=== End API Credentials Debug ===');
    
    return {
      status: 'completed',
      apiConfigExists: true,
      subscriptionKeyExists: !!API_CONFIG.subscriptionKey,
      subscriptionKeyLength: API_CONFIG.subscriptionKey ? API_CONFIG.subscriptionKey.length : 0,
      subscriptionHeaderValid: !!(headers['Ocp-Apim-Subscription-Key'] && headers['Ocp-Apim-Subscription-Key'].length > 0)
    };
  } catch (error) {
    console.error('Error running API credentials debug:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
}

// Auto-run if loaded directly in browser
if (typeof window !== 'undefined') {
  console.log('API Credentials Debug Tool loaded');
  console.log('Run debugApiCredentials() to check API configuration');
}
