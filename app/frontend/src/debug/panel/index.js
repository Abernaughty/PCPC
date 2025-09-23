/**
 * Debug Panel - Index
 * 
 * This module exports the debug panel functionality.
 * The panel provides a UI for controlling debug settings.
 */

import { initDebugPanel, showDebugPanel, hideDebugPanel, toggleDebugPanel } from './ui';

// Export the debug panel functions
export default {
  init: initDebugPanel,
  show: showDebugPanel,
  hide: hideDebugPanel,
  toggle: toggleDebugPanel
};
