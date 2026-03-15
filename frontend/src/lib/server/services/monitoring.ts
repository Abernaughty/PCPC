export interface IMonitoringService {
  trackEvent(name: string, properties?: Record<string, any>): void;
  trackMetric(name: string, value: number, properties?: Record<string, any>): void;
  trackException(error: Error, properties?: Record<string, any>): void;
  startTimer(): () => number;
  createCorrelationId(): string;
}

export class MonitoringService implements IMonitoringService {
  private environment: string;
  private version: string;

  constructor(environment: string = 'production', version: string = '1.0.0') {
    this.environment = environment;
    this.version = version;
  }

  trackEvent(name: string, properties?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      level: 'info',
      event: name,
      timestamp,
      properties: properties || {},
    };

    console.log(`[EVENT] ${JSON.stringify(logEntry)}`);
  }

  trackMetric(name: string, value: number, properties?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      level: 'metric',
      metric: name,
      value,
      timestamp,
      properties: properties || {},
    };

    console.log(`[METRIC] ${JSON.stringify(logEntry)}`);
  }

  trackException(error: Error, properties?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      level: 'error',
      error: error.message,
      stack: error.stack,
      timestamp,
      properties: properties || {},
    };

    console.error(`[EXCEPTION] ${JSON.stringify(logEntry)}`);
  }

  startTimer(): () => number {
    const start = Date.now();
    return () => Date.now() - start;
  }

  createCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  getEnvironment(): string {
    return this.environment;
  }

  getVersion(): string {
    return this.version;
  }
}

export const monitoring = new MonitoringService(
  process.env.NODE_ENV || 'production',
  process.env.VERSION || '1.0.0'
);
