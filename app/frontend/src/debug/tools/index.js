/**
 * Debug Tools - Index
 * 
 * This module exports all debugging tools for the PokeData application.
 * It provides utilities for inspecting objects, measuring performance,
 * monitoring network activity, and more.
 */

import { 
  inspectObject,
  measureExecutionTime,
  createLoggingFunction
} from './inspect';

import {
  monitorObjectProperties,
  getMemoryUsage,
  logMemoryUsage,
  logEventListeners
} from './monitor';

import {
  createPerformanceMonitor,
  monitorNetworkRequests
} from './performance';

// Export all debug tools
export {
  // Inspection tools
  inspectObject,
  measureExecutionTime,
  createLoggingFunction,
  
  // Monitoring tools
  monitorObjectProperties,
  getMemoryUsage,
  logMemoryUsage,
  logEventListeners,
  
  // Performance tools
  createPerformanceMonitor,
  monitorNetworkRequests
};

// Export a default object with all tools
export default {
  // Inspection tools
  inspectObject,
  measureExecutionTime,
  createLoggingFunction,
  
  // Monitoring tools
  monitorObjectProperties,
  getMemoryUsage,
  logMemoryUsage,
  logEventListeners,
  
  // Performance tools
  createPerformanceMonitor,
  monitorNetworkRequests
};
