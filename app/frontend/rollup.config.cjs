// Use CommonJS require() instead of ESM imports
const svelte = require("rollup-plugin-svelte");
const commonjs = require("@rollup/plugin-commonjs");
const { nodeResolve } = require("@rollup/plugin-node-resolve");
const livereload = require("rollup-plugin-livereload");
const { terser } = require("rollup-plugin-terser");
const css = require("rollup-plugin-css-only");
const replace = require("@rollup/plugin-replace");
const copy = require("rollup-plugin-copy");
const typescript = require("@rollup/plugin-typescript");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

const production = !process.env.ROLLUP_WATCH;

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
    // Replace environment variables in the bundle (only for Application Insights and Vite vars)
    replace({
      preventAssignment: true,
      values: {
        // Application Insights configuration
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
        // API configuration (for local dev only, runtime uses window.__ENV__)
        "import.meta.env.VITE_API_URL": JSON.stringify(
          process.env.VITE_API_URL || "http://localhost:7071/api"
        ),
        "import.meta.env.VITE_DEBUG": JSON.stringify(
          process.env.VITE_DEBUG || "true"
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
        { src: "static/*", dest: "dist" },
        { src: "src/index.html", dest: "dist" },
      ],
      hook: "writeBundle",
    }),
    typescript({
      sourceMap: !production,
      inlineSources: !production,
    }),
    nodeResolve({
      browser: true,
      dedupe: ["svelte"],
      extensions: [".js", ".ts"],
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
