#!/bin/bash
set -euo pipefail

# Trigger SetMapping Synchronization Script
# Invokes the synchronizeSetMappings timer function asynchronously after deployment

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

echo "=========================================="
echo "TRIGGERING SET MAPPING SYNCHRONIZATION"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo ""

# Function to invoke the timer function
invoke_function() {
  echo "Invoking synchronizeSetMappings function..."
  
  # Use Azure CLI to invoke the timer-triggered function
  # The --async flag ensures we don't wait for completion
  az functionapp function invoke \
    --name "$FUNCTION_APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --function-name "synchronizeSetMappings" \
    --async true \
    --output none
  
  return $?
}

# Retry logic with exponential backoff
for attempt in $(seq 1 $MAX_RETRIES); do
  echo "Attempt $attempt of $MAX_RETRIES..."
  
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
      echo "⚠️  Invocation failed (exit code: $EXIT_CODE), retrying in ${RETRY_DELAY}s..."
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
echo "3. Use Azure CLI:"
echo "   az functionapp function invoke \\"
echo "     --name $FUNCTION_APP_NAME \\"
echo "     --resource-group $RESOURCE_GROUP \\"
echo "     --function-name synchronizeSetMappings"
echo ""
echo "=========================================="

# Exit with 0 to not fail the pipeline - this is a warning, not a critical failure
exit 0
