#!/bin/bash
# Script to initialize Terraform with remote backend and import existing resources
# This script helps migrate from local state to remote state and import pre-existing Azure resources

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUBSCRIPTION_ID="555b4cfa-ad2e-4c71-9433-620a59cf7616"
ENVIRONMENT="prod"
RESOURCE_GROUP="pcpc-rg-${ENVIRONMENT}"
BACKEND_RG="pcpc-terraform-state-rg"
BACKEND_STORAGE="pcpctfstatedacc29c2"
BACKEND_CONTAINER="tfstate"
BACKEND_KEY="${ENVIRONMENT}.terraform.tfstate"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Terraform Backend Migration & Import${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

resource_in_state() {
    local address="$1"
    terraform state show "$address" >/dev/null 2>&1
}

print_section_header() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_import_line() {
    local address="$1"
    local resource_id="$2"
    echo "  terraform import '${address}' \"${resource_id}\""
}

# Step 1: Check Azure CLI authentication
echo -e "${YELLOW}Step 1: Checking Azure CLI authentication...${NC}"
if ! az account show &>/dev/null; then
    echo -e "${RED}Error: Not logged in to Azure CLI${NC}"
    echo "Please run: az login"
    exit 1
fi

CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]; then
    echo -e "${YELLOW}Setting subscription to: $SUBSCRIPTION_ID${NC}"
    az account set --subscription "$SUBSCRIPTION_ID"
fi
echo -e "${GREEN}✓ Authenticated and using correct subscription${NC}"
echo ""

# Step 2: Verify backend storage exists
echo -e "${YELLOW}Step 2: Verifying backend storage...${NC}"
if ! az storage account show --name "$BACKEND_STORAGE" --resource-group "$BACKEND_RG" &>/dev/null; then
    echo -e "${RED}Error: Backend storage account not found${NC}"
    echo "Expected: $BACKEND_STORAGE in $BACKEND_RG"
    exit 1
fi
echo -e "${GREEN}✓ Backend storage verified${NC}"
echo ""

# Step 3: Initialize Terraform with remote backend
echo -e "${YELLOW}Step 3: Initializing Terraform with remote backend...${NC}"
terraform init -reconfigure \
    -backend-config="resource_group_name=$BACKEND_RG" \
    -backend-config="storage_account_name=$BACKEND_STORAGE" \
    -backend-config="container_name=$BACKEND_CONTAINER" \
    -backend-config="key=$BACKEND_KEY"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Terraform initialized with remote backend${NC}"
else
    echo -e "${RED}Error: Terraform initialization failed${NC}"
    exit 1
fi
echo ""

# Step 4: Check what resources exist in Azure
echo -e "${YELLOW}Step 4: Checking existing Azure resources...${NC}"
if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo -e "${GREEN}✓ Resource group exists: $RESOURCE_GROUP${NC}"
    echo ""
    echo "Existing resources in $RESOURCE_GROUP:"
    az resource list --resource-group "$RESOURCE_GROUP" --output table
    echo ""
else
    echo -e "${YELLOW}! Resource group does not exist: $RESOURCE_GROUP${NC}"
    echo "Terraform will create it on first apply."
    exit 0
fi

# Step 5: Import resource group if it exists
echo -e "${YELLOW}Step 5: Checking if resource group needs to be imported...${NC}"
if resource_in_state "module.resource_group.azurerm_resource_group.this"; then
    echo -e "${GREEN}✓ Resource group already in state${NC}"
else
    echo -e "${YELLOW}Importing resource group...${NC}"
    terraform import module.resource_group.azurerm_resource_group.this \
        "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Resource group imported successfully${NC}"
    else
        echo -e "${RED}Error: Failed to import resource group${NC}"
        exit 1
    fi
fi
echo ""

# Step 6: Check for other resources that might need importing
echo -e "${YELLOW}Step 6: Checking for other resources to import...${NC}"
echo ""

# Get list of resources in the resource group
RESOURCES=$(az resource list --resource-group "$RESOURCE_GROUP" --query "[].{name:name, type:type, id:id, kind:kind}" -o json)

# Cosmos DB
COSMOS_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.DocumentDB/databaseAccounts")')
if [ -n "$COSMOS_JSON" ]; then
    print_section_header "Cosmos DB Account"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        cosmos_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.cosmos_db.azurerm_cosmosdb_account.this"; then
            echo -e "  ${GREEN}✓ Cosmos DB already in state${NC}"
        else
            print_import_line "module.cosmos_db.azurerm_cosmosdb_account.this" "$cosmos_id"
        fi
    done <<< "$COSMOS_JSON"
fi

# Key Vault
KEY_VAULT_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.KeyVault/vaults")')
if [ -n "$KEY_VAULT_JSON" ]; then
    print_section_header "Key Vault"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        kv_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.key_vault.azurerm_key_vault.this"; then
            echo -e "  ${GREEN}✓ Key Vault already in state${NC}"
        else
            print_import_line "module.key_vault.azurerm_key_vault.this" "$kv_id"
        fi
    done <<< "$KEY_VAULT_JSON"
fi

# Management Locks
LOCK_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.Authorization/locks")')
if [ -n "$LOCK_JSON" ]; then
    print_section_header "Management Locks"
    index=0
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        lock_id=$(echo "$row" | jq -r '.id')
        address="module.resource_group.azurerm_management_lock.this[$index]"
        if resource_in_state "$address"; then
            echo -e "  ${GREEN}✓ Management lock [$index] already in state${NC}"
        else
            print_import_line "$address" "$lock_id"
        fi
        index=$((index + 1))
    done <<< "$LOCK_JSON"
fi

# Storage Accounts and Shares
STORAGE_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.Storage/storageAccounts")')
if [ -n "$STORAGE_JSON" ]; then
    print_section_header "Storage Account & Shares"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        storage_name=$(echo "$row" | jq -r '.name')
        storage_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.storage_account.azurerm_storage_account.main"; then
            echo -e "  ${GREEN}✓ Storage account already in state${NC}"
        else
            print_import_line "module.storage_account.azurerm_storage_account.main" "$storage_id"
        fi

        share_name="pcpc-func-${ENVIRONMENT}"
        if SHARE_JSON=$(az storage share-rm show --resource-group "$RESOURCE_GROUP" --storage-account "$storage_name" --name "$share_name" 2>/dev/null); then
            share_id=$(echo "$SHARE_JSON" | jq -r '.id')
            if resource_in_state "azurerm_storage_share.function_app_content"; then
                echo -e "  ${GREEN}✓ Storage share ${share_name} already in state${NC}"
            else
                print_import_line "azurerm_storage_share.function_app_content" "$share_id"
            fi
        else
            echo -e "  ${YELLOW}! Storage share ${share_name} not found under account ${storage_name}${NC}"
        fi
    done <<< "$STORAGE_JSON"
fi

# App Service Plans
PLAN_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.Web/serverfarms")')
if [ -n "$PLAN_JSON" ]; then
    print_section_header "App Service Plan"
    index=0
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        plan_id=$(echo "$row" | jq -r '.id')
        address="module.function_app.azurerm_service_plan.this[$index]"
        if resource_in_state "$address"; then
            echo -e "  ${GREEN}✓ App Service Plan [$index] already in state${NC}"
        else
            print_import_line "$address" "$plan_id"
        fi
        index=$((index + 1))
    done <<< "$PLAN_JSON"
fi

# Function Apps
FUNC_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.Web/sites" and (.name | contains("func")))')
if [ -n "$FUNC_JSON" ]; then
    print_section_header "Function App"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        func_id=$(echo "$row" | jq -r '.id')
        kind=$(echo "$row" | jq -r '.kind // ""' | tr '[:upper:]' '[:lower:]')
        if [[ "$kind" == *"linux"* ]]; then
            address="module.function_app.azurerm_linux_function_app.this[0]"
        else
            address="module.function_app.azurerm_windows_function_app.this[0]"
        fi
        if resource_in_state "$address"; then
            echo -e "  ${GREEN}✓ Function App already in state${NC}"
        else
            print_import_line "$address" "$func_id"
        fi
    done <<< "$FUNC_JSON"
fi

# Static Web Apps
SWA_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.Web/staticSites")')
if [ -n "$SWA_JSON" ]; then
    print_section_header "Static Web App"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        swa_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.static_web_app.azurerm_static_web_app.this"; then
            echo -e "  ${GREEN}✓ Static Web App already in state${NC}"
        else
            print_import_line "module.static_web_app.azurerm_static_web_app.this" "$swa_id"
        fi
    done <<< "$SWA_JSON"
fi

# Log Analytics Workspace
LOG_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.OperationalInsights/workspaces")')
if [ -n "$LOG_JSON" ]; then
    print_section_header "Log Analytics Workspace"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        log_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.log_analytics.azurerm_log_analytics_workspace.this"; then
            echo -e "  ${GREEN}✓ Log Analytics workspace already in state${NC}"
        else
            print_import_line "module.log_analytics.azurerm_log_analytics_workspace.this" "$log_id"
        fi
    done <<< "$LOG_JSON"
fi

# Application Insights
APPI_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="microsoft.insights/components")')
if [ -n "$APPI_JSON" ]; then
    print_section_header "Application Insights"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        appi_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.application_insights.azurerm_application_insights.this"; then
            echo -e "  ${GREEN}✓ Application Insights already in state${NC}"
        else
            print_import_line "module.application_insights.azurerm_application_insights.this" "$appi_id"
        fi
    done <<< "$APPI_JSON"
fi

# Action Groups
ACTION_GROUP_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.Insights/actionGroups")')
if [ -n "$ACTION_GROUP_JSON" ]; then
    print_section_header "Monitor Action Groups"
    index=0
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        ag_id=$(echo "$row" | jq -r '.id')
        address="module.application_insights.azurerm_monitor_action_group.this[$index]"
        if resource_in_state "$address"; then
            echo -e "  ${GREEN}✓ Action Group [$index] already in state${NC}"
        else
            print_import_line "$address" "$ag_id"
        fi
        index=$((index + 1))
    done <<< "$ACTION_GROUP_JSON"
fi

# Metric Alerts
METRIC_ALERT_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="microsoft.insights/metricalerts")')
if [ -n "$METRIC_ALERT_JSON" ]; then
    print_section_header "Monitor Metric Alerts"
    index=0
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        alert_id=$(echo "$row" | jq -r '.id')
        address="module.application_insights.azurerm_monitor_metric_alert.this[$index]"
        if resource_in_state "$address"; then
            echo -e "  ${GREEN}✓ Metric Alert [$index] already in state${NC}"
        else
            print_import_line "$address" "$alert_id"
        fi
        index=$((index + 1))
    done <<< "$METRIC_ALERT_JSON"
fi

# API Management
API_JSON=$(echo "$RESOURCES" | jq -c '.[] | select(.type=="Microsoft.ApiManagement/service")')
if [ -n "$API_JSON" ]; then
    print_section_header "API Management"
    while IFS= read -r row; do
        [ -z "$row" ] && continue
        api_id=$(echo "$row" | jq -r '.id')
        if resource_in_state "module.api_management[0].azurerm_api_management.this"; then
            echo -e "  ${GREEN}✓ API Management already in state${NC}"
        else
            print_import_line "module.api_management[0].azurerm_api_management.this" "$api_id"
        fi
    done <<< "$API_JSON"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Migration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Run 'terraform plan' to see what changes are needed"
echo "2. If there are resources to import, run the import commands shown above"
echo "3. Run 'terraform plan' again to verify"
echo "4. Run 'terraform apply' to apply any remaining changes"
echo ""
