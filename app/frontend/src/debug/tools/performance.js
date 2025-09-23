/**
 * Debug Tools - Performance
 * 
 * This module provides tools for monitoring performance and network activity.
 * These tools help developers identify bottlenecks and optimize the application.
 */

import { loggerService } from '../../services/loggerService';
import { logMemoryUsage } from './monitor';

/**
 * Create a simple performance monitor that logs stats periodically
 * @param {number} interval - Interval in milliseconds
 * @returns {Object} Monitor control object
 */
export function createPerformanceMonitor(interval = 5000) {
  let timerId = null;
  let frameCount = 0;
  let lastTime = performance.now();
  let running = false;
  
  // Function to calculate FPS
  const calculateFPS = () => {
    const now = performance.now();
    const elapsed = now - lastTime;
    const fps = Math.round((frameCount * 1000) / elapsed);
    
    loggerService.groupCollapsed('Performance Monitor');
    loggerService.debug(`FPS: ${fps}`);
    logMemoryUsage();
    loggerService.groupEnd();
    
    frameCount = 0;
    lastTime = now;
  };
  
  // Frame counter
  const countFrame = () => {
    if (!running) return;
    
    frameCount++;
    requestAnimationFrame(countFrame);
  };
  
  return {
    start() {
      if (running) return;
      
      running = true;
      lastTime = performance.now();
      frameCount = 0;
      
      // Start counting frames
      requestAnimationFrame(countFrame);
      
      // Start periodic logging
      timerId = setInterval(calculateFPS, interval);
      
      loggerService.info(`Performance monitor started (interval: ${interval}ms)`);
    },
    
    stop() {
      if (!running) return;
      
      running = false;
      clearInterval(timerId);
      
      loggerService.info('Performance monitor stopped');
    },
    
    getSnapshot() {
      const now = performance.now();
      const elapsed = now - lastTime;
      const fps = Math.round((frameCount * 1000) / elapsed);
      
      return {
        fps,
        timestamp: new Date().toISOString()
      };
    }
  };
}

/**
 * Log network requests (limited implementation)
 * @returns {Object} An object with a restore method to disable monitoring
 */
export function monitorNetworkRequests() {
  // Store the original fetch function
  const originalFetch = window.fetch;
  
  // Override fetch
  window.fetch = function(url, options) {
    const startTime = performance.now();
    loggerService.debug(`Fetch request: ${url}`);
    
    return originalFetch.apply(this, arguments)
      .then(response => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        loggerService.debug(`Fetch response: ${url} (${duration.toFixed(2)}ms) - Status: ${response.status}`);
        
        return response;
      })
      .catch(error => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        loggerService.error(`Fetch error: ${url} (${duration.toFixed(2)}ms) - ${error.message}`);
        
        throw error;
      });
  };
  
  // Store the original XMLHttpRequest open and send methods
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  // Override open
  XMLHttpRequest.prototype.open = function(method, url) {
    this._debugMethod = method;
    this._debugUrl = url;
    this._debugStartTime = performance.now();
    
    return originalOpen.apply(this, arguments);
  };
  
  // Override send
  XMLHttpRequest.prototype.send = function() {
    loggerService.debug(`XHR request: ${this._debugMethod} ${this._debugUrl}`);
    
    // Add event listeners
    this.addEventListener('load', function() {
      const endTime = performance.now();
      const duration = endTime - this._debugStartTime;
      
      loggerService.debug(`XHR response: ${this._debugMethod} ${this._debugUrl} (${duration.toFixed(2)}ms) - Status: ${this.status}`);
    });
    
    this.addEventListener('error', function() {
      const endTime = performance.now();
      const duration = endTime - this._debugStartTime;
      
      loggerService.error(`XHR error: ${this._debugMethod} ${this._debugUrl} (${duration.toFixed(2)}ms)`);
    });
    
    return originalSend.apply(this, arguments);
  };
  
  loggerService.info('Network request monitoring enabled');
  
  return {
    restore() {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalOpen;
      XMLHttpRequest.prototype.send = originalSend;
      
      loggerService.info('Network request monitoring disabled');
    }
  };
}
