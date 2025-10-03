#!/bin/bash
# Setup Terraform Backend
# Validates Terraform backend configuration and storage account accessibility

set -e

echo "=========================================="
echo "Terraform Backend Setup Validation"
echo "=========================================="

# Validate required environment variables
required_vars=(
  "TF_STATE_RESOURCE_GROUP"
  "TF_STATE_STORAGE_ACCOUNT"
  "TF_STATE_CONTAINER"
)

echo "Checking required environment variables..."
for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ Error: $var is not set"
    exit 1
  fi
  echo "✓ $var is set"
done

echo ""
echo "Backend Configuration:"
echo "  Resource Group: $TF_STATE_RESOURCE_GROUP"
echo "  Storage Account: $TF_STATE_STORAGE_ACCOUNT"
echo "  Container: $TF_STATE_CONTAINER"
echo ""

# Check if storage account exists
echo "Validating storage account accessibility..."
if ! az storage account show \
  --name "$TF_STATE_STORAGE_ACCOUNT" \
  --resource-group "$TF_STATE_RESOURCE_GROUP" &>/dev/null; then
  echo "❌ Error: Storage account $TF_STATE_STORAGE_ACCOUNT not found in resource group $TF_STATE_RESOURCE_GROUP"
  exit 1
fi
echo "✓ Storage account exists and is accessible"

# Check if container exists
echo "Validating storage container..."
if ! az storage container show \
  --name "$TF_STATE_CONTAINER" \
  --account-name "$TF_STATE_STORAGE_ACCOUNT" \
  --auth-mode login &>/dev/null; then
  echo "❌ Error: Container $TF_STATE_CONTAINER not found in storage account $TF_STATE_STORAGE_ACCOUNT"
  exit 1
fi
echo "✓ Storage container exists and is accessible"

# Check blob versioning
echo "Checking blob versioning..."
VERSIONING=$(az storage account blob-service-properties show \
  --account-name "$TF_STATE_STORAGE_ACCOUNT" \
  --resource-group "$TF_STATE_RESOURCE_GROUP" \
  --query "isVersioningEnabled" -o tsv)

if [ "$VERSIONING" = "true" ]; then
  echo "✓ Blob versioning is enabled"
else
  echo "⚠ Warning: Blob versioning is not enabled (recommended for state file protection)"
fi

echo ""
echo "=========================================="
echo "Backend validation completed successfully"
echo "=========================================="
