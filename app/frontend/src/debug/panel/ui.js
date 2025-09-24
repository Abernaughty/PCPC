/**
 * Debug Panel - UI
 * 
 * This module provides the UI components for the debug panel.
 * It creates and manages a floating panel for controlling debug settings.
 */

import { loggerService } from '../../services/loggerService';
import { featureFlagService } from '../../services/featureFlagService';
import * as config from '../config';
import * as styles from './styles';

/**
 * Create the debug panel
 * @returns {HTMLElement} The panel element
 */
function createDebugPanel() {
  // Create panel container
  const panel = document.createElement('div');
  panel.id = 'poke-data-debug-panel';
  panel.style.cssText = styles.PANEL_STYLES;
  
  // Create panel header
  const header = document.createElement('div');
  header.style.cssText = styles.PANEL_HEADER_STYLES;
  header.innerHTML = '<span>PokeData Debug Panel</span><span>▲</span>';
  panel.appendChild(header);
  
  // Create panel content
  const content = document.createElement('div');
  content.style.cssText = styles.PANEL_CONTENT_STYLES;
  panel.appendChild(content);
  
  // Add log level section
  const logLevelSection = document.createElement('div');
  logLevelSection.style.cssText = styles.SECTION_STYLES;
  logLevelSection.innerHTML = '<h3 style="margin: 0 0 5px 0;">Log Level</h3>';
  content.appendChild(logLevelSection);
  
  // Add log level buttons
  const logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];
  const logLevelButtons = document.createElement('div');
  
  logLevels.forEach(level => {
    const button = document.createElement('button');
    button.textContent = level;
    button.style.cssText = styles.BUTTON_STYLES;
    button.dataset.level = level;
    button.addEventListener('click', () => {
      // Use the window.pokeDataDebug.setLogLevel function instead of config.setLogLevel
      window.pokeDataDebug.setLogLevel(level);
      updateLogLevelButtons();
    });
    logLevelButtons.appendChild(button);
  });
  
  logLevelSection.appendChild(logLevelButtons);
  
  // Add visual options section
  const visualSection = document.createElement('div');
  visualSection.style.cssText = styles.SECTION_STYLES;
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
    label.style.cssText = styles.CHECKBOX_LABEL_STYLES;
    
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
  toolsSection.style.cssText = styles.SECTION_STYLES;
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
        button.style.cssText = styles.BUTTON_STYLES;
        button.textContent = 'Monitor Performance';
      } else {
        window.pokeDataDebug._perfMonitor = window.pokeDataDebug.monitor.performance();
        button.dataset.active = 'true';
        button.style.cssText = styles.BUTTON_STYLES + styles.ACTIVE_BUTTON_STYLES;
        button.textContent = 'Stop Performance Monitor';
      }
    }}
  ];
  
  const toolButtons = document.createElement('div');
  
  tools.forEach(tool => {
    const button = document.createElement('button');
    button.id = `debug-tool-${tool.id}`;
    button.textContent = tool.label;
    button.style.cssText = styles.BUTTON_STYLES;
    button.addEventListener('click', tool.action);
    toolButtons.appendChild(button);
  });
  
  toolsSection.appendChild(toolButtons);
  
  // Add feature flags section
  const featureFlagsSection = document.createElement('div');
  featureFlagsSection.style.cssText = styles.SECTION_STYLES;
  featureFlagsSection.innerHTML = '<h3 style="margin: 0 0 5px 0;">Feature Flags</h3>';
  content.appendChild(featureFlagsSection);
  
  // Add feature flag checkboxes
  const featureFlags = [
    { id: 'useCloudApi', label: 'Use Cloud API' },
    { id: 'useCloudImages', label: 'Use Cloud Images' },
    { id: 'useCloudCaching', label: 'Use Cloud Caching' }
  ];
  
  // Create checkboxes for each feature flag
  featureFlags.forEach(flag => {
    const label = document.createElement('label');
    label.style.cssText = styles.CHECKBOX_LABEL_STYLES;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `feature-flag-${flag.id}`;
    checkbox.checked = featureFlagService.getFlag(flag.id, false);
    
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${flag.label}`));
    featureFlagsSection.appendChild(label);
  });
  
  // Add feature flag buttons
  const featureFlagButtons = document.createElement('div');
  featureFlagButtons.style.cssText = 'display: flex; justify-content: space-between; margin-top: 10px;';
  
  // Apply changes button
  const applyButton = document.createElement('button');
  applyButton.textContent = 'Apply Changes';
  applyButton.style.cssText = styles.BUTTON_STYLES + 'background-color: #28a745;';
  applyButton.addEventListener('click', () => {
    // Get all feature flag values and apply them
    featureFlags.forEach(flag => {
      const checkbox = document.getElementById(`feature-flag-${flag.id}`);
      featureFlagService.setFlag(flag.id, checkbox.checked);
    });
    
    // Reload the page to apply changes
    window.location.reload();
  });
  
  // Reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset All Flags';
  resetButton.style.cssText = styles.BUTTON_STYLES + 'background-color: #dc3545;';
  resetButton.addEventListener('click', () => {
    featureFlagService.resetAllFlags();
    window.location.reload();
  });
  
  featureFlagButtons.appendChild(applyButton);
  featureFlagButtons.appendChild(resetButton);
  featureFlagsSection.appendChild(featureFlagButtons);
  
  // Add actions section
  const actionsSection = document.createElement('div');
  actionsSection.style.cssText = styles.SECTION_STYLES;
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
        button.style.cssText = styles.BUTTON_STYLES;
        button.textContent = 'Enable Debug Mode';
      } else {
        window.pokeDataDebug.enableDebugMode();
        button.dataset.active = 'true';
        button.style.cssText = styles.BUTTON_STYLES + styles.ACTIVE_BUTTON_STYLES;
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
    button.style.cssText = styles.BUTTON_STYLES;
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
        button.style.cssText = styles.BUTTON_STYLES + styles.ACTIVE_BUTTON_STYLES;
      } else {
        button.style.cssText = styles.BUTTON_STYLES;
      }
    });
    
    // Also update the debug mode button
    const debugModeButton = document.getElementById('debug-action-debug-mode');
    if (debugModeButton) {
      if (currentLevel === 'DEBUG') {
        debugModeButton.dataset.active = 'true';
        debugModeButton.style.cssText = styles.BUTTON_STYLES + styles.ACTIVE_BUTTON_STYLES;
        debugModeButton.textContent = 'Disable Debug Mode';
      } else {
        debugModeButton.dataset.active = 'false';
        debugModeButton.style.cssText = styles.BUTTON_STYLES;
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
  
  // Create and append the panel (hidden by default)
  const panel = createDebugPanel();
  panel.style.display = 'none'; // Hide by default
  document.body.appendChild(panel);
  
  loggerService.info('Debug panel initialized (hidden by default)');
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
