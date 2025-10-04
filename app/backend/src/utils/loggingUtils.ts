import { InvocationContext } from "@azure/functions";

/**
 * Enum for log levels to control verbosity
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * Enhanced logging utility that ensures logs are properly captured
 * in Azure Functions, even with asynchronous operations
 */
export class LogManager {
  private logs: string[] = [];
  private context: InvocationContext;
  private correlationId: string;
  private level: LogLevel;

  constructor(context: InvocationContext, correlationId: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.correlationId = correlationId;
    this.level = level;
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    if (this.level >= LogLevel.ERROR) {
      this.logWithLevel("ERROR", message);
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.level >= LogLevel.WARN) {
      this.logWithLevel("WARN", message);
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.level >= LogLevel.INFO) {
      this.logWithLevel("INFO", message);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    if (this.level >= LogLevel.DEBUG) {
      this.logWithLevel("DEBUG", message);
    }
  }

  /**
   * Log a trace message
   */
  trace(message: string): void {
    if (this.level >= LogLevel.TRACE) {
      this.logWithLevel("TRACE", message);
    }
  }

  /**
   * Log a message with a specific level
   */
  private logWithLevel(level: string, message: string): void {
    const formattedMessage = `[${this.correlationId}] ${level}: ${message}`;
    this.logs.push(formattedMessage);
    // Write immediately but also queue for final flush
    this.context.log(formattedMessage);
  }

  /**
   * Flush all buffered logs to ensure they're captured
   */
  async flush(): Promise<void> {
    // Force a small delay to ensure logs are processed
    return new Promise<void>(resolve => {
      setTimeout(() => {
        // Re-log everything one more time to ensure it's captured
        if (this.logs.length > 0) {
          this.context.log(`[${this.correlationId}] FLUSH: Flushing ${this.logs.length} buffered logs`);
          this.logs.forEach(message => {
            this.context.log(`FLUSH: ${message}`);
          });
        }
        resolve();
      }, 100);
    });
  }

  /**
   * Time an operation and log its duration
   */
  async timeOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    this.info(`Starting operation: ${name}`);
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.info(`Completed operation: ${name} in ${duration}ms`);
      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.error(`Failed operation: ${name} after ${duration}ms: ${error.message}`);
      throw error;
    }
  }
}
