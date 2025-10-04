/**
 * Debug Tools - Monitoring
 * 
 * This module provides tools for monitoring objects, memory usage, and events.
 * These tools help developers track the state and behavior of the application.
 */

import { loggerService } from '../../services/loggerService';

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
