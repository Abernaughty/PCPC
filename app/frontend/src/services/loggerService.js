/**
 * Logger Service
 * Provides centralized, configurable logging functionality for the PokeData application
 */

// Log levels with numeric values for comparison
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4 // Used to disable logging completely
};

// Default configuration
const DEFAULT_CONFIG = {
  level: LOG_LEVELS.DEBUG, // Always use DEBUG for now
  enableTimestamps: true,
  enableColors: true,
  groupTimingLogs: true,
  showCallerInfo: true,
  maxArrayLength: 5, // Maximum number of array items to display
  maxObjectDepth: 2, // Maximum depth for object serialization
  truncateStringsAt: 150 // Maximum string length before truncation
};

// Store the current configuration
let config = { ...DEFAULT_CONFIG };

// Make config accessible via the loggerService object
function getConfig() {
  return config;
}

// CSS styles for different log types
const STYLES = {
  debug: 'color: #6c757d; font-weight: normal;',
  info: 'color: #0d6efd; font-weight: normal;',
  warn: 'color: #fd7e14; font-weight: bold;',
  error: 'color: #dc3545; font-weight: bold;',
  success: 'color: #198754; font-weight: bold;',
  time: 'color: #6610f2; font-weight: normal;',
  group: 'color: #0dcaf0; font-weight: bold;',
  groupCollapsed: 'color: #0dcaf0; font-weight: normal;',
  trace: 'color: #6c757d; font-size: 0.85em;',
  timestamp: 'color: #6c757d; font-style: italic;',
  caller: 'color: #6c757d; font-size: 0.85em; font-style: italic;'
};

// Active timers for performance tracking
const timers = new Map();

// Active log groups
const activeGroups = [];

/**
 * Get the current timestamp in a readable format
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
}

/**
 * Get information about the caller of the log function
 * @returns {string} Caller information
 */
function getCallerInfo() {
  try {
    const err = new Error();
    const stack = err.stack.split('\n');
    
    // Find the first line that's not part of the logger
    let callerLine = '';
    for (let i = 1; i < stack.length; i++) {
      if (!stack[i].includes('loggerService.js')) {
        callerLine = stack[i].trim();
        break;
      }
    }
    
    // Extract file and line information
    const match = callerLine.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || 
                  callerLine.match(/at\s+()(.*):(\d+):(\d+)/);
    
    if (match) {
      const [, func, file, line] = match;
      const fileName = file.split('/').pop();
      return `${fileName}${func ? `:${func}` : ''}:${line}`;
    }
    
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * Format a value for logging, handling objects, arrays, and long strings
 * @param {any} value - The value to format
 * @param {number} depth - Current depth for recursive calls
 * @returns {any} Formatted value
 */
function formatValue(value, depth = 0) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  
  const type = typeof value;
  
  // Handle primitive types
  if (type !== 'object') {
    if (type === 'string' && value.length > config.truncateStringsAt) {
      return `${value.substring(0, config.truncateStringsAt)}... (${value.length} chars)`;
    }
    return value;
  }
  
  // Stop at max depth
  if (depth >= config.maxObjectDepth) {
    return Array.isArray(value) 
      ? `[Array(${value.length})]` 
      : `{Object}`;
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    
    if (value.length > config.maxArrayLength) {
      const items = value.slice(0, config.maxArrayLength)
        .map(item => formatValue(item, depth + 1));
      return `[${items.join(', ')}... +${value.length - config.maxArrayLength} more]`;
    }
    
    const items = value.map(item => formatValue(item, depth + 1));
    return `[${items.join(', ')}]`;
  }
  
  // Handle objects
  try {
    if (value instanceof Error) {
      return `${value.name}: ${value.message}`;
    }
    
    if (value instanceof Date) {
      return value.toISOString();
    }
    
    if (value instanceof RegExp || value instanceof Map || value instanceof Set) {
      return value.toString();
    }
    
    // For DOM elements, return a simplified representation
    if (value.nodeType && value.nodeName) {
      return `<${value.nodeName.toLowerCase()}${value.id ? ` id="${value.id}"` : ''}>`;
    }
    
    // For other objects, format key-value pairs
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    
    const pairs = entries.map(([key, val]) => `${key}: ${formatValue(val, depth + 1)}`);
    return `{${pairs.join(', ')}}`;
  } catch (e) {
    return `[Object: ${Object.prototype.toString.call(value)}]`;
  }
}

/**
 * Format log arguments into a consistent structure
 * @param {Array} args - Arguments passed to the log function
 * @returns {Object} Formatted arguments with format string and values
 */
function formatLogArgs(args) {
  let formatString = '';
  const formatValues = [];
  
  // Add timestamp if enabled
  if (config.enableTimestamps) {
    formatString += '%c[' + getTimestamp() + '] ';
    formatValues.push(STYLES.timestamp);
  }
  
  // Add caller info if enabled
  if (config.showCallerInfo) {
    const callerInfo = getCallerInfo();
    if (callerInfo) {
      formatString += '%c[' + callerInfo + '] ';
      formatValues.push(STYLES.caller);
    }
  }
  
  // Process each argument
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // If the first argument is a string and contains format specifiers,
    // handle it specially
    if (i === 0 && typeof arg === 'string' && arg.includes('%c')) {
      formatString += arg;
    } else {
      // For regular arguments, just add them to the values array
      formatValues.push(formatValue(arg));
    }
  }
  
  return {
    formatString,
    formatValues
  };
}

/**
 * The main logger service object
 */
export const loggerService = {
  // Log level constants
  LEVELS: LOG_LEVELS,
  
  // Expose the current configuration
  get config() {
    return config;
  },
  
  /**
   * Configure the logger
   * @param {Object} options - Configuration options
   */
  configure(options = {}) {
    config = { ...DEFAULT_CONFIG, ...options };
    
    // Log the configuration change
    if (config.level <= LOG_LEVELS.DEBUG) {
      console.debug('%cLogger configuration updated:', STYLES.debug, config);
    }
    
    return this;
  },
  
  /**
   * Set the current log level
   * @param {number} level - The log level to set
   */
  setLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      config.level = level;
      
      // Log the level change
      if (config.level <= LOG_LEVELS.DEBUG) {
        console.debug('%cLogger level set to:', STYLES.debug, 
          Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level));
      }
    } else {
      console.error('%cInvalid log level:', STYLES.error, level);
    }
    
    return this;
  },
  
  /**
   * Log a debug message
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const prefix = config.enableColors ? '%cDEBUG: ' : 'DEBUG: ';
      const style = config.enableColors ? STYLES.debug : '';
      
      const { formatString, formatValues } = formatLogArgs(args);
      console.debug(prefix + formatString, style, ...formatValues);
    }
    
    return this;
  },
  
  /**
   * Log an info message
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    if (config.level <= LOG_LEVELS.INFO) {
      const prefix = config.enableColors ? '%cINFO: ' : 'INFO: ';
      const style = config.enableColors ? STYLES.info : '';
      
      const { formatString, formatValues } = formatLogArgs(args);
      console.info(prefix + formatString, style, ...formatValues);
    }
    
    return this;
  },
  
  /**
   * Log a warning message
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    if (config.level <= LOG_LEVELS.WARN) {
      const prefix = config.enableColors ? '%cWARN: ' : 'WARN: ';
      const style = config.enableColors ? STYLES.warn : '';
      
      const { formatString, formatValues } = formatLogArgs(args);
      console.warn(prefix + formatString, style, ...formatValues);
    }
    
    return this;
  },
  
  /**
   * Log an error message
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    if (config.level <= LOG_LEVELS.ERROR) {
      const prefix = config.enableColors ? '%cERROR: ' : 'ERROR: ';
      const style = config.enableColors ? STYLES.error : '';
      
      const { formatString, formatValues } = formatLogArgs(args);
      console.error(prefix + formatString, style, ...formatValues);
    }
    
    return this;
  },
  
  /**
   * Log a success message
   * @param {...any} args - Arguments to log
   */
  success(...args) {
    if (config.level <= LOG_LEVELS.INFO) {
      const prefix = config.enableColors ? '%cSUCCESS: ' : 'SUCCESS: ';
      const style = config.enableColors ? STYLES.success : '';
      
      const { formatString, formatValues } = formatLogArgs(args);
      console.log(prefix + formatString, style, ...formatValues);
    }
    
    return this;
  },
  
  /**
   * Start a timer for performance measurement
   * @param {string} label - Timer label
   */
  time(label) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const prefix = config.enableColors ? '%cTIME: ' : 'TIME: ';
      const style = config.enableColors ? STYLES.time : '';
      
      const { formatString, formatValues } = formatLogArgs([`Started timer "${label}"`]);
      console.log(prefix + formatString, style, ...formatValues);
      timers.set(label, performance.now());
    }
    
    return this;
  },
  
  /**
   * End a timer and log the elapsed time
   * @param {string} label - Timer label
   */
  timeEnd(label) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const prefix = config.enableColors ? '%cTIME: ' : 'TIME: ';
      const style = config.enableColors ? STYLES.time : '';
      
      if (timers.has(label)) {
        const startTime = timers.get(label);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        const { formatString, formatValues } = formatLogArgs([
          `Timer "${label}" completed in ${duration.toFixed(2)}ms`
        ]);
        console.log(prefix + formatString, style, ...formatValues);
        
        timers.delete(label);
      } else {
        const warnPrefix = config.enableColors ? '%cWARN: ' : 'WARN: ';
        const warnStyle = config.enableColors ? STYLES.warn : '';
        
        const { formatString, formatValues } = formatLogArgs([`Timer "${label}" does not exist`]);
        console.warn(warnPrefix + formatString, warnStyle, ...formatValues);
      }
    }
    
    return this;
  },
  
  /**
   * Log a message with the elapsed time since the timer started, but don't end the timer
   * @param {string} label - Timer label
   * @param {string} message - Message to log
   */
  timeLog(label, message) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const prefix = config.enableColors ? '%cTIME: ' : 'TIME: ';
      const style = config.enableColors ? STYLES.time : '';
      
      if (timers.has(label)) {
        const startTime = timers.get(label);
        const currentTime = performance.now();
        const elapsed = currentTime - startTime;
        
        const { formatString, formatValues } = formatLogArgs([
          `${message} (${elapsed.toFixed(2)}ms since "${label}" started)`
        ]);
        console.log(prefix + formatString, style, ...formatValues);
      } else {
        const warnPrefix = config.enableColors ? '%cWARN: ' : 'WARN: ';
        const warnStyle = config.enableColors ? STYLES.warn : '';
        
        const { formatString, formatValues } = formatLogArgs([`Timer "${label}" does not exist`]);
        console.warn(warnPrefix + formatString, warnStyle, ...formatValues);
      }
    }
    
    return this;
  },
  
  /**
   * Start a collapsible group in the console
   * @param {string} label - Group label
   */
  group(label) {
    if (config.level <= LOG_LEVELS.INFO) {
      const prefix = config.enableColors ? '%cGROUP: ' : 'GROUP: ';
      const style = config.enableColors ? STYLES.group : '';
      
      const { formatString, formatValues } = formatLogArgs([label]);
      console.group(prefix + formatString, style, ...formatValues);
      activeGroups.push(label);
    }
    
    return this;
  },
  
  /**
   * Start a collapsed group in the console
   * @param {string} label - Group label
   */
  groupCollapsed(label) {
    if (config.level <= LOG_LEVELS.INFO) {
      const prefix = config.enableColors ? '%cGROUP: ' : 'GROUP: ';
      const style = config.enableColors ? STYLES.groupCollapsed : '';
      
      const { formatString, formatValues } = formatLogArgs([label]);
      console.groupCollapsed(prefix + formatString, style, ...formatValues);
      activeGroups.push(label);
    }
    
    return this;
  },
  
  /**
   * End the current group
   */
  groupEnd() {
    if (config.level <= LOG_LEVELS.INFO && activeGroups.length > 0) {
      console.groupEnd();
      activeGroups.pop();
    }
    
    return this;
  },
  
  /**
   * Log a table of data
   * @param {Array|Object} data - Data to display in table format
   * @param {Array} columns - Optional columns to include
   */
  table(data, columns) {
    if (config.level <= LOG_LEVELS.INFO) {
      if (config.enableTimestamps) {
        console.log(`%c[${getTimestamp()}]`, STYLES.timestamp);
      }
      
      if (config.showCallerInfo) {
        const callerInfo = getCallerInfo();
        if (callerInfo) {
          console.log(`%c[${callerInfo}]`, STYLES.caller);
        }
      }
      
      console.table(data, columns);
    }
    
    return this;
  },
  
  /**
   * Log a stack trace
   * @param {string} message - Optional message to include
   */
  trace(message) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const prefix = config.enableColors ? '%cTRACE:' : 'TRACE:';
      const style = config.enableColors ? STYLES.trace : '';
      
      console.trace(prefix, style, ...formatLogArgs([message || 'Stack trace:']));
    }
    
    return this;
  },
  
  /**
   * Clear the console
   */
  clear() {
    console.clear();
    return this;
  },
  
  /**
   * Create a logger instance with a specific context
   * @param {string} context - The context name
   * @returns {Object} A logger instance with the specified context
   */
  createContextLogger(context) {
    const contextLogger = {};
    const contextStyle = `color: #0d6efd; font-weight: bold; background: rgba(13, 110, 253, 0.1); padding: 2px 4px; border-radius: 2px;`;
    
    // Create context-specific versions of each log method
    ['debug', 'info', 'warn', 'error', 'success'].forEach(method => {
      contextLogger[method] = (...args) => {
        if (config.level <= LOG_LEVELS[method.toUpperCase()] || 
            (method === 'success' && config.level <= LOG_LEVELS.INFO)) {
          const prefix = config.enableColors ? `%c[${context}]` : `[${context}]`;
          this[method](prefix, contextStyle, ...args);
        }
        return contextLogger;
      };
    });
    
    // Add other methods
    ['time', 'timeEnd', 'timeLog', 'group', 'groupCollapsed', 'groupEnd', 'table', 'trace', 'clear'].forEach(method => {
      contextLogger[method] = (...args) => {
        this[method](...args);
        return contextLogger;
      };
    });
    
    // Add specialized methods
    ['logDbOperation', 'logApiRequest', 'logApiResponse', 'logApiError', 'logLifecycle', 'logInteraction'].forEach(method => {
      contextLogger[method] = (...args) => {
        this[method](...args);
        return contextLogger;
      };
    });
    
    return contextLogger;
  },
  
  /**
   * Log an API request
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   */
  logApiRequest(method, url, options = {}) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      this.groupCollapsed(`API Request: ${method} ${url}`);
      this.debug('URL:', url);
      this.debug('Method:', method);
      
      if (options.headers) {
        this.debug('Headers:', options.headers);
      }
      
      if (options.body) {
        try {
          const bodyContent = typeof options.body === 'string' 
            ? JSON.parse(options.body) 
            : options.body;
          this.debug('Body:', bodyContent);
        } catch (e) {
          this.debug('Body:', options.body);
        }
      }
      
      this.groupEnd();
    }
    
    return this;
  },
  
  /**
   * Log an API response
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Response} response - Fetch API Response object
   * @param {Object} data - Response data
   * @param {number} duration - Request duration in ms
   */
  async logApiResponse(method, url, response, data, duration) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const status = response.status;
      const isSuccess = status >= 200 && status < 300;
      
      const logMethod = isSuccess ? 'groupCollapsed' : 'group';
      const statusStyle = isSuccess 
        ? 'color: #198754; font-weight: bold;' 
        : 'color: #dc3545; font-weight: bold;';
      
      this[logMethod](`API Response: ${method} ${url} %c${status} ${response.statusText}`, statusStyle);
      
      this.debug('URL:', url);
      this.debug('Status:', `${status} ${response.statusText}`);
      this.debug('Duration:', `${duration.toFixed(2)}ms`);
      
      if (response.headers) {
        this.debug('Headers:', Object.fromEntries([...response.headers.entries()]));
      }
      
      if (data !== undefined) {
        this.debug('Data:', data);
      }
      
      this.groupEnd();
    }
    
    return this;
  },
  
  /**
   * Log an API error
   * @param {string} method - HTTP method
   * @param {string} url - Request URL
   * @param {Error} error - Error object
   */
  logApiError(method, url, error) {
    if (config.level <= LOG_LEVELS.ERROR) {
      this.group(`API Error: ${method} ${url}`);
      this.error('URL:', url);
      this.error('Method:', method);
      this.error('Error:', error);
      
      if (error.response) {
        this.error('Status:', error.response.status);
        this.error('Status Text:', error.response.statusText);
      }
      
      this.groupEnd();
    }
    
    return this;
  },
  
  /**
   * Log a database operation
   * @param {string} operation - Operation name
   * @param {string} store - Object store name
   * @param {any} key - Key being operated on
   * @param {any} data - Data being stored (optional)
   */
  logDbOperation(operation, store, key, data) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      this.groupCollapsed(`DB Operation: ${operation} on ${store}`);
      this.debug('Store:', store);
      this.debug('Operation:', operation);
      this.debug('Key:', key);
      
      if (data !== undefined) {
        this.debug('Data:', data);
      }
      
      this.groupEnd();
    }
    
    return this;
  },
  
  /**
   * Log component lifecycle events
   * @param {string} component - Component name
   * @param {string} lifecycle - Lifecycle event name
   * @param {Object} props - Component props
   */
  logLifecycle(component, lifecycle, props) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const lifecycleStyle = 'color: #6f42c1; font-weight: bold;';
      this.debug(`%c${component} ${lifecycle}`, lifecycleStyle, props);
    }
    
    return this;
  },
  
  /**
   * Log user interactions
   * @param {string} component - Component name
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  logInteraction(component, event, data) {
    if (config.level <= LOG_LEVELS.DEBUG) {
      const interactionStyle = 'color: #fd7e14; font-weight: bold;';
      this.debug(`%c${component} ${event}`, interactionStyle, data);
    }
    
    return this;
  }
};

// Create pre-configured loggers for specific contexts
export const apiLogger = loggerService.createContextLogger('API');
export const dbLogger = loggerService.createContextLogger('DB');
export const uiLogger = loggerService.createContextLogger('UI');
export const cacheLogger = loggerService.createContextLogger('Cache');
export const networkLogger = loggerService.createContextLogger('Network');

// Export a default instance
export default loggerService;
