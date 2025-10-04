import { networkLogger } from './services/loggerService';

/**
 * Enhanced CORS proxy with better header handling and structured logging
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithProxy(url, options = {}) {
  // Extract method from options or default to GET
  const method = options.method || 'GET';
  
  // Start a timer for this request
  const timerLabel = `fetch-${method}-${url.split('?')[0]}`;
  networkLogger.time(timerLabel);
  
  try {
    networkLogger.info(`Fetching from: ${url}`);
    
    // Ensure headers object exists
    if (!options.headers) {
      options.headers = {};
    }
    
    // Log the request details
    networkLogger.logApiRequest(method, url, options);
    
    // Create a new Headers object to ensure proper header formatting
    const headers = new Headers();
    
    // Add all headers from options
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.append(key, value);
    });
    
    // Ensure content-type is set
    if (!headers.has('Content-Type')) {
      headers.append('Content-Type', 'application/json');
    }
    
    // Create a new options object with the properly formatted headers
    const enhancedOptions = {
      ...options,
      headers: headers,
      mode: 'cors', // Use CORS mode to allow cross-origin requests
      credentials: 'same-origin' // Don't send cookies for cross-origin requests
    };
    
    // Make the fetch request with enhanced options
    const startTime = performance.now();
    const response = await fetch(url, enhancedOptions);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Handle non-OK responses
    if (!response.ok) {
      let errorDetails = 'Unable to get error details';
      try {
        // Try to get error details as text
        errorDetails = await response.text();
      } catch (e) {
        networkLogger.warn('Could not read error response text:', e);
      }
      
      // Log the error details
      networkLogger.group(`HTTP Error: ${response.status} - ${response.statusText}`);
      networkLogger.error('URL:', url);
      networkLogger.error('Status:', `${response.status} ${response.statusText}`);
      networkLogger.error('Details:', errorDetails);
      
      // Special handling for 401 errors
      if (response.status === 401) {
        networkLogger.error('Authentication error: Check if subscription key is being sent correctly');
        networkLogger.error('Response headers:', Object.fromEntries([...response.headers.entries()]));
      }
      
      networkLogger.groupEnd();
      
      // End the timer
      networkLogger.timeEnd(timerLabel);
      
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
    }
    
    // Clone the response to log it without consuming it
    const responseClone = response.clone();
    let responseData;
    
    try {
      // Try to parse as JSON for logging
      responseData = await responseClone.json();
    } catch (e) {
      // If not JSON, get as text
      try {
        responseData = await responseClone.text();
        // If text is too long, truncate it
        if (responseData.length > 500) {
          responseData = `${responseData.substring(0, 500)}... (${responseData.length} chars)`;
        }
      } catch (textError) {
        responseData = '[Unable to read response body]';
      }
    }
    
    // Log the successful response
    await networkLogger.logApiResponse(method, url, response, responseData, duration);
    
    // End the timer
    networkLogger.timeEnd(timerLabel);
    
    return response;
  } catch (error) {
    // Log the error
    networkLogger.logApiError(method, url, error);
    
    // Provide more helpful error messages for common issues
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      networkLogger.error('Network error: Check your internet connection or if CORS is properly configured');
    } else if (error.message.includes('401')) {
      networkLogger.error('Authentication error: Check if your API key is valid and being sent correctly');
    }
    
    // End the timer
    networkLogger.timeEnd(timerLabel);
    
    throw error;
  }
}
