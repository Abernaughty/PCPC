/**
 * Runtime Configuration for PCPC Frontend
 *
 * This module provides runtime environment configuration using Azure Static Web App
 * Application Settings. Configuration is injected at runtime via window.__ENV__,
 * with fallback to Vite environment variables for local development.
 *
 * This approach follows 12-Factor App principles and Azure best practices:
 * - Single build artifact works across all environments
 * - No secrets in build artifacts
 * - Configuration via environment at runtime
 */

/**
 * Application configuration interface
 */
export interface AppConfig {
  /** Base URL for the API (e.g., https://pcpc-apim-prod.azure-api.net/pcpc-api/v1) */
  apiUrl: string;
  /** Enable debug logging */
  enableDebug: boolean;
}

/**
 * Runtime environment variables injected by Azure Static Web Apps
 * These are set via Application Settings in Azure Portal
 */
interface RuntimeEnv {
  API_URL?: string;
  DEBUG?: string;
}

/**
 * Declare global window.__ENV__ for runtime configuration
 */
declare global {
  interface Window {
    __ENV__?: RuntimeEnv;
  }
}

/**
 * Get runtime configuration from Azure Static Web App or local environment
 *
 * Priority order:
 * 1. window.__ENV__ (Azure SWA runtime injection)
 * 2. import.meta.env.VITE_* (Vite environment variables for local dev)
 * 3. Defaults (for development)
 *
 * @returns {AppConfig} Application configuration
 */
export function getRuntimeConfig(): AppConfig {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== "undefined";

  // Try to get configuration from Azure SWA runtime injection
  const runtimeEnv = isBrowser ? window.__ENV__ : undefined;

  // Get API URL with fallback chain
  let apiUrl: string;
  if (runtimeEnv?.API_URL) {
    // Azure SWA runtime configuration (production/staging)
    apiUrl = runtimeEnv.API_URL;
  } else if (typeof import.meta.env.VITE_API_URL === "string") {
    // Vite environment variable (local development)
    apiUrl = import.meta.env.VITE_API_URL;
  } else {
    // Default fallback for local development
    apiUrl = "http://localhost:7071/api";
  }

  // Get debug flag with fallback chain
  let enableDebug: boolean;
  if (runtimeEnv?.DEBUG !== undefined) {
    // Azure SWA runtime configuration
    enableDebug = runtimeEnv.DEBUG === "true" || runtimeEnv.DEBUG === "1";
  } else if (typeof import.meta.env.VITE_DEBUG === "string") {
    // Vite environment variable (local development)
    enableDebug =
      import.meta.env.VITE_DEBUG === "true" ||
      import.meta.env.VITE_DEBUG === "1";
  } else {
    // Default to true for development
    enableDebug = true;
  }

  const config: AppConfig = {
    apiUrl,
    enableDebug,
  };

  // Log configuration in debug mode (helps with troubleshooting)
  if (config.enableDebug && isBrowser) {
    console.log("[RuntimeConfig] Configuration loaded:", {
      apiUrl: config.apiUrl,
      enableDebug: config.enableDebug,
      source: runtimeEnv
        ? "Azure SWA (window.__ENV__)"
        : "Local Dev (import.meta.env)",
    });
  }

  return config;
}

/**
 * Validate that required configuration is present
 * Useful for startup checks
 *
 * @returns {boolean} True if configuration is valid
 */
export function validateConfig(): boolean {
  try {
    const config = getRuntimeConfig();

    if (!config.apiUrl) {
      console.error("[RuntimeConfig] API URL is not configured");
      return false;
    }

    // Validate URL format
    try {
      new URL(config.apiUrl);
    } catch (error) {
      console.error("[RuntimeConfig] Invalid API URL format:", config.apiUrl);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[RuntimeConfig] Configuration validation failed:", error);
    return false;
  }
}
