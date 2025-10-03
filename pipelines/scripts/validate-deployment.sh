#!/bin/bash
# Validate Deployment
# Performs post-deployment validation checks for PCPC infrastructure

set -e

ENVIRONMENT=${1:-dev}

echo "=========================================="
echo "Post-Deployment Validation"
echo "Environment: $ENVIRONMENT"
echo "=========================================="

# Resource naming convention
RESOURCE_GROUP="pcpc-rg-$ENVIRONMENT"
FUNCTION_APP="pcpc-func-$ENVIRONMENT"
STATIC_WEB_APP="pcpc-swa-$ENVIRONMENT"
COSMOS_DB="pcpc-cosmos-$ENVIRONMENT"
LOG_ANALYTICS="pcpc-log-$ENVIRONMENT"
APP_INSIGHTS="pcpc-appi-$ENVIRONMENT"

echo ""
echo "Validating resource group..."
if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
  echo "✓ Resource group exists: $RESOURCE_GROUP"
else
  echo "❌ Resource group not found: $RESOURCE_GROUP"
  exit 1
fi

echo ""
echo "Validating Log Analytics workspace..."
if az monitor log-analytics workspace show \
  --resource-group "$RESOURCE_GROUP" \
  --workspace-name "$LOG_ANALYTICS" &>/dev/null; then
  echo "✓ Log Analytics workspace exists: $LOG_ANALYTICS"
else
  echo "⚠ Warning: Log Analytics workspace not found: $LOG_ANALYTICS"
fi

echo ""
echo "Validating Application Insights..."
if az monitor app-insights component show \
  --resource-group "$RESOURCE_GROUP" \
  --app "$APP_INSIGHTS" &>/dev/null; then
  echo "✓ Application Insights exists: $APP_INSIGHTS"
else
  echo "⚠ Warning: Application Insights not found: $APP_INSIGHTS"
fi

echo ""
echo "Validating Cosmos DB account..."
if az cosmosdb show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COSMOS_DB" &>/dev/null; then
  echo "✓ Cosmos DB account exists: $COSMOS_DB"
  
  # Check Cosmos DB containers
  echo "  Checking Cosmos DB containers..."
  CONTAINERS=$(az cosmosdb sql container list \
    --resource-group "$RESOURCE_GROUP" \
    --account-name "$COSMOS_DB" \
    --database-name "PokeData" \
    --query "[].name" -o tsv 2>/dev/null || echo "")
  
  if [ -n "$CONTAINERS" ]; then
    echo "  ✓ Containers found:"
    echo "$CONTAINERS" | while read -r container; do
      echo "    - $container"
    done
  else
    echo "  ⚠ Warning: No containers found or database not created yet"
  fi
else
  echo "⚠ Warning: Cosmos DB account not found: $COSMOS_DB"
fi

echo ""
echo "Validating Function App..."
if az functionapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$FUNCTION_APP" &>/dev/null; then
  echo "✓ Function App exists: $FUNCTION_APP"
  
  # Check Function App state
  STATE=$(az functionapp show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$FUNCTION_APP" \
    --query "state" -o tsv)
  echo "  State: $STATE"
  
  if [ "$STATE" = "Running" ]; then
    echo "  ✓ Function App is running"
  else
    echo "  ⚠ Warning: Function App is not running"
  fi
else
  echo "⚠ Warning: Function App not found: $FUNCTION_APP"
fi

echo ""
echo "Validating Static Web App..."
if az staticwebapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STATIC_WEB_APP" &>/dev/null; then
  echo "✓ Static Web App exists: $STATIC_WEB_APP"
  
  # Get default hostname
  HOSTNAME=$(az staticwebapp show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$STATIC_WEB_APP" \
    --query "defaultHostname" -o tsv)
  echo "  Default hostname: https://$HOSTNAME"
else
  echo "⚠ Warning: Static Web App not found: $STATIC_WEB_APP"
fi

echo ""
echo "Listing all resources in resource group..."
az resource list \
  --resource-group "$RESOURCE_GROUP" \
  --output table

echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Resource Group: $RESOURCE_GROUP"
echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo ""
echo "✓ Deployment validation completed"
echo "=========================================="
