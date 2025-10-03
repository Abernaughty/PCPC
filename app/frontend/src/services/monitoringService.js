/**
 * Frontend Monitoring Service
 *
 * Provides comprehensive Application Insights telemetry for the PCPC frontend.
 * This service mirrors the backend MonitoringService pattern for consistency.
 *
 * Features:
 * - Automatic page view tracking
 * - Custom event tracking
 * - Performance metrics
 * - Error tracking with context
 * - Distributed tracing correlation
 * - Core Web Vitals integration
 */

import { ApplicationInsights } from "@microsoft/applicationinsights-web";

class MonitoringService {
  constructor() {
    this.appInsights = null;
    this.isInitialized = false;
    // Safe access to import.meta.env with fallbacks
    const env = import.meta.env || {};
    this.environment = env.VITE_ENVIRONMENT || "development";
    this.appVersion = env.VITE_APP_VERSION || "0.2.0";
    this.roleName = env.VITE_APPLICATIONINSIGHTS_ROLE_NAME || "pcpc-frontend";
  }

  /**
   * Initialize Application Insights
   * Should be called once at application startup
   */
  initialize() {
    // Safe access to import.meta.env with fallbacks
    const env = import.meta.env || {};
    const connectionString = env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;

    // Graceful degradation if Application Insights not configured
    if (!connectionString) {
      console.warn(
        "Application Insights connection string not configured. Monitoring disabled."
      );
      return;
    }

    try {
      this.appInsights = new ApplicationInsights({
        config: {
          connectionString,
          enableAutoRouteTracking: true, // Track SPA route changes
          enableCorsCorrelation: true, // Enable distributed tracing
          enableRequestHeaderTracking: true,
          enableResponseHeaderTracking: true,
          disableFetchTracking: false, // Track fetch calls
          disableAjaxTracking: false, // Track AJAX calls
          disableExceptionTracking: false, // Track exceptions
          autoTrackPageVisitTime: true, // Track time on page
          enableUnhandledPromiseRejectionTracking: true,

          // Sampling configuration (100% in dev, 10% in production)
          samplingPercentage: this.environment === "development" ? 100 : 10,

          // Disable telemetry in development if needed
          disableTelemetry: false,

          // Performance optimizations
          maxBatchSizeInBytes: 10000,
          maxBatchInterval: 15000,
        },
      });

      this.appInsights.loadAppInsights();

      // Set cloud role name for distributed tracing
      this.appInsights.addTelemetryInitializer((envelope) => {
        envelope.tags = envelope.tags || [];
        envelope.tags["ai.cloud.role"] = this.roleName;
        envelope.tags["ai.cloud.roleInstance"] = window.location.hostname;

        // Add custom properties to all telemetry
        envelope.data = envelope.data || {};
        envelope.data.environment = this.environment;
        envelope.data.appVersion = this.appVersion;
        envelope.data.timestamp = new Date().toISOString();
      });

      this.isInitialized = true;
      console.log(
        `Application Insights initialized for ${this.roleName} (${this.environment})`
      );
    } catch (error) {
      console.error("Failed to initialize Application Insights:", error);
      this.isInitialized = false;
    }
  }

  /**
   * Track a custom event
   * @param {string} name - Event name
   * @param {Object} properties - Custom properties
   * @param {Object} measurements - Custom measurements
   */
  trackEvent(name, properties = {}, measurements = {}) {
    if (!this.isInitialized) return;

    try {
      this.appInsights.trackEvent({
        name,
        properties: {
          ...properties,
          environment: this.environment,
          appVersion: this.appVersion,
          timestamp: new Date().toISOString(),
        },
        measurements,
      });
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  }

  /**
   * Track a page view
   * @param {string} name - Page name
   * @param {string} uri - Page URI
   * @param {Object} properties - Custom properties
   * @param {Object} measurements - Custom measurements
   */
  trackPageView(name, uri, properties = {}, measurements = {}) {
    if (!this.isInitialized) return;

    try {
      this.appInsights.trackPageView({
        name,
        uri,
        properties: {
          ...properties,
          environment: this.environment,
          appVersion: this.appVersion,
        },
        measurements,
      });
    } catch (error) {
      console.error("Error tracking page view:", error);
    }
  }

  /**
   * Track a custom metric
   * @param {string} name - Metric name
   * @param {number} average - Metric value
   * @param {Object} properties - Custom properties
   */
  trackMetric(name, average, properties = {}) {
    if (!this.isInitialized) return;

    try {
      this.appInsights.trackMetric({
        name,
        average,
        properties: {
          ...properties,
          environment: this.environment,
          appVersion: this.appVersion,
        },
      });
    } catch (error) {
      console.error("Error tracking metric:", error);
    }
  }

  /**
   * Track an exception
   * @param {Error} exception - Error object
   * @param {Object} properties - Custom properties
   * @param {number} severityLevel - Severity level (0-4)
   */
  trackException(exception, properties = {}, severityLevel = 3) {
    if (!this.isInitialized) {
      console.error("Exception (monitoring disabled):", exception);
      return;
    }

    try {
      this.appInsights.trackException({
        exception,
        severityLevel,
        properties: {
          ...properties,
          environment: this.environment,
          appVersion: this.appVersion,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          url: window.location.href,
        },
      });
    } catch (error) {
      console.error("Error tracking exception:", error);
    }
  }

  /**
   * Track a trace/log message
   * @param {string} message - Log message
   * @param {number} severityLevel - Severity level (0-4)
   * @param {Object} properties - Custom properties
   */
  trackTrace(message, severityLevel = 1, properties = {}) {
    if (!this.isInitialized) return;

    try {
      this.appInsights.trackTrace({
        message,
        severityLevel,
        properties: {
          ...properties,
          environment: this.environment,
          appVersion: this.appVersion,
        },
      });
    } catch (error) {
      console.error("Error tracking trace:", error);
    }
  }

  /**
   * Track a dependency (external API call)
   * @param {string} id - Unique identifier
   * @param {string} name - Dependency name
   * @param {string} data - Request data/URL
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Success status
   * @param {number} resultCode - HTTP status code
   * @param {Object} properties - Custom properties
   */
  trackDependency(
    id,
    name,
    data,
    duration,
    success,
    resultCode,
    properties = {}
  ) {
    if (!this.isInitialized) return;

    try {
      this.appInsights.trackDependencyData({
        id,
        name,
        data,
        duration,
        success,
        resultCode,
        properties: {
          ...properties,
          environment: this.environment,
          appVersion: this.appVersion,
        },
      });
    } catch (error) {
      console.error("Error tracking dependency:", error);
    }
  }

  /**
   * Start a performance timer
   * @param {string} name - Timer name (optional)
   * @returns {Function} Timer function that returns elapsed time when called
   */
  startTimer(name) {
    const startTime = performance.now();

    // Return a function that can be called to get elapsed time
    const timerFunc = (properties = {}) => {
      const duration = performance.now() - startTime;
      if (name) {
        this.trackMetric(name, duration, {
          ...properties,
          unit: "milliseconds",
        });
      }
      return duration;
    };

    // Keep the stop method for backward compatibility
    timerFunc.stop = timerFunc;

    return timerFunc;
  }

  /**
   * Create a correlation ID for distributed tracing
   * @returns {string} Correlation ID
   */
  createCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current operation ID for distributed tracing
   * @returns {string|null} Operation ID
   */
  getOperationId() {
    if (!this.isInitialized) return null;

    try {
      const context = this.appInsights.context;
      return context?.telemetryTrace?.traceID || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set user context
   * @param {string} userId - User ID
   * @param {string} accountId - Account ID
   * @param {Object} properties - Additional user properties
   */
  setUserContext(userId, accountId = null, properties = {}) {
    if (!this.isInitialized) return;

    try {
      this.appInsights.setAuthenticatedUserContext(userId, accountId);

      // Add custom user properties
      Object.entries(properties).forEach(([key, value]) => {
        this.appInsights.addTelemetryInitializer((envelope) => {
          envelope.data = envelope.data || {};
          envelope.data[`user_${key}`] = value;
        });
      });
    } catch (error) {
      console.error("Error setting user context:", error);
    }
  }

  /**
   * Clear user context
   */
  clearUserContext() {
    if (!this.isInitialized) return;

    try {
      this.appInsights.clearAuthenticatedUserContext();
    } catch (error) {
      console.error("Error clearing user context:", error);
    }
  }

  /**
   * Flush telemetry buffer
   * Useful before page unload
   */
  flush() {
    if (!this.isInitialized) return;

    try {
      this.appInsights.flush();
    } catch (error) {
      console.error("Error flushing telemetry:", error);
    }
  }

  /**
   * Track Core Web Vitals
   * @param {Object} metric - Web Vitals metric
   */
  trackWebVital(metric) {
    if (!this.isInitialized) return;

    try {
      const { name, value, rating, delta, id } = metric;

      this.trackMetric(`webvital.${name.toLowerCase()}`, value, {
        rating,
        delta,
        id,
        unit: name === "CLS" ? "score" : "milliseconds",
      });

      // Track as event for easier querying
      this.trackEvent("web_vital", {
        metric: name,
        value: value.toString(),
        rating,
        id,
      });
    } catch (error) {
      console.error("Error tracking web vital:", error);
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();

// Export class for testing
export { MonitoringService };
