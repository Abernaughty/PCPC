/**
 * Logger Service - Console-based logging with levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'debug';

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

export const logger = {
  setLevel(level: LogLevel) {
    currentLevel = level;
  },

  debug(...args: unknown[]) {
    if (shouldLog('debug')) console.debug('[PCPC]', ...args);
  },

  info(...args: unknown[]) {
    if (shouldLog('info')) console.info('[PCPC]', ...args);
  },

  warn(...args: unknown[]) {
    if (shouldLog('warn')) console.warn('[PCPC]', ...args);
  },

  error(...args: unknown[]) {
    if (shouldLog('error')) console.error('[PCPC]', ...args);
  },

  /**
   * Start a performance timer
   * Returns a function that logs elapsed time when called
   */
  startTimer(label?: string) {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (label) logger.debug(`${label}: ${duration.toFixed(2)}ms`);
      return duration;
    };
  },
};

/**
 * Create a logger with a specific context prefix
 */
export function createContextLogger(context: string) {
  return {
    debug: (...args: unknown[]) =>
      logger.debug(`[${context}]`, ...args),
    info: (...args: unknown[]) =>
      logger.info(`[${context}]`, ...args),
    warn: (...args: unknown[]) =>
      logger.warn(`[${context}]`, ...args),
    error: (...args: unknown[]) =>
      logger.error(`[${context}]`, ...args),
  };
}
