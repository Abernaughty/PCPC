/**
 * Debug Panel - Styles
 * 
 * This module contains the CSS styles for the debug panel UI.
 * Extracting styles into a separate file improves maintainability.
 */

// Panel styles
export const PANEL_STYLES = `
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

// Panel header styles
export const PANEL_HEADER_STYLES = `
  padding: 5px 10px;
  background-color: #333;
  cursor: pointer;
  border-top-left-radius: 5px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

// Panel content styles
export const PANEL_CONTENT_STYLES = `
  padding: 10px;
  max-height: 400px;
  overflow-y: auto;
`;

// Section styles
export const SECTION_STYLES = `
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #444;
`;

// Button styles
export const BUTTON_STYLES = `
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

// Active button styles
export const ACTIVE_BUTTON_STYLES = `
  background-color: #0d6efd;
  color: #fff;
`;

// Select styles
export const SELECT_STYLES = `
  background-color: #333;
  color: #fff;
  border: 1px solid #555;
  padding: 4px 8px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
  margin: 2px;
`;

// Checkbox label styles
export const CHECKBOX_LABEL_STYLES = `
  display: flex;
  align-items: center;
  margin: 5px 0;
`;

// Export all styles as a default object
export default {
  PANEL_STYLES,
  PANEL_HEADER_STYLES,
  PANEL_CONTENT_STYLES,
  SECTION_STYLES,
  BUTTON_STYLES,
  ACTIVE_BUTTON_STYLES,
  SELECT_STYLES,
  CHECKBOX_LABEL_STYLES
};
