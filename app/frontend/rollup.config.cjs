// Use CommonJS require() instead of ESM imports
const svelte = require("rollup-plugin-svelte");
const commonjs = require("@rollup/plugin-commonjs");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const livereload = require("rollup-plugin-livereload");
const { terser } = require("rollup-plugin-terser");
const css = require("rollup-plugin-css-only");
const replace = require("@rollup/plugin-replace");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Debug: Log environment variables
console.log("=== ROLLUP BUILD DEBUG ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log(
  "APIM_SUBSCRIPTION_KEY:",
  process.env.APIM_SUBSCRIPTION_KEY ? "SET" : "NOT SET"
);
console.log(
  "APIM_SUBSCRIPTION_KEY length:",
  process.env.APIM_SUBSCRIPTION_KEY?.length || 0
);
console.log("USE_API_MANAGEMENT:", process.env.USE_API_MANAGEMENT);
console.log("=========================");

const production = !process.env.ROLLUP_WATCH;

// Get environment variables with fallbacks
const API_BASE_URL =
  process.env.API_BASE_URL ||
  "https://maber-apim-test.azure-api.net/pokedata-api/v0";

// Force port 3000 for development server and 35729 for livereload
const PORT = process.env.PORT || 3000;
const LIVERELOAD_PORT = 35729;

function serve() {
  let server;

  function toExit() {
    if (server) server.kill("SIGTERM");
  }

  return {
    writeBundle() {
      if (server) return;
      // Explicitly set port to 3000 and add --port flag
      server = require("child_process").spawn("npm", ["start"], {
        stdio: ["ignore", "inherit", "inherit"],
        shell: true,
        env: { ...process.env, PORT: PORT.toString() },
      });

      process.on("SIGTERM", toExit);
      process.on("exit", toExit);
    },
  };
}

// Use CommonJS module.exports instead of export default
module.exports = {
  input: "src/main.js",
  output: {
    sourcemap: production, // Only generate source maps in production
    format: "esm",
    dir: "public/build",
    // Always use .js extension to match index.html expectations
    entryFileNames: `[name].js`,
    chunkFileNames: `[name].js`,
  },
  plugins: [
    // Replace environment variables in the bundle
    replace({
      preventAssignment: true,
      values: {
        // Environment configuration
        "process.env.NODE_ENV": JSON.stringify(
          process.env.NODE_ENV || "development"
        ),

        // API Management configuration
        "process.env.APIM_BASE_URL": JSON.stringify(
          process.env.APIM_BASE_URL ||
            "https://maber-apim-test.azure-api.net/pokedata-api"
        ),
        "process.env.APIM_SUBSCRIPTION_KEY": JSON.stringify(
          process.env.APIM_SUBSCRIPTION_KEY || ""
        ),

        // Azure Functions configuration
        "process.env.AZURE_FUNCTIONS_BASE_URL": JSON.stringify(
          process.env.AZURE_FUNCTIONS_BASE_URL ||
            "https://pokedata-func.azurewebsites.net/api"
        ),
        "process.env.AZURE_FUNCTION_KEY": JSON.stringify(
          process.env.AZURE_FUNCTION_KEY || ""
        ),

        // Feature flags
        "process.env.USE_API_MANAGEMENT": JSON.stringify(
          process.env.USE_API_MANAGEMENT || "true"
        ),
        "process.env.DEBUG_API": JSON.stringify(
          process.env.DEBUG_API || "false"
        ),

        // Legacy environment variables (for backward compatibility)
        "process.env.API_BASE_URL": JSON.stringify(API_BASE_URL),

        // Build metadata
        "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),
      },
    }),
    svelte({
      compilerOptions: {
        dev: !production,
      },
    }),
    css({
      output: "bundle.css",
      // Ensure styles are properly extracted and minified
      minimize: production,
      // Add source maps in development mode
      sourceMap: !production,
    }),
    nodeResolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs(),
    !production && serve(),
    !production &&
      livereload({
        watch: "public",
        port: LIVERELOAD_PORT,
        verbose: true,
      }),
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};
