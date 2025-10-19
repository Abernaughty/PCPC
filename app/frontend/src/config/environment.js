// Environment Configuration
// This file handles environment variables and configuration for different environments

// Load environment variables from .env file in Node.js environment
if (
  typeof process !== "undefined" &&
  process.env &&
  typeof require !== "undefined"
) {
  try {
    const dotenv = require("dotenv");
    dotenv.config();
  } catch (error) {
    // dotenv not available, continue without it
  }
}

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable key
 * @param {string} fallback - Fallback value if environment variable is not set
 * @returns {string} Environment variable value or fallback
 */
function getEnvVar(key, fallback = "") {
  // In browser environment, we can't access process.env directly
  // Instead, we'll use a configuration object that can be set during build
  if (typeof window !== "undefined") {
    // Browser environment - use window.__ENV__ if available (set during build)
    return window.__ENV__?.[key] || fallback;
  }

  // Node.js environment (for build scripts, tests, etc.)
  return process.env[key] || fallback;
}

/**
 * Environment configuration
 */
export const ENV_CONFIG = {
  // Environment type
  NODE_ENV: process.env.NODE_ENV || "development",

  // API Management configuration
  APIM_BASE_URL: getEnvVar(
    "APIM_BASE_URL",
    "https://pcpc-apim-dev.azure-api.net/pcpc-api"
  ),
  APIM_SUBSCRIPTION_KEY: getEnvVar("APIM_SUBSCRIPTION_KEY", ""),

  // Azure Functions configuration (for direct calls in development/testing)
  AZURE_FUNCTIONS_BASE_URL: getEnvVar(
    "AZURE_FUNCTIONS_BASE_URL",
    "https://pokedata-func.azurewebsites.net/api"
  ),
  AZURE_FUNCTION_KEY: getEnvVar("AZURE_FUNCTION_KEY", ""),

  // Feature flags
  USE_API_MANAGEMENT: (getEnvVar("USE_API_MANAGEMENT", "false") || "false") ===
    "true",

  // Debug settings
  DEBUG_API: (getEnvVar("DEBUG_API", "false") || "false") === "true",
};

/**
 * Check if we're in development mode
 */
export const isDevelopment = () => ENV_CONFIG.NODE_ENV === "development";

/**
 * Check if we're in production mode
 */
export const isProduction = () => ENV_CONFIG.NODE_ENV === "production";

/**
 * Check if we're using local Azure Functions (localhost)
 */
const isLocalFunctions = (baseUrl) => {
  return (
    baseUrl && (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1"))
  );
};

/**
 * Get API configuration based on environment
 */
export const getApiConfig = () => {
  if (ENV_CONFIG.USE_API_MANAGEMENT) {
    const headers = { "Content-Type": "application/json" };
    if (ENV_CONFIG.APIM_SUBSCRIPTION_KEY) {
      headers["Ocp-Apim-Subscription-Key"] = ENV_CONFIG.APIM_SUBSCRIPTION_KEY;
    }

    return {
      baseUrl: ENV_CONFIG.APIM_BASE_URL,
      subscriptionKey: ENV_CONFIG.APIM_SUBSCRIPTION_KEY,
      authType: "subscription",
      getHeaders() {
        return headers;
      },
    };
  } else {
    // Check if we're using local functions
    const isLocal = isLocalFunctions(ENV_CONFIG.AZURE_FUNCTIONS_BASE_URL);

    return {
      baseUrl: ENV_CONFIG.AZURE_FUNCTIONS_BASE_URL,
      functionKey: ENV_CONFIG.AZURE_FUNCTION_KEY,
      // Use 'none' for localhost, 'function' for production Azure Functions
      authType: isLocal ? "none" : "function",
      getHeaders() {
        return {
          "Content-Type": "application/json",
        };
      },
    };
  }
};

/**
 * Validate required environment variables
 */
export const validateEnvironment = () => {
  const errors = [];

  // Only require function key for non-local environments
  const isLocal = isLocalFunctions(ENV_CONFIG.AZURE_FUNCTIONS_BASE_URL);
  if (
    !ENV_CONFIG.USE_API_MANAGEMENT &&
    !isLocal &&
    !ENV_CONFIG.AZURE_FUNCTION_KEY
  ) {
    errors.push(
      "AZURE_FUNCTION_KEY is required when USE_API_MANAGEMENT is false and not using localhost"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Log configuration in development
if (isDevelopment() && ENV_CONFIG.DEBUG_API) {
  console.log("Environment Configuration:", {
    NODE_ENV: ENV_CONFIG.NODE_ENV,
    USE_API_MANAGEMENT: ENV_CONFIG.USE_API_MANAGEMENT,
    APIM_BASE_URL: ENV_CONFIG.APIM_BASE_URL,
    AZURE_FUNCTIONS_BASE_URL: ENV_CONFIG.AZURE_FUNCTIONS_BASE_URL,
    isLocalFunctions: isLocalFunctions(ENV_CONFIG.AZURE_FUNCTIONS_BASE_URL),
    authType: ENV_CONFIG.USE_API_MANAGEMENT
      ? "subscription"
      : isLocalFunctions(ENV_CONFIG.AZURE_FUNCTIONS_BASE_URL)
      ? "none"
      : "function",
    hasSubscriptionKey: !!ENV_CONFIG.APIM_SUBSCRIPTION_KEY,
    hasFunctionKey: !!ENV_CONFIG.AZURE_FUNCTION_KEY,
  });
}
