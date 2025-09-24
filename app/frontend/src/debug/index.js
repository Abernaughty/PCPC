/**
 * Debug System - Main Entry Point
 * 
 * This module serves as the main entry point for the PokeData debugging system.
 * It initializes and exports all debugging functionality in a structured way.
 */

import * as config from './config';
import panel from './panel';
import * as tools from './tools';
import * as utils from './utils';
import { loggerService } from '../services/loggerService';
import { featureFlagService } from '../services/featureFlagService';


/**
 * Initialize the debug system and create the global pokeDataDebug object
 */
export function initializeDebugSystem() {
  // Always initialize for now (removed production check)
  
  loggerService.info('Initializing PokeData debug system');
  
  // Create the global debug object
  const debugSystem = {
    // Logger configuration
    enableDebugMode: () => {
      config.enableDebugMode();
      return 'Debug mode enabled';
    },
    disableDebugMode: () => {
      config.disableDebugMode();
      return 'Debug mode disabled';
    },
    setLogLevel: (level) => {
      config.setLogLevel(level);
      return `Log level set to ${level}`;
    },
    getLoggerConfig: () => {
      return config.getLoggerConfig();
    },
    
    // Core logging services
    logger: loggerService,
    
    // Debug tools
    tools: tools,
    
    // Debug panel
    panel: {
      show: () => {
        panel.init();
        return 'Debug panel initialized';
      },
      hide: () => {
        panel.hide();
        return 'Debug panel hidden';
      },
      toggle: () => {
        panel.toggle();
        return 'Debug panel toggled';
      }
    },
    
    // Convenience methods
    inspect: tools.inspectObject,
    measure: tools.measureExecutionTime,
    memory: tools.logMemoryUsage,
    monitor: {
      performance: (interval = 5000) => {
        const monitor = tools.createPerformanceMonitor(interval);
        monitor.start();
        return monitor;
      },
      network: () => tools.monitorNetworkRequests(),
      object: tools.monitorObjectProperties
    },
    
    // Help function
    help: () => {
      // Use a single console.log with a multi-line string
      console.log(`PokeData Debug Console
======================

Available commands:

Logger Configuration:
  pokeDataDebug.enableDebugMode()      - Enable debug mode (sets log level to DEBUG)
  pokeDataDebug.disableDebugMode()     - Disable debug mode (sets log level to INFO)
  pokeDataDebug.setLogLevel(level)     - Set log level (DEBUG, INFO, WARN, ERROR, NONE)
  pokeDataDebug.getLoggerConfig()      - Get current logger configuration

Debug Tools:
  pokeDataDebug.inspect(obj, options)  - Inspect an object's properties
  pokeDataDebug.measure(fn, args)      - Measure execution time of a function
  pokeDataDebug.memory()               - Log current memory usage

Monitoring:
  pokeDataDebug.monitor.performance()  - Start performance monitoring
  pokeDataDebug.monitor.network()      - Monitor network requests
  pokeDataDebug.monitor.object(obj)    - Monitor object property access

Debug Panel:
  pokeDataDebug.panel.show()           - Show the debug panel UI
  pokeDataDebug.panel.hide()           - Hide the debug panel UI
  pokeDataDebug.panel.toggle()         - Toggle the debug panel UI

Advanced Tools:
  pokeDataDebug.tools                  - Access all debug tools
  pokeDataDebug.logger                 - Access logger service directly

Examples:
  pokeDataDebug.inspect(document.body)
  pokeDataDebug.measure(() => Array(1000000).fill(0).map((_, i) => i))
  const perfMonitor = pokeDataDebug.monitor.performance()
  perfMonitor.stop()  // Stop performance monitoring`);
      
      return 'Help displayed in console';
    }
  };
  
  // Don't auto-initialize the debug panel - it will be hidden by default
  // Panel will only be shown when the keyboard shortcut is pressed
  
  loggerService.info('Debug controls available via window.pokeDataDebug');
  
  // Add a global function to easily show the debug panel
  window.showDebugPanel = () => {
    if (!document.getElementById('poke-data-debug-panel')) {
      panel.init();
      console.log('Debug panel initialized and shown.');
    } else {
      panel.show();
      console.log('Debug panel shown.');
    }
  };
  
  // Add keyboard shortcut for toggling debug panel (Ctrl+Alt+D)
  document.addEventListener('keydown', (event) => {
    // Check for both 'D' and 'd' to handle case sensitivity, and use multiple detection methods
    if (event.ctrlKey && event.altKey && (event.key === 'D' || event.key === 'd' || event.code === 'KeyD' || event.keyCode === 68)) {
      event.preventDefault(); // Prevent any default browser behavior
      
      console.log('Debug panel shortcut triggered! (Ctrl+Alt+D)');
      
      // Initialize panel if it doesn't exist, then toggle
      if (!document.getElementById('poke-data-debug-panel')) {
        panel.init();
        console.log('Debug panel initialized. Press Ctrl+Alt+D to toggle or use window.showDebugPanel()');
      } else {
        panel.toggle();
        console.log('Debug panel toggled.');
      }
    }
  });
  
  return debugSystem;
}

// Export all debug functionality
export { config, panel, tools, utils };

// Export a default object with all debug functionality
export default {
  config,
  panel,
  tools,
  utils,
  initializeDebugSystem
};
