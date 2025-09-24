/**
 * Debug Panel
 * Provides a simple UI for controlling debug settings
 */

import { loggerService } from './services/loggerService';
import debugConfig from './debug-config';

// Panel styles
const PANEL_STYLES = `
  position: fixed;
  bottom: 0;
  right: 0;
  width: 300px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-family: monospace;
  font-size: 12px;
  z-index: 9999;
  border-top-left-radius: 5px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  transition: transform 0.3s ease;
  transform: translateY(calc(100% - 30px));
`;

const PANEL_HEADER_STYLES = `
  padding: 5px 10px;
  background-color: #333;
  cursor: pointer;
  border-top-left-radius: 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const PANEL_CONTENT_STYLES = `
  padding: 10px;
  max-height: 400px;
  overflow-y: auto;
`;

const SECTION_STYLES = `
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #444;
`;

const BUTTON_STYLES = `
  background-color: #555;
  color: #fff;
  border: none;
  padding: 5px 10px;
  margin: 2px;
  border-radius: 3px;
  cursor: pointer;
  font-family: monospace;
  font-size: 12px;
`;

const ACTIVE_BUTTON_STYLES = `
  background-color: #0d6efd;
  color: #fff;
`;

const SELECT_STYLES = `
  background-color: #333;
  color: #fff;
  border: 1px solid #555;
  padding: 4px 8px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
  margin: 2px;
`;

const CHECKBOX_LABEL_STYLES = `
  display: flex;
  align-items: center;
  margin: 5px 0;
`;

/**
 * Create the debug panel
 * @returns {HTMLElement} The panel element
 */
function createDebugPanel() {
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'poke-data-debug-panel';
  panel.style.cssText = PANEL_STYLES;
  
  // Create panel header
  const header = document.createElement('div');
  header.style.cssText = PANEL_HEADER_STYLES;
  header.innerHTML = '<span>PokeData Debug Panel</span><span>▲</span>';
  panel.appendChild(header);
  
  // Create panel content
  const content = document.createElement('div');
  content.style.cssText = PANEL_CONTENT_STYLES;
  panel.appendChild(content);
  
  // Add log level section
  const logLevelSection = document.createElement('div');
  logLevelSection.style.cssText = SECTION_STYLES;
  logLevelSection.innerHTML = '<h3 style="margin: 0 0 5px 0;">Log Level</h3>';
  content.appendChild(logLevelSection);
  
  // Add log level buttons
  const logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];
  const logLevelButtons = document.createElement('div');
  
  logLevels.forEach(level => {
    const button = document.createElement('button');
    button.textContent = level;
    button.style.cssText = BUTTON_STYLES;
    button.dataset.level = level;
    button.addEventListener('click', () => {
      // Use the window.pokeDataDebug.setLogLevel function instead of debugConfig.setLogLevel
      window.pokeDataDebug.setLogLevel(level);
      updateLogLevelButtons();
    });
    logLevelButtons.appendChild(button);
  });
  
  logLevelSection.appendChild(logLevelButtons);
  
  // Add visual options section
  const visualSection = document.createElement('div');
  visualSection.style.cssText = SECTION_STYLES;
  visualSection.innerHTML = '<h3 style="margin: 0 0 5px 0;">Visual Options</h3>';
  content.appendChild(visualSection);
  
  // Add visual options checkboxes
  const visualOptions = [
    { id: 'enableColors', label: 'Enable Colors' },
    { id: 'enableTimestamps', label: 'Show Timestamps' },
    { id: 'showCallerInfo', label: 'Show Caller Info' },
    { id: 'groupTimingLogs', label: 'Group Timing Logs' }
  ];
  
  visualOptions.forEach(option => {
    const label = document.createElement('label');
    label.style.cssText = CHECKBOX_LABEL_STYLES;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `debug-option-${option.id}`;
    checkbox.checked = true; // Default to true
    checkbox.addEventListener('change', () => {
      // This is a placeholder - in a real implementation, we would update the logger config
      loggerService.debug(`${option.label} ${checkbox.checked ? 'enabled' : 'disabled'}`);
    });
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${option.label}`));
    visualSection.appendChild(label);
  });
  
  // Add tools section
  const toolsSection = document.createElement('div');
  toolsSection.style.cssText = SECTION_STYLES;
  toolsSection.innerHTML = '<h3 style="margin: 0 0 5px 0;">Debug Tools</h3>';
  content.appendChild(toolsSection);
  
  // Add tools buttons
  const tools = [
    { id: 'memory', label: 'Log Memory Usage', action: () => window.pokeDataDebug.memory() },
    { id: 'network', label: 'Monitor Network', action: () => window.pokeDataDebug.monitor.network() },
    { id: 'performance', label: 'Monitor Performance', action: () => {
      const button = document.getElementById('debug-tool-performance');
      if (button.dataset.active === 'true') {
        window.pokeDataDebug._perfMonitor.stop();
        button.dataset.active = 'false';
        button.style.cssText = BUTTON_STYLES;
        button.textContent = 'Monitor Performance';
      } else {
        window.pokeDataDebug._perfMonitor = window.pokeDataDebug.monitor.performance();
        button.dataset.active = 'true';
        button.style.cssText = BUTTON_STYLES + ACTIVE_BUTTON_STYLES;
        button.textContent = 'Stop Performance Monitor';
      }
    }}
  ];
  
  const toolButtons = document.createElement('div');
  
  tools.forEach(tool => {
    const button = document.createElement('button');
    button.id = `debug-tool-${tool.id}`;
    button.textContent = tool.label;
    button.style.cssText = BUTTON_STYLES;
    button.addEventListener('click', tool.action);
    toolButtons.appendChild(button);
  });
  
  toolsSection.appendChild(toolButtons);
  
  // Add actions section
  const actionsSection = document.createElement('div');
  actionsSection.style.cssText = SECTION_STYLES;
  actionsSection.innerHTML = '<h3 style="margin: 0 0 5px 0;">Actions</h3>';
  content.appendChild(actionsSection);
  
  // Add action buttons
  const actions = [
    { id: 'clear', label: 'Clear Console', action: () => console.clear() },
    { id: 'debug-mode', label: 'Enable Debug Mode', action: () => {
      const button = document.getElementById('debug-action-debug-mode');
      if (button.dataset.active === 'true') {
        window.pokeDataDebug.disableDebugMode();
        button.dataset.active = 'false';
        button.style.cssText = BUTTON_STYLES;
        button.textContent = 'Enable Debug Mode';
      } else {
        window.pokeDataDebug.enableDebugMode();
        button.dataset.active = 'true';
        button.style.cssText = BUTTON_STYLES + ACTIVE_BUTTON_STYLES;
        button.textContent = 'Disable Debug Mode';
      }
      updateLogLevelButtons();
    }}
  ];
  
  const actionButtons = document.createElement('div');
  
  actions.forEach(action => {
    const button = document.createElement('button');
    button.id = `debug-action-${action.id}`;
    button.textContent = action.label;
    button.style.cssText = BUTTON_STYLES;
    button.addEventListener('click', action.action);
    actionButtons.appendChild(button);
  });
  
  actionsSection.appendChild(actionButtons);
  
  // Add event listener to toggle panel
  header.addEventListener('click', () => {
    if (panel.classList.contains('expanded')) {
      panel.classList.remove('expanded');
      panel.style.transform = 'translateY(calc(100% - 30px))';
      header.querySelector('span:last-child').textContent = '▲';
    } else {
      panel.classList.add('expanded');
      panel.style.transform = 'translateY(0)';
      header.querySelector('span:last-child').textContent = '▼';
    }
  });
  
  // Function to update log level buttons
  function updateLogLevelButtons() {
    // Get the current log level from the logger service with fallback
    let currentLevel = 'DEBUG'; // Default fallback
    
    try {
      // First try to get from config property
      if (loggerService.config && loggerService.config.level !== undefined) {
        currentLevel = Object.keys(loggerService.LEVELS).find(
          key => loggerService.LEVELS[key] === loggerService.config.level
        ) || 'DEBUG';
      } 
      // If that fails, try to get directly from the logger service
      else if (loggerService._config && loggerService._config.level !== undefined) {
        currentLevel = Object.keys(loggerService.LEVELS).find(
          key => loggerService.LEVELS[key] === loggerService._config.level
        ) || 'DEBUG';
      }
      
      console.log('Current log level detected as:', currentLevel);
    } catch (error) {
      console.error('Error getting current log level:', error);
      // Keep the default 'DEBUG' level
    }
    
    // Update button styles based on the current log level
    logLevelButtons.querySelectorAll('button').forEach(button => {
      if (button.dataset.level === currentLevel) {
        button.style.cssText = BUTTON_STYLES + ACTIVE_BUTTON_STYLES;
      } else {
        button.style.cssText = BUTTON_STYLES;
      }
    });
    
    // Also update the debug mode button
    const debugModeButton = document.getElementById('debug-action-debug-mode');
    if (debugModeButton) {
      if (currentLevel === 'DEBUG') {
        debugModeButton.dataset.active = 'true';
        debugModeButton.style.cssText = BUTTON_STYLES + ACTIVE_BUTTON_STYLES;
        debugModeButton.textContent = 'Disable Debug Mode';
      } else {
        debugModeButton.dataset.active = 'false';
        debugModeButton.style.cssText = BUTTON_STYLES;
        debugModeButton.textContent = 'Enable Debug Mode';
      }
    }
  }
  
  // Initial update of log level buttons
  updateLogLevelButtons();
  
  return panel;
}

/**
 * Initialize the debug panel
 */
export function initDebugPanel() {
  // Always initialize for now (removed production check)
  
  // Check if panel already exists
  if (document.getElementById('poke-data-debug-panel')) {
    return;
  }
  
  // Create and append the panel
  const panel = createDebugPanel();
  document.body.appendChild(panel);
  
  loggerService.info('Debug panel initialized');
}

/**
 * Show the debug panel
 */
export function showDebugPanel() {
  const panel = document.getElementById('poke-data-debug-panel');
  if (panel) {
    panel.style.display = 'block';
    loggerService.debug('Debug panel shown');
  }
}

/**
 * Hide the debug panel
 */
export function hideDebugPanel() {
  const panel = document.getElementById('poke-data-debug-panel');
  if (panel) {
    panel.style.display = 'none';
    loggerService.debug('Debug panel hidden');
  }
}

/**
 * Toggle the debug panel
 */
export function toggleDebugPanel() {
  const panel = document.getElementById('poke-data-debug-panel');
  if (panel) {
    if (panel.style.display === 'none') {
      showDebugPanel();
    } else {
      hideDebugPanel();
    }
  } else {
    initDebugPanel();
  }
}

// Export the debug panel functions
export default {
  init: initDebugPanel,
  show: showDebugPanel,
  hide: hideDebugPanel,
  toggle: toggleDebugPanel
};
