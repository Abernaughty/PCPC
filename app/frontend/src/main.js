import App from './App.svelte';
import { initializeDebugSystem } from './debug';
import { loggerService, dbLogger } from './services/loggerService';


// Initialize the application with logging
function initializeApp() {
  loggerService.info('Initializing PokeData application');
  
  // Create and mount the app
  const app = new App({
    target: document.body
  });
  
  // Log successful initialization
  loggerService.success('PokeData application initialized successfully');
  
  // Initialize debug system (always enabled for now)
  // Initialize the debug system
  window.pokeDataDebug = initializeDebugSystem();
  
  return app;
}

// Start the application
const app = initializeApp();

export default app;
