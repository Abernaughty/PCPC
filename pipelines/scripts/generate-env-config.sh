#!/bin/bash
# Generate env-config.js for Azure Static Web App runtime configuration
# This script creates a JavaScript file that injects window.__ENV__ with values from Azure SWA Application Settings

set -euo pipefail

# Parameters
STATIC_WEB_APP_NAME="${1:-}"
RESOURCE_GROUP="${2:-}"
OUTPUT_FILE="${3:-env-config.js}"

if [ -z "$STATIC_WEB_APP_NAME" ] || [ -z "$RESOURCE_GROUP" ]; then
  echo "Usage: $0 <static-web-app-name> <resource-group> [output-file]"
  echo ""
  echo "Example: $0 pcpc-swa-dev pcpc-rg-dev env-config.js"
  exit 1
fi

echo "=========================================="
echo "Generating Runtime Configuration"
echo "=========================================="
echo "Static Web App: $STATIC_WEB_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Output File: $OUTPUT_FILE"
echo ""

# Fetch Application Settings from Azure Static Web App
echo "Fetching Application Settings from Azure..."
APP_SETTINGS=$(az staticwebapp appsettings list \
  --name "$STATIC_WEB_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties" \
  -o json 2>/dev/null || echo "{}")

if [ "$APP_SETTINGS" = "{}" ] || [ -z "$APP_SETTINGS" ]; then
  echo "WARNING: No Application Settings found or unable to fetch settings"
  echo "Creating env-config.js with empty configuration..."
  
  cat > "$OUTPUT_FILE" <<'EOF'
// Runtime Environment Configuration
// Auto-generated during deployment - DO NOT EDIT MANUALLY
// This file is excluded from source control

(function() {
  'use strict';
  
  // Initialize window.__ENV__ with empty configuration
  window.__ENV__ = window.__ENV__ || {};
  
  console.log('[env-config.js] Runtime configuration loaded (empty)');
})();
EOF
  
  echo "✓ Created $OUTPUT_FILE with empty configuration"
  exit 0
fi

# Extract specific settings we need
API_URL=$(echo "$APP_SETTINGS" | jq -r '.API_URL // empty')
DEBUG=$(echo "$APP_SETTINGS" | jq -r '.DEBUG // empty')

echo "Configuration values:"
echo "  API_URL: ${API_URL:-<not set>}"
echo "  DEBUG: ${DEBUG:-<not set>}"
echo ""

# Generate env-config.js file
cat > "$OUTPUT_FILE" <<EOF
// Runtime Environment Configuration
// Auto-generated during deployment - DO NOT EDIT MANUALLY
// Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
// Source: Azure Static Web App Application Settings

(function() {
  'use strict';
  
  // Initialize window.__ENV__ with configuration from Azure Static Web App
  window.__ENV__ = {
    API_URL: '${API_URL}',
    DEBUG: '${DEBUG}'
  };
  
  // Log configuration load (only if DEBUG is enabled)
  if (window.__ENV__.DEBUG === 'true') {
    console.log('[env-config.js] Runtime configuration loaded:', {
      API_URL: window.__ENV__.API_URL,
      DEBUG: window.__ENV__.DEBUG,
      source: 'Azure Static Web App Application Settings'
    });
  }
})();
EOF

echo "✓ Generated $OUTPUT_FILE successfully"
echo ""
echo "File contents:"
cat "$OUTPUT_FILE"
echo ""
echo "=========================================="
