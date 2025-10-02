import { useAzureMonitor } from "@azure/monitor-opentelemetry";
import { SpanStatusCode, trace } from "@opentelemetry/api";

/**
 * MonitoringService - Centralized telemetry and monitoring service
 *
 * Provides comprehensive Application Insights integration for Azure Functions
 * with custom events, metrics, exceptions, dependencies, and traces.
 *
 * Features:
 * - Singleton pattern for consistent telemetry across functions
 * - Automatic context enrichment with function metadata
 * - Graceful degradation if Application Insights unavailable
 * - Environment-aware logging levels
 * - Correlation ID management for distributed tracing
 */
export class MonitoringService {
  private static instance: MonitoringService;
  private tracer: any;
  private isInitialized: boolean = false;
  private environment: string;
  private version: string;

  private constructor() {
    this.environment = process.env.AZURE_FUNCTIONS_ENVIRONMENT || "development";
    this.version = process.env.APP_VERSION || "1.8.1";
    this.initialize();
  }

  /**
   * Get singleton instance of MonitoringService
   */
  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Initialize Application Insights with Azure Monitor
   */
  private initialize(): void {
    try {
      const connectionString =
        process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

      if (!connectionString) {
        console.warn(
          "[MonitoringService] Application Insights connection string not configured. Telemetry will be logged to console only."
        );
        this.isInitialized = false;
        return;
      }

      // Initialize Azure Monitor with OpenTelemetry
      useAzureMonitor({
        azureMonitorExporterOptions: {
          connectionString: connectionString,
        },
        samplingRatio: this.getSamplingRatio(),
      });

      this.tracer = trace.getTracer("pcpc-backend", this.version);
      this.isInitialized = true;

      console.log(
        "[MonitoringService] Application Insights initialized successfully"
      );
    } catch (error) {
      console.error(
        "[MonitoringService] Failed to initialize Application Insights:",
        error
      );
      this.isInitialized = false;
    }
  }

  /**
   * Get sampling ratio based on environment
   */
  private getSamplingRatio(): number {
    const configuredRatio = process.env.APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE;
    if (configuredRatio) {
      return parseFloat(configuredRatio) / 100;
    }
    // Default: 100% in dev, 10% in production
    return this.environment === "production" ? 0.1 : 1.0;
  }

  /**
   * Track a custom event
   * @param name Event name
   * @param properties Additional properties
   */
  public trackEvent(name: string, properties?: Record<string, any>): void {
    const enrichedProperties = this.enrichProperties(properties);

    if (this.isInitialized && this.tracer) {
      const span = this.tracer.startSpan(name, {
        kind: 1, // SpanKind.INTERNAL
      });

      Object.entries(enrichedProperties).forEach(([key, value]) => {
        span.setAttribute(key, JSON.stringify(value));
      });

      span.end();
    }

    // Always log to console for development visibility
    console.log(`[Event] ${name}`, enrichedProperties);
  }

  /**
   * Track a custom metric
   * @param name Metric name
   * @param value Metric value
   * @param properties Additional properties
   */
  public trackMetric(
    name: string,
    value: number,
    properties?: Record<string, any>
  ): void {
    const enrichedProperties = this.enrichProperties(properties);

    if (this.isInitialized && this.tracer) {
      const span = this.tracer.startSpan(`metric.${name}`, {
        kind: 1, // SpanKind.INTERNAL
      });

      span.setAttribute("metric.name", name);
      span.setAttribute("metric.value", value);

      Object.entries(enrichedProperties).forEach(([key, val]) => {
        span.setAttribute(key, JSON.stringify(val));
      });

      span.end();
    }

    console.log(`[Metric] ${name}: ${value}`, enrichedProperties);
  }

  /**
   * Track an exception
   * @param error Error object
   * @param properties Additional properties
   */
  public trackException(error: Error, properties?: Record<string, any>): void {
    const enrichedProperties = this.enrichProperties({
      ...properties,
      errorMessage: error.message,
      errorStack: error.stack,
      errorName: error.name,
    });

    if (this.isInitialized && this.tracer) {
      const span = this.tracer.startSpan("exception", {
        kind: 1, // SpanKind.INTERNAL
      });

      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

      Object.entries(enrichedProperties).forEach(([key, value]) => {
        span.setAttribute(key, JSON.stringify(value));
      });

      span.end();
    }

    console.error(
      `[Exception] ${error.name}: ${error.message}`,
      enrichedProperties
    );
  }

  /**
   * Track a dependency call (external API, database, etc.)
   * @param name Dependency name
   * @param type Dependency type (HTTP, SQL, etc.)
   * @param data Dependency data (URL, query, etc.)
   * @param duration Duration in milliseconds
   * @param success Whether the call was successful
   * @param properties Additional properties
   */
  public trackDependency(
    name: string,
    type: string,
    data: string,
    duration: number,
    success: boolean,
    properties?: Record<string, any>
  ): void {
    const enrichedProperties = this.enrichProperties({
      ...properties,
      dependencyType: type,
      dependencyData: data,
      duration: duration,
      success: success,
    });

    if (this.isInitialized && this.tracer) {
      const span = this.tracer.startSpan(`dependency.${name}`, {
        kind: 3, // SpanKind.CLIENT
      });

      span.setAttribute("dependency.name", name);
      span.setAttribute("dependency.type", type);
      span.setAttribute("dependency.data", data);
      span.setAttribute("dependency.duration", duration);
      span.setAttribute("dependency.success", success);

      if (!success) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      }

      Object.entries(enrichedProperties).forEach(([key, value]) => {
        span.setAttribute(key, JSON.stringify(value));
      });

      span.end();
    }

    const status = success ? "SUCCESS" : "FAILED";
    console.log(
      `[Dependency] ${name} (${type}): ${status} - ${duration}ms`,
      enrichedProperties
    );
  }

  /**
   * Track a diagnostic trace
   * @param message Trace message
   * @param severity Severity level (0=Verbose, 1=Info, 2=Warning, 3=Error, 4=Critical)
   * @param properties Additional properties
   */
  public trackTrace(
    message: string,
    severity: number = 1,
    properties?: Record<string, any>
  ): void {
    const enrichedProperties = this.enrichProperties({
      ...properties,
      severity: this.getSeverityName(severity),
    });

    if (this.isInitialized && this.tracer) {
      const span = this.tracer.startSpan("trace", {
        kind: 1, // SpanKind.INTERNAL
      });

      span.setAttribute("trace.message", message);
      span.setAttribute("trace.severity", severity);

      Object.entries(enrichedProperties).forEach(([key, value]) => {
        span.setAttribute(key, JSON.stringify(value));
      });

      span.end();
    }

    const severityName = this.getSeverityName(severity);
    console.log(`[Trace:${severityName}] ${message}`, enrichedProperties);
  }

  /**
   * Start a performance timing operation
   * @param operationName Name of the operation to time
   * @returns Object with end() method to complete timing
   */
  public startOperation(operationName: string): {
    end: (properties?: Record<string, any>) => void;
  } {
    const startTime = Date.now();

    return {
      end: (properties?: Record<string, any>) => {
        const duration = Date.now() - startTime;
        this.trackMetric(`${operationName}.duration`, duration, properties);
      },
    };
  }

  /**
   * Create a correlation ID for distributed tracing
   * @returns Correlation ID string
   */
  public createCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Enrich properties with standard context
   */
  private enrichProperties(
    properties?: Record<string, any>
  ): Record<string, any> {
    return {
      environment: this.environment,
      version: this.version,
      timestamp: new Date().toISOString(),
      ...properties,
    };
  }

  /**
   * Get severity name from numeric level
   */
  private getSeverityName(severity: number): string {
    const severityMap: Record<number, string> = {
      0: "Verbose",
      1: "Information",
      2: "Warning",
      3: "Error",
      4: "Critical",
    };
    return severityMap[severity] || "Information";
  }

  /**
   * Check if monitoring is initialized and operational
   */
  public isOperational(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current environment
   */
  public getEnvironment(): string {
    return this.environment;
  }

  /**
   * Get current version
   */
  public getVersion(): string {
    return this.version;
  }
}

// Export singleton instance for convenience
export const monitoring = MonitoringService.getInstance();
