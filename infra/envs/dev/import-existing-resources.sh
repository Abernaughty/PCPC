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
RESOURCE_GROUP="pcpc-rg-dev"
BACKEND_RG="pcpc-terraform-state-rg"
BACKEND_STORAGE="pcpctfstatedacc29c2"
BACKEND_CONTAINER="tfstate"
BACKEND_KEY="dev.terraform.tfstate"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Terraform Backend Migration & Import${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

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
if terraform state show module.resource_group.azurerm_resource_group.this &>/dev/null; then
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
RESOURCES=$(az resource list --resource-group "$RESOURCE_GROUP" --query "[].{name:name, type:type, id:id}" -o json)

# Check for Cosmos DB
COSMOS_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="Microsoft.DocumentDB/databaseAccounts") | .name')
if [ -n "$COSMOS_EXISTS" ]; then
    echo -e "${YELLOW}Found Cosmos DB: $COSMOS_EXISTS${NC}"
    if ! terraform state show module.cosmos_db.azurerm_cosmosdb_account.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.cosmos_db.azurerm_cosmosdb_account.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DocumentDB/databaseAccounts/$COSMOS_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
fi

# Check for API Management
API_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="Microsoft.ApiManagement/service") | .name')
if [ -n "$API_EXISTS" ]; then
    echo -e "${YELLOW}Found API Management: $API_EXISTS${NC}"
    if ! terraform state show module.api_management.azurerm_api_management.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.api_management.azurerm_api_management.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.ApiManagement/service/$API_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
fi

# Check for Storage Account
STORAGE_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="Microsoft.Storage/storageAccounts") | .name')
if [ -n "$STORAGE_EXISTS" ]; then
    echo -e "${YELLOW}Found Storage Account: $STORAGE_EXISTS${NC}"
    if ! terraform state show module.storage_account.azurerm_storage_account.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.storage_account.azurerm_storage_account.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
fi

# Check for Function App
FUNC_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="Microsoft.Web/sites" and (.name | contains("func"))) | .name')
if [ -n "$FUNC_EXISTS" ]; then
    echo -e "${YELLOW}Found Function App: $FUNC_EXISTS${NC}"
    if ! terraform state show module.function_app.azurerm_linux_function_app.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.function_app.azurerm_linux_function_app.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/$FUNC_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
fi

# Check for Static Web App
SWA_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="Microsoft.Web/staticSites") | .name')
if [ -n "$SWA_EXISTS" ]; then
    echo -e "${YELLOW}Found Static Web App: $SWA_EXISTS${NC}"
    if ! terraform state show module.static_web_app.azurerm_static_web_app.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.static_web_app.azurerm_static_web_app.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/staticSites/$SWA_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
fi

# Check for Log Analytics
LOG_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="Microsoft.OperationalInsights/workspaces") | .name')
if [ -n "$LOG_EXISTS" ]; then
    echo -e "${YELLOW}Found Log Analytics: $LOG_EXISTS${NC}"
    if ! terraform state show module.log_analytics.azurerm_log_analytics_workspace.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.log_analytics.azurerm_log_analytics_workspace.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.OperationalInsights/workspaces/$LOG_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
fi

# Check for Application Insights
APPI_EXISTS=$(echo "$RESOURCES" | jq -r '.[] | select(.type=="microsoft.insights/components") | .name')
if [ -n "$APPI_EXISTS" ]; then
    echo -e "${YELLOW}Found Application Insights: $APPI_EXISTS${NC}"
    if ! terraform state show module.application_insights.azurerm_application_insights.this &>/dev/null; then
        echo "  To import, run:"
        echo "  terraform import module.application_insights.azurerm_application_insights.this /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/microsoft.insights/components/$APPI_EXISTS"
    else
        echo -e "  ${GREEN}✓ Already in state${NC}"
    fi
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
