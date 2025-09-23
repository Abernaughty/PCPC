/**
 * Debug Tools - Inspection
 * 
 * This module provides tools for inspecting objects and measuring performance.
 * These tools help developers understand the structure and behavior of objects.
 */

import { loggerService } from '../../services/loggerService';

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
