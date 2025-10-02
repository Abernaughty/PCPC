/**
 * Core Web Vitals Integration
 *
 * Tracks Google's Core Web Vitals metrics and sends them to Application Insights.
 * These metrics are critical for understanding user experience and page performance.
 *
 * Metrics tracked:
 * - LCP (Largest Contentful Paint) - Loading performance
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - INP (Interaction to Next Paint) - Responsiveness (replaces FID)
 * - TTFB (Time to First Byte) - Server response time
 * - FCP (First Contentful Paint) - Initial rendering
 */

import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals";
import { monitoringService } from "../services/monitoringService";

/**
 * Performance thresholds based on Google's recommendations
 * https://web.dev/vitals/
 */
const THRESHOLDS = {
  LCP: {
    good: 2500,
    needsImprovement: 4000,
  },
  CLS: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  INP: {
    good: 200,
    needsImprovement: 500,
  },
  TTFB: {
    good: 800,
    needsImprovement: 1800,
  },
  FCP: {
    good: 1800,
    needsImprovement: 3000,
  },
};

/**
 * Determine the rating for a metric value
 * @param {string} metricName - Name of the metric
 * @param {number} value - Metric value
 * @returns {string} Rating: 'good', 'needs-improvement', or 'poor'
 */
function getRating(metricName, value) {
  const threshold = THRESHOLDS[metricName];
  if (!threshold) return "unknown";

  if (value <= threshold.good) return "good";
  if (value <= threshold.needsImprovement) return "needs-improvement";
  return "poor";
}

/**
 * Send metric to Application Insights
 * @param {Object} metric - Web Vitals metric object
 */
function sendToAnalytics(metric) {
  const { name, value, rating, delta, id, navigationType } = metric;

  // Calculate our own rating based on thresholds
  const customRating = getRating(name, value);

  // Track as both metric and event for flexibility in querying
  monitoringService.trackWebVital({
    name,
    value,
    rating: customRating,
    delta,
    id,
  });

  // Log to console in development
  if (import.meta.env.VITE_ENVIRONMENT === "development") {
    console.log(`[Web Vitals] ${name}:`, {
      value: Math.round(value),
      rating: customRating,
      delta: Math.round(delta),
      navigationType,
    });
  }

  // Track poor performance as warnings
  if (customRating === "poor") {
    monitoringService.trackTrace(
      `Poor ${name} performance detected: ${Math.round(value)}ms`,
      2, // Warning severity
      {
        metric: name,
        value: value.toString(),
        rating: customRating,
        threshold: THRESHOLDS[name].needsImprovement,
      }
    );
  }
}

/**
 * Initialize Core Web Vitals tracking
 * Should be called once at application startup
 */
export function initWebVitals() {
  try {
    // Track Largest Contentful Paint (LCP)
    // Measures loading performance
    onLCP(sendToAnalytics);

    // Track Cumulative Layout Shift (CLS)
    // Measures visual stability
    onCLS(sendToAnalytics);

    // Track Interaction to Next Paint (INP)
    // Measures responsiveness (replaces deprecated FID)
    onINP(sendToAnalytics);

    // Track Time to First Byte (TTFB)
    // Measures server response time
    onTTFB(sendToAnalytics);

    // Track First Contentful Paint (FCP)
    // Measures initial rendering
    onFCP(sendToAnalytics);

    console.log("[Web Vitals] Core Web Vitals tracking initialized");
  } catch (error) {
    console.error("[Web Vitals] Failed to initialize:", error);
    monitoringService.trackException(error, {
      context: "webVitals.init",
    });
  }
}

/**
 * Get current Web Vitals summary
 * Useful for debugging and development
 * @returns {Promise<Object>} Summary of current metrics
 */
export async function getWebVitalsSummary() {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {},
  };

  try {
    // Get current values (these are promises in web-vitals v3+)
    const metrics = await Promise.all([
      new Promise((resolve) => onLCP(resolve, { reportAllChanges: true })),
      new Promise((resolve) => onCLS(resolve, { reportAllChanges: true })),
      new Promise((resolve) => onINP(resolve, { reportAllChanges: true })),
      new Promise((resolve) => onTTFB(resolve, { reportAllChanges: true })),
      new Promise((resolve) => onFCP(resolve, { reportAllChanges: true })),
    ]);

    metrics.forEach((metric) => {
      if (metric) {
        summary.metrics[metric.name] = {
          value: Math.round(metric.value),
          rating: getRating(metric.name, metric.value),
          id: metric.id,
        };
      }
    });
  } catch (error) {
    console.error("[Web Vitals] Failed to get summary:", error);
  }

  return summary;
}

/**
 * Export thresholds for use in other modules
 */
export { THRESHOLDS };
