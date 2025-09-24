/**
 * Debug Tools
 * Utility functions for debugging the PokeData application
 */

import { loggerService } from './services/loggerService';

/**
 * Inspect an object's properties and log them in a structured way
 * @param {Object} obj - The object to inspect
 * @param {Object} options - Options for inspection
 * @param {number} options.depth - Maximum depth to inspect (default: 2)
 * @param {boolean} options.showMethods - Whether to show methods (default: false)
 * @param {boolean} options.showPrototype - Whether to show prototype properties (default: false)
 */
export function inspectObject(obj, options = {}) {
  const { 
    depth = 2, 
    showMethods = false, 
    showPrototype = false,
    label = 'Object Inspection'
  } = options;
  
  if (!obj) {
    loggerService.warn('Cannot inspect null or undefined object');
    return;
  }
  
  loggerService.groupCollapsed(label);
  
  try {
    // Get all properties, including non-enumerable ones if showPrototype is true
    const props = showPrototype 
      ? Object.getOwnPropertyNames(obj) 
      : Object.keys(obj);
    
    // Log the object type and constructor
    loggerService.info('Type:', Object.prototype.toString.call(obj));
    if (obj.constructor && obj.constructor.name) {
      loggerService.info('Constructor:', obj.constructor.name);
    }
    
    // Log the number of properties
    loggerService.info('Properties:', props.length);
    
    // Group properties by type
    const groups = {
      primitives: [],
      objects: [],
      arrays: [],
      functions: [],
      other: []
    };
    
    // Categorize properties
    props.forEach(prop => {
      try {
        const value = obj[prop];
        const type = typeof value;
        
        // Skip methods if not showing them
        if (type === 'function' && !showMethods) {
          return;
        }
        
        if (value === null || value === undefined) {
          groups.primitives.push({ prop, value, type });
        } else if (type === 'object') {
          if (Array.isArray(value)) {
            groups.arrays.push({ prop, value, type });
          } else {
            groups.objects.push({ prop, value, type });
          }
        } else if (type === 'function') {
          groups.functions.push({ prop, value, type });
        } else {
          groups.primitives.push({ prop, value, type });
        }
      } catch (e) {
        groups.other.push({ prop, error: e.message });
      }
    });
    
    // Log primitive properties
    if (groups.primitives.length > 0) {
      loggerService.groupCollapsed('Primitive Properties');
      groups.primitives.forEach(({ prop, value, type }) => {
        loggerService.debug(`${prop} (${type}):`, value);
      });
      loggerService.groupEnd();
    }
    
    // Log object properties
    if (groups.objects.length > 0) {
      loggerService.groupCollapsed('Object Properties');
      groups.objects.forEach(({ prop, value }) => {
        if (depth > 1) {
          loggerService.groupCollapsed(`${prop}:`);
          inspectObject(value, { ...options, depth: depth - 1, label: prop });
          loggerService.groupEnd();
        } else {
          loggerService.debug(`${prop}:`, value);
        }
      });
      loggerService.groupEnd();
    }
    
    // Log array properties
    if (groups.arrays.length > 0) {
      loggerService.groupCollapsed('Array Properties');
      groups.arrays.forEach(({ prop, value }) => {
        loggerService.debug(`${prop} (length: ${value.length}):`, value);
      });
      loggerService.groupEnd();
    }
    
    // Log function properties
    if (groups.functions.length > 0) {
      loggerService.groupCollapsed('Function Properties');
      groups.functions.forEach(({ prop, value }) => {
        // Try to get function details
        try {
          const functionString = value.toString();
          const firstLine = functionString.split('\n')[0].trim();
          loggerService.debug(`${prop}:`, firstLine);
        } catch (e) {
          loggerService.debug(`${prop}: [Function]`);
        }
      });
      loggerService.groupEnd();
    }
    
    // Log properties that caused errors
    if (groups.other.length > 0) {
      loggerService.groupCollapsed('Inaccessible Properties');
      groups.other.forEach(({ prop, error }) => {
        loggerService.warn(`${prop}: Error accessing property - ${error}`);
      });
      loggerService.groupEnd();
    }
  } catch (e) {
    loggerService.error('Error inspecting object:', e);
  }
  
  loggerService.groupEnd();
}

/**
 * Measure the execution time of a function
 * @param {Function} fn - The function to measure
 * @param {Array} args - Arguments to pass to the function
 * @param {string} label - Label for the measurement
 * @returns {any} The result of the function
 */
export function measureExecutionTime(fn, args = [], label = 'Function Execution') {
  if (typeof fn !== 'function') {
    loggerService.error('First argument must be a function');
    return;
  }
  
  loggerService.time(label);
  
  try {
    const result = fn(...args);
    
    // Handle promises
    if (result instanceof Promise) {
      return result
        .then(value => {
          loggerService.timeEnd(label);
          return value;
        })
        .catch(error => {
          loggerService.timeEnd(label);
          loggerService.error(`Error in measured function: ${error.message}`);
          throw error;
        });
    }
    
    loggerService.timeEnd(label);
    return result;
  } catch (error) {
    loggerService.timeEnd(label);
    loggerService.error(`Error in measured function: ${error.message}`);
    throw error;
  }
}

/**
 * Create a function that logs its arguments and result
 * @param {Function} fn - The function to wrap
 * @param {string} name - Name of the function for logging
 * @returns {Function} The wrapped function
 */
export function createLoggingFunction(fn, name = 'function') {
  return function(...args) {
    loggerService.groupCollapsed(`${name} called`);
    loggerService.debug('Arguments:', args);
    
    try {
      const result = fn.apply(this, args);
      
      // Handle promises
      if (result instanceof Promise) {
        loggerService.debug('Returns: Promise');
        loggerService.groupEnd();
        
        return result
          .then(value => {
            loggerService.groupCollapsed(`${name} resolved`);
            loggerService.debug('Result:', value);
            loggerService.groupEnd();
            return value;
          })
          .catch(error => {
            loggerService.groupCollapsed(`${name} rejected`);
            loggerService.error('Error:', error);
            loggerService.groupEnd();
            throw error;
          });
      }
      
      loggerService.debug('Result:', result);
      loggerService.groupEnd();
      return result;
    } catch (error) {
      loggerService.error('Error:', error);
      loggerService.groupEnd();
      throw error;
    }
  };
}

/**
 * Monitor property access on an object
 * @param {Object} obj - The object to monitor
 * @param {Array} properties - Properties to monitor (or all if not specified)
 * @returns {Proxy} A proxy that logs property access
 */
export function monitorObjectProperties(obj, properties = null) {
  if (!obj || typeof obj !== 'object') {
    loggerService.error('Cannot monitor non-object');
    return obj;
  }
  
  const propsToMonitor = properties || Object.keys(obj);
  
  return new Proxy(obj, {
    get(target, prop) {
      if (propsToMonitor.includes(prop)) {
        loggerService.debug(`Property accessed: ${String(prop)}`, target[prop]);
      }
      return target[prop];
    },
    set(target, prop, value) {
      if (propsToMonitor.includes(prop)) {
        loggerService.debug(`Property changed: ${String(prop)}`, {
          from: target[prop],
          to: value
        });
      }
      target[prop] = value;
      return true;
    }
  });
}

/**
 * Create a memory usage snapshot
 * @returns {Object} Memory usage information
 */
export function getMemoryUsage() {
  if (window.performance && window.performance.memory) {
    const memory = window.performance.memory;
    return {
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      formattedTotal: formatBytes(memory.totalJSHeapSize),
      formattedUsed: formatBytes(memory.usedJSHeapSize),
      formattedLimit: formatBytes(memory.jsHeapSizeLimit),
      percentUsed: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
    };
  }
  
  return {
    message: 'Memory API not available in this browser'
  };
}

/**
 * Log memory usage
 */
export function logMemoryUsage() {
  const memory = getMemoryUsage();
  
  if (memory.message) {
    loggerService.warn('Memory Usage:', memory.message);
    return;
  }
  
  loggerService.groupCollapsed('Memory Usage');
  loggerService.debug(`Used: ${memory.formattedUsed} / ${memory.formattedLimit} (${memory.percentUsed}%)`);
  loggerService.debug(`Total Heap: ${memory.formattedTotal}`);
  loggerService.groupEnd();
}

/**
 * Format bytes to a human-readable string
 * @param {number} bytes - The number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Log all event listeners attached to an element
 * @param {HTMLElement} element - The element to check
 */
export function logEventListeners(element) {
  if (!element || !(element instanceof HTMLElement)) {
    loggerService.error('Invalid element provided');
    return;
  }
  
  loggerService.groupCollapsed(`Event Listeners for ${element.tagName}${element.id ? '#' + element.id : ''}`);
  
  // This is a limited implementation since we can't access all event listeners
  // We can only check for inline event handlers
  const eventAttributes = [
    'onclick', 'onchange', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup',
    'onfocus', 'onblur', 'onsubmit', 'onload', 'onerror'
  ];
  
  let hasListeners = false;
  
  eventAttributes.forEach(attr => {
    if (element[attr]) {
      hasListeners = true;
      loggerService.debug(`${attr.substring(2)}:`, 'Has handler');
    }
  });
  
  if (!hasListeners) {
    loggerService.debug('No inline event handlers detected');
    loggerService.debug('Note: This method cannot detect listeners added via addEventListener');
  }
  
  loggerService.groupEnd();
}

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
      const memory = getMemoryUsage();
      const now = performance.now();
      const elapsed = now - lastTime;
      const fps = Math.round((frameCount * 1000) / elapsed);
      
      return {
        fps,
        memory,
        timestamp: new Date().toISOString()
      };
    }
  };
}

/**
 * Log network requests (limited implementation)
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

// Export all debug tools
export default {
  inspectObject,
  measureExecutionTime,
  createLoggingFunction,
  monitorObjectProperties,
  getMemoryUsage,
  logMemoryUsage,
  logEventListeners,
  createPerformanceMonitor,
  monitorNetworkRequests
};
