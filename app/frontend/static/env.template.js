// Runtime environment bootstrap
// Populated at build time via Rollup copy plugin transformation
if (typeof window !== "undefined") {
  window.__ENV__ = {
    APIM_BASE_URL: "__APIM_BASE_URL__",
    APIM_SUBSCRIPTION_KEY: "__APIM_SUBSCRIPTION_KEY__",
    USE_API_MANAGEMENT: "__USE_API_MANAGEMENT__",
    APIM_REQUIRE_SUBSCRIPTION_KEY: "__APIM_REQUIRE_SUBSCRIPTION_KEY__",
    AZURE_FUNCTIONS_BASE_URL: "__AZURE_FUNCTIONS_BASE_URL__",
    AZURE_FUNCTION_KEY: "__AZURE_FUNCTION_KEY__",
    DEBUG_API: "__DEBUG_API__",
  };
}
