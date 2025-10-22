// Use CommonJS require() instead of ESM imports
const svelte = require("rollup-plugin-svelte");
const commonjs = require("@rollup/plugin-commonjs");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const livereload = require("rollup-plugin-livereload");
const { terser } = require("rollup-plugin-terser");
const css = require("rollup-plugin-css-only");
const replace = require("@rollup/plugin-replace");
const copy = require("rollup-plugin-copy");
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
  process.env.API_BASE_URL || "https://pcpc-apim-dev.azure-api.net/pcpc-api/v0";
const APIM_BASE_URL =
  process.env.APIM_BASE_URL || "https://pcpc-apim-dev.azure-api.net/pcpc-api";
const APIM_SUBSCRIPTION_KEY = process.env.APIM_SUBSCRIPTION_KEY || "";
const AZURE_FUNCTIONS_BASE_URL =
  process.env.AZURE_FUNCTIONS_BASE_URL ||
  "https://pokedata-func.azurewebsites.net/api";
const AZURE_FUNCTION_KEY = process.env.AZURE_FUNCTION_KEY || "";
const USE_API_MANAGEMENT = process.env.USE_API_MANAGEMENT || "true";
const APIM_REQUIRE_SUBSCRIPTION_KEY =
  process.env.APIM_REQUIRE_SUBSCRIPTION_KEY || "false";
const DEBUG_API = process.env.DEBUG_API || "false";

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
    dir: "dist",
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
        "process.env.APIM_BASE_URL": JSON.stringify(APIM_BASE_URL),
        "process.env.APIM_SUBSCRIPTION_KEY": JSON.stringify(
          APIM_SUBSCRIPTION_KEY
        ),
        "process.env.APIM_REQUIRE_SUBSCRIPTION_KEY": JSON.stringify(
          APIM_REQUIRE_SUBSCRIPTION_KEY
        ),

        // Azure Functions configuration
        "process.env.AZURE_FUNCTIONS_BASE_URL": JSON.stringify(
          AZURE_FUNCTIONS_BASE_URL
        ),
        "process.env.AZURE_FUNCTION_KEY": JSON.stringify(AZURE_FUNCTION_KEY),

        // Feature flags
        "process.env.USE_API_MANAGEMENT": JSON.stringify(USE_API_MANAGEMENT),
        "process.env.DEBUG_API": JSON.stringify(DEBUG_API),

        // Legacy environment variables (for backward compatibility)
        "process.env.API_BASE_URL": JSON.stringify(API_BASE_URL),

        // Build metadata
        "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString()),

        // Application Insights configuration (individual property replacements)
        "import.meta.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING":
          JSON.stringify(
            process.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING || ""
          ),
        "import.meta.env.VITE_APPLICATIONINSIGHTS_ROLE_NAME": JSON.stringify(
          process.env.VITE_APPLICATIONINSIGHTS_ROLE_NAME || "pcpc-frontend"
        ),
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(
          process.env.VITE_APP_VERSION || "0.2.0"
        ),
        "import.meta.env.VITE_ENVIRONMENT": JSON.stringify(
          process.env.VITE_ENVIRONMENT || "development"
        ),
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
    // Copy static assets and index.html to dist/
    copy({
      targets: [
        {
          src: "static/*",
          dest: "dist",
          filter: (filepath) => !filepath.endsWith("env.template.js"),
        },
        { src: "src/index.html", dest: "dist" },
        {
          src: "static/env.template.js",
          dest: "dist",
          rename: "env.js",
          transform: (contents) =>
            contents
              .toString()
              .replace(/__APIM_BASE_URL__/g, APIM_BASE_URL)
              .replace(/__APIM_SUBSCRIPTION_KEY__/g, APIM_SUBSCRIPTION_KEY)
              .replace(/__USE_API_MANAGEMENT__/g, USE_API_MANAGEMENT)
              .replace(
                /__APIM_REQUIRE_SUBSCRIPTION_KEY__/g,
                APIM_REQUIRE_SUBSCRIPTION_KEY
              )
              .replace(
                /__AZURE_FUNCTIONS_BASE_URL__/g,
                AZURE_FUNCTIONS_BASE_URL
              )
              .replace(/__AZURE_FUNCTION_KEY__/g, AZURE_FUNCTION_KEY)
              .replace(/__DEBUG_API__/g, DEBUG_API),
        },
      ],
      hook: "writeBundle",
    }),
    nodeResolve({
      browser: true,
      dedupe: ["svelte"],
    }),
    commonjs(),
    !production && serve(),
    !production &&
      livereload({
        watch: ["dist", "src"],
        port: LIVERELOAD_PORT,
        verbose: true,
      }),
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
};
