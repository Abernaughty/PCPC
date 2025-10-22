// Environment Configuration
// Handles build-time and runtime configuration for the frontend application

// Load environment variables from .env file when executed in Node.js (build/test)
if (
  typeof process !== "undefined" &&
  process.env &&
  typeof require !== "undefined"
) {
  try {
    const dotenv = require("dotenv"); // eslint-disable-line global-require
    dotenv.config();
  } catch (error) {
    // dotenv not available, continue without it
  }
}

/**
 * Get environment variable with fallback.
 * For browser environments we first consult runtime configuration (window.__ENV__),
 * otherwise we fall back to process.env or the provided default.
 *
 * @param {string} key - Environment variable key
 * @param {string} fallback - Fallback value if the variable is not set
 * @returns {string} Environment variable value or fallback
 */
function getEnvVar(key, fallback = "") {
  if (typeof window !== "undefined") {
    const runtimeValue = window.__ENV__?.[key];
    if (typeof runtimeValue !== "undefined" && runtimeValue !== null) {
      return runtimeValue;
    }
  }

  if (typeof process !== "undefined" && process.env) {
    const value = process.env[key];
    if (typeof value !== "undefined") {
      return value;
    }
  }

  return fallback;
}

/**
 * Convert string representations of booleans to actual boolean values.
 * @param {string | boolean} value
 * @param {boolean} fallback
 * @returns {boolean}
 */
function toBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

const ENV_DEFAULTS = {
  NODE_ENV: "development",
  APIM_BASE_URL: "",
  APIM_SUBSCRIPTION_KEY: "",
  AZURE_FUNCTIONS_BASE_URL: "http://localhost:7071/api",
  AZURE_FUNCTION_KEY: "",
  USE_API_MANAGEMENT: "true",
  APIM_REQUIRE_SUBSCRIPTION_KEY: "false",
  DEBUG_API: "false",
};

const ENV_READERS = {
  NODE_ENV: () => getEnvVar("NODE_ENV", ENV_DEFAULTS.NODE_ENV),
  APIM_BASE_URL: () => getEnvVar("APIM_BASE_URL", ENV_DEFAULTS.APIM_BASE_URL),
  APIM_SUBSCRIPTION_KEY: () =>
    getEnvVar("APIM_SUBSCRIPTION_KEY", ENV_DEFAULTS.APIM_SUBSCRIPTION_KEY),
  AZURE_FUNCTIONS_BASE_URL: () =>
    getEnvVar(
      "AZURE_FUNCTIONS_BASE_URL",
      ENV_DEFAULTS.AZURE_FUNCTIONS_BASE_URL
    ),
  AZURE_FUNCTION_KEY: () =>
    getEnvVar("AZURE_FUNCTION_KEY", ENV_DEFAULTS.AZURE_FUNCTION_KEY),
  USE_API_MANAGEMENT: () =>
    toBoolean(
      getEnvVar("USE_API_MANAGEMENT", ENV_DEFAULTS.USE_API_MANAGEMENT),
      true
    ),
  APIM_REQUIRE_SUBSCRIPTION_KEY: () =>
    toBoolean(
      getEnvVar(
        "APIM_REQUIRE_SUBSCRIPTION_KEY",
        ENV_DEFAULTS.APIM_REQUIRE_SUBSCRIPTION_KEY
      ),
      false
    ),
  DEBUG_API: () =>
    toBoolean(getEnvVar("DEBUG_API", ENV_DEFAULTS.DEBUG_API), false),
};

/**
 * Snapshot of environment configuration (resolved on demand).
 * We expose a Proxy so property access re-evaluates underlying values,
 * ensuring that runtime updates (window.__ENV__) are reflected automatically.
 */
export const ENV_CONFIG = new Proxy(
  {},
  {
    get(_, prop) {
      if (Object.prototype.hasOwnProperty.call(ENV_READERS, prop)) {
        return ENV_READERS[prop]();
      }
      return undefined;
    },
    has(_, prop) {
      return Object.prototype.hasOwnProperty.call(ENV_READERS, prop);
    },
    ownKeys() {
      return Object.keys(ENV_READERS);
    },
    getOwnPropertyDescriptor(_, prop) {
      if (!Object.prototype.hasOwnProperty.call(ENV_READERS, prop)) {
        return undefined;
      }
      return {
        enumerable: true,
        configurable: false,
        get: () => ENV_READERS[prop](),
      };
    },
  }
);

/**
 * Convenience helper to capture the current environment configuration
 * as a plain object (useful for logging/debugging).
 */
export const getEnvConfig = () =>
  Object.keys(ENV_READERS).reduce((acc, key) => {
    acc[key] = ENV_READERS[key]();
    return acc;
  }, {});

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
  const config = getEnvConfig();
  const errors = [];

  if (config.USE_API_MANAGEMENT && !config.APIM_BASE_URL) {
    errors.push(
      "APIM_BASE_URL is required when USE_API_MANAGEMENT is true"
    );
  }

  if (config.USE_API_MANAGEMENT && !config.APIM_SUBSCRIPTION_KEY) {
    if (config.APIM_REQUIRE_SUBSCRIPTION_KEY) {
      errors.push(
        "APIM_SUBSCRIPTION_KEY is required when subscription enforcement is enabled"
      );
    }
  }

  // Only require function key for non-local environments
  const isLocal = isLocalFunctions(config.AZURE_FUNCTIONS_BASE_URL);
  if (
    !config.USE_API_MANAGEMENT &&
    !isLocal &&
    !config.AZURE_FUNCTION_KEY
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
  const snapshot = getEnvConfig();
  const localFunctions = isLocalFunctions(snapshot.AZURE_FUNCTIONS_BASE_URL);

  console.log("Environment Configuration:", {
    NODE_ENV: snapshot.NODE_ENV,
    USE_API_MANAGEMENT: snapshot.USE_API_MANAGEMENT,
    APIM_BASE_URL: snapshot.APIM_BASE_URL,
    AZURE_FUNCTIONS_BASE_URL: snapshot.AZURE_FUNCTIONS_BASE_URL,
    isLocalFunctions: localFunctions,
    authType: snapshot.USE_API_MANAGEMENT
      ? "subscription"
      : localFunctions
      ? "none"
      : "function",
    hasSubscriptionKey: !!snapshot.APIM_SUBSCRIPTION_KEY,
    hasFunctionKey: !!snapshot.AZURE_FUNCTION_KEY,
  });
}
