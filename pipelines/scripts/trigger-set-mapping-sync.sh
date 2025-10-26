#!/bin/bash
set -euo pipefail

# Trigger SetMapping Synchronization Script
# Invokes the synchronizeSetMappings timer function via Azure Functions admin endpoint

# Parameters
FUNCTION_APP_NAME="${1:-}"
RESOURCE_GROUP="${2:-}"
ENVIRONMENT="${3:-}"

# Validate parameters
if [ -z "$FUNCTION_APP_NAME" ] || [ -z "$RESOURCE_GROUP" ] || [ -z "$ENVIRONMENT" ]; then
  echo "##vso[task.logissue type=error]Missing required parameters"
  echo "Usage: $0 <function-app-name> <resource-group> <environment>"
  exit 1
fi

# Configuration
MAX_RETRIES=3
RETRY_DELAY=5
FUNCTION_NAME="synchronizeSetMappings"

echo "=========================================="
echo "TRIGGERING SET MAPPING SYNCHRONIZATION"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Function: $FUNCTION_NAME"
echo ""

# Get Function App hostname
echo "Retrieving Function App hostname..."
HOSTNAME=$(az functionapp show \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query defaultHostName \
  --output tsv 2>&1)

if [ $? -ne 0 ] || [ -z "$HOSTNAME" ]; then
  echo "##vso[task.logissue type=error]Failed to retrieve Function App hostname"
  echo "Error: $HOSTNAME"
  exit 1
fi

echo "Function App hostname: $HOSTNAME"
echo ""

# Get master key (required for admin endpoint)
echo "Retrieving master key..."
MASTER_KEY=$(az functionapp keys list \
  --name "$FUNCTION_APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query masterKey \
  --output tsv 2>&1)

if [ $? -ne 0 ] || [ -z "$MASTER_KEY" ]; then
  echo "##vso[task.logissue type=error]Failed to retrieve master key"
  echo "Error: $MASTER_KEY"
  exit 1
fi

echo "Master key retrieved successfully"
echo ""

# Construct admin endpoint URL
ADMIN_ENDPOINT="https://${HOSTNAME}/admin/functions/${FUNCTION_NAME}"

echo "Admin endpoint: $ADMIN_ENDPOINT"
echo ""

# Function to invoke the timer function via admin endpoint
invoke_function() {
  echo "Invoking function via admin endpoint..."
  
  # Call the admin endpoint with master key authentication
  # The endpoint returns immediately while the function runs asynchronously
  HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$ADMIN_ENDPOINT" \
    -H "x-functions-key: ${MASTER_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"input": null}' \
    2>&1)
  
  HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n1)
  RESPONSE_BODY=$(echo "$HTTP_RESPONSE" | head -n-1)
  
  echo "HTTP Status Code: $HTTP_CODE"
  
  if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ]; then
    return 0
  else
    echo "Response: $RESPONSE_BODY"
    return 1
  fi
}

# Retry logic with exponential backoff
for attempt in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $attempt of $MAX_RETRIES..."
  echo ""
  
  if invoke_function; then
    echo ""
    echo "✓ SetMapping synchronization triggered successfully"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "ℹ️  IMPORTANT NOTES:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "• Synchronization is running asynchronously in the background"
    echo "• This process typically takes 5-15 minutes to complete"
    echo "• The SetMappings database will be populated during this time"
    echo "• Image URL enhancement will be available once sync completes"
    echo ""
    echo "📊 Monitor progress via:"
    echo "   - Application Insights: Query for 'mapping.sync' events"
    echo "   - Function App Logs: Check synchronizeSetMappings function"
    echo "   - Azure Portal: Function App → Functions → synchronizeSetMappings"
    echo ""
    echo "=========================================="
    exit 0
  else
    EXIT_CODE=$?
    
    if [ $attempt -lt $MAX_RETRIES ]; then
      echo ""
      echo "⚠️  Invocation failed (exit code: $EXIT_CODE), retrying in ${RETRY_DELAY}s..."
      echo ""
      sleep $RETRY_DELAY
      RETRY_DELAY=$((RETRY_DELAY * 2))  # Exponential backoff
    fi
  fi
done

# All retries exhausted
echo ""
echo "✗ Failed to trigger SetMapping synchronization after $MAX_RETRIES attempts"
echo ""
echo "##vso[task.logissue type=warning]SetMapping sync trigger failed - database may not be populated immediately"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  MANUAL ACTION REQUIRED:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The automatic synchronization trigger failed. You can:"
echo ""
echo "1. Wait for the scheduled timer trigger (runs daily at 7 AM UTC)"
echo "2. Manually trigger via Azure Portal:"
echo "   - Navigate to Function App → Functions → synchronizeSetMappings"
echo "   - Click 'Test/Run' and execute the function"
echo "3. Use the admin endpoint directly:"
echo "   curl -X POST \"$ADMIN_ENDPOINT\" \\"
echo "     -H \"x-functions-key: <master-key>\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"input\": null}'"
echo ""
echo "=========================================="

# Exit with 0 to not fail the pipeline - this is a warning, not a critical failure
exit 0
