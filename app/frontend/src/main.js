import App from "./App.svelte";
import { initializeDebugSystem } from "./debug";
import { loggerService } from "./services/loggerService";
import { monitoringService } from "./services/monitoringService";
import { initWebVitals } from "./utils/webVitals";

// Import global styles - bundled into bundle.css by Rollup
import "./styles/global.css";

// Initialize the application with logging
function initializeApp() {
  // Initialize Application Insights monitoring
  monitoringService.initialize();

  // Initialize Core Web Vitals tracking
  initWebVitals();

  loggerService.info("Initializing PokeData application");

  // Track application start event
  monitoringService.trackEvent("app.initialized", {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language,
  });

  // Create and mount the app
  const app = new App({
    target: document.body,
  });

  // Log successful initialization
  loggerService.success("PokeData application initialized successfully");

  // Initialize debug system (always enabled for now)
  // Initialize the debug system
  window.pokeDataDebug = initializeDebugSystem();

  return app;
}

// Global error handlers for Application Insights
window.addEventListener("error", (event) => {
  monitoringService.trackException(event.error || new Error(event.message), {
    type: "window.error",
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  monitoringService.trackException(
    event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason)),
    {
      type: "unhandledrejection",
    }
  );
});

// Flush telemetry before page unload
window.addEventListener("beforeunload", () => {
  monitoringService.flush();
});

// Start the application
const app = initializeApp();

export default app;
