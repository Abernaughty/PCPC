/**
 * Debug Configuration
 * Central configuration for debugging and logging in the PokeData application
 */

import { loggerService } from './services/loggerService';

// Default debug configuration
const DEFAULT_CONFIG = {
  // Log level: DEBUG, INFO, WARN, ERROR, or NONE
  logLevel: 'DEBUG', // Always use DEBUG for now
  
  // Enable/disable specific loggers
  enabledLoggers: {
    api: true,      // API calls and responses
    db: true,       // Database operations
    ui: true,       // UI interactions and lifecycle
    cache: true,    // Cache operations
    network: true,  // Network requests
  },
  
  // Visual options
  visual: {
    enableColors: true,           // Colorize log output
    enableTimestamps: true,       // Show timestamps in logs
    showCallerInfo: true,         // Show file and line information
    groupTimingLogs: true,        // Group timing logs
  },
  
  // Formatting options
  formatting: {
    maxArrayLength: 5,            // Maximum number of array items to display
    maxObjectDepth: 2,            // Maximum depth for object serialization
    truncateStringsAt: 150,       // Maximum string length before truncation
  },
  
  // Performance monitoring
  performance: {
    enableTimers: true,           // Enable performance timers
    logSlowOperations: true,      // Log operations that take longer than threshold
    slowOperationThreshold: 500,  // Threshold for slow operations (ms)
  }
};

/**
 * Initialize the logger with the provided configuration
 * @param {Object} config - Configuration options (optional)
 */
export function initializeLogger(config = {}) {
  // Merge the provided config with the default config
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    visual: { ...DEFAULT_CONFIG.visual, ...(config.visual || {}) },
    formatting: { ...DEFAULT_CONFIG.formatting, ...(config.formatting || {}) },
    performance: { ...DEFAULT_CONFIG.performance, ...(config.performance || {}) },
    enabledLoggers: { ...DEFAULT_CONFIG.enabledLoggers, ...(config.enabledLoggers || {}) },
  };
  
  // Map the log level string to the numeric value
  const logLevel = loggerService.LEVELS[mergedConfig.logLevel] || loggerService.LEVELS.DEBUG;
  
  // Configure the logger service
  loggerService.configure({
    level: logLevel,
    enableTimestamps: mergedConfig.visual.enableTimestamps,
    enableColors: mergedConfig.visual.enableColors,
    groupTimingLogs: mergedConfig.visual.groupTimingLogs,
    showCallerInfo: mergedConfig.visual.showCallerInfo,
    maxArrayLength: mergedConfig.formatting.maxArrayLength,
    maxObjectDepth: mergedConfig.formatting.maxObjectDepth,
    truncateStringsAt: mergedConfig.formatting.truncateStringsAt,
  });
  
  // Log the configuration
  loggerService.debug('Logger initialized with configuration:', mergedConfig);
  
  // Return the merged config for reference
  return mergedConfig;
}

/**
 * Set the log level
 * @param {string} level - The log level (DEBUG, INFO, WARN, ERROR, NONE)
 */
export function setLogLevel(level) {
  const logLevel = loggerService.LEVELS[level];
  if (logLevel !== undefined) {
    loggerService.setLevel(logLevel);
    loggerService.info(`Log level set to ${level}`);
  } else {
    loggerService.error(`Invalid log level: ${level}. Valid levels are: DEBUG, INFO, WARN, ERROR, NONE`);
  }
}

/**
 * Enable or disable a specific logger
 * @param {string} logger - The logger to enable/disable (api, db, ui, cache, network)
 * @param {boolean} enabled - Whether to enable or disable the logger
 */
export function setLoggerEnabled(logger, enabled) {
  // This doesn't actually disable the logger, but it's a placeholder for future implementation
  loggerService.info(`Logger ${logger} ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get the current logger configuration
 * @returns {Object} The current configuration
 */
export function getLoggerConfig() {
  try {
    // Get the actual config from the logger with fallbacks
    let logLevel = 'DEBUG'; // Default fallback
    
    // First try to get from config property
    if (loggerService.config && loggerService.config.level !== undefined) {
      logLevel = Object.keys(loggerService.LEVELS).find(
        key => loggerService.LEVELS[key] === loggerService.config.level
      ) || 'DEBUG';
    } 
    // If that fails, try to get directly from the logger service
    else if (loggerService._config && loggerService._config.level !== undefined) {
      logLevel = Object.keys(loggerService.LEVELS).find(
        key => loggerService.LEVELS[key] === loggerService._config.level
      ) || 'DEBUG';
    }
    
    return {
      logLevel,
      // Other config properties would be returned here
      enableTimestamps: loggerService.config?.enableTimestamps ?? true,
      enableColors: loggerService.config?.enableColors ?? true,
      showCallerInfo: loggerService.config?.showCallerInfo ?? true,
      groupTimingLogs: loggerService.config?.groupTimingLogs ?? true
    };
  } catch (error) {
    console.error('Error getting logger configuration:', error);
    // Return default configuration if there's an error
    return {
      logLevel: 'DEBUG',
      enableTimestamps: true,
      enableColors: true,
      showCallerInfo: true,
      groupTimingLogs: true
    };
  }
}

/**
 * Enable debug mode - sets log level to DEBUG and enables all loggers
 */
export function enableDebugMode() {
  setLogLevel('DEBUG');
  Object.keys(DEFAULT_CONFIG.enabledLoggers).forEach(logger => {
    setLoggerEnabled(logger, true);
  });
  loggerService.info('Debug mode enabled');
}

/**
 * Disable debug mode - sets log level to INFO and disables verbose loggers
 */
export function disableDebugMode() {
  setLogLevel('INFO');
  loggerService.info('Debug mode disabled');
}

// Initialize the logger with default configuration
const config = initializeLogger();

// Export the configuration as default
export default config;
