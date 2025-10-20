#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./import-existing-resources.sh <environment> [options]

Supported environments: dev, staging, prod

Options:
  --resource-group NAME     Resource group containing API Management (default: pcpc-rg-<env>)
  --apim-name NAME          API Management service name (default: pcpc-apim-<env>)
  --function-app NAME       Azure Function App backend name (default: pcpc-func-<env>)
  --api-version VERSION     API version segment (default: v1)
  --ai-name NAME            Application Insights name (default: pcpc-appi-<env>)
  --products LIST           Comma-separated list of API Management product IDs (default: starter,)
  --state-key KEY           Remote state blob key (default: apim-<env>.terraform.tfstate)
  --tfvars FILE             Optional terraform.tfvars file to read overrides from
  -h, --help                Show this help message

The script initializes Terraform (remote backend) and prints import commands for
all API Management configuration resources managed in this module that are not
yet tracked in the local state.
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

ENVIRONMENT="$1"
shift

case "$ENVIRONMENT" in
  dev|staging|prod) ;;
  *)
    echo "Error: environment must be one of dev, staging, prod." >&2
    exit 1
    ;;
esac

# -----------------------------------------------------------------------------
# DEFAULT CONFIGURATION
# -----------------------------------------------------------------------------

SUBSCRIPTION_ID="555b4cfa-ad2e-4c71-9433-620a59cf7616"
TFVARS_FILE=""
RESOURCE_GROUP=""
APIM_NAME=""
FUNCTION_APP_NAME=""
API_VERSION_SEGMENT="v1"
APP_INSIGHTS_NAME=""
PRODUCT_LIST="starter,"
STATE_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --resource-group)
      RESOURCE_GROUP="$2"
      shift 2
      ;;
    --apim-name)
      APIM_NAME="$2"
      shift 2
      ;;
    --function-app)
      FUNCTION_APP_NAME="$2"
      shift 2
      ;;
    --api-version)
      API_VERSION_SEGMENT="$2"
      shift 2
      ;;
    --ai-name)
      APP_INSIGHTS_NAME="$2"
      shift 2
      ;;
    --products)
      PRODUCT_LIST="$2"
      shift 2
      ;;
    --state-key)
      STATE_KEY="$2"
      shift 2
      ;;
    --tfvars)
      TFVARS_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

default_if_empty() {
  local value="$1"
  local fallback="$2"
  if [[ -n "${value}" ]]; then
    echo "${value}"
  else
    echo "${fallback}"
  fi
}

parse_tfvars_value() {
  local key="$1"
  local file="$2"
  if [[ ! -f "$file" ]]; then
    return
  fi
  local line
  line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | tail -n1 || true)
  if [[ -n "$line" ]]; then
    echo "$line" | sed -E 's/^[^=]+=\s*"([^"]*)".*$/\1/' | tr -d '[:space:]'
  fi
}

# Attempt to load overrides from terraform.tfvars if provided or present per-env
if [[ -z "$TFVARS_FILE" ]]; then
  candidate="${script_dir}/../environments/${ENVIRONMENT}/terraform.tfvars"
  [[ -f "$candidate" ]] && TFVARS_FILE="$candidate"
fi

if [[ -n "$TFVARS_FILE" ]]; then
  rg_value=$(parse_tfvars_value "resource_group_name" "$TFVARS_FILE")
  apim_value=$(parse_tfvars_value "api_management_name" "$TFVARS_FILE")
  func_value=$(parse_tfvars_value "function_app_name" "$TFVARS_FILE")
  ai_value=$(parse_tfvars_value "application_insights_name" "$TFVARS_FILE")
  [[ -n "$rg_value" ]] && RESOURCE_GROUP="$rg_value"
  [[ -n "$apim_value" ]] && APIM_NAME="$apim_value"
  [[ -n "$func_value" ]] && FUNCTION_APP_NAME="$func_value"
  [[ -n "$ai_value" ]] && APP_INSIGHTS_NAME="$ai_value"
fi

RESOURCE_GROUP=$(default_if_empty "$RESOURCE_GROUP" "pcpc-rg-${ENVIRONMENT}")
APIM_NAME=$(default_if_empty "$APIM_NAME" "pcpc-apim-${ENVIRONMENT}")
FUNCTION_APP_NAME=$(default_if_empty "$FUNCTION_APP_NAME" "pcpc-func-${ENVIRONMENT}")
APP_INSIGHTS_NAME=$(default_if_empty "$APP_INSIGHTS_NAME" "pcpc-appi-${ENVIRONMENT}")
STATE_KEY=$(default_if_empty "$STATE_KEY" "apim-${ENVIRONMENT}.terraform.tfstate")

BACKEND_RG="pcpc-terraform-state-rg"
BACKEND_STORAGE="pcpctfstatedacc29c2"
BACKEND_CONTAINER="tfstate"
APIM_API_VERSION="2021-08-01"

resource_in_state() {
  local address="$1"
  terraform state show "$address" >/dev/null 2>&1
}

print_section_header() {
  local title="$1"
  echo ""
  echo -e "\033[0;32m========================================\033[0m"
  echo -e "\033[0;32m${title}\033[0m"
  echo -e "\033[0;32m========================================\033[0m"
}

print_import_line() {
  local address="$1"
  local resource_id="$2"
  echo "  terraform import '${address}' \"${resource_id}\""
}

resource_exists() {
  local resource_id="$1"
  az rest \
    --method get \
    --url "https://management.azure.com${resource_id}?api-version=${APIM_API_VERSION}" \
    --subscription "${SUBSCRIPTION_ID}" \
    >/dev/null 2>&1
}

# -----------------------------------------------------------------------------
# ENVIRONMENT SUMMARY
# -----------------------------------------------------------------------------

echo "Environment               : ${ENVIRONMENT}"
echo "Subscription ID           : ${SUBSCRIPTION_ID}"
echo "Resource Group            : ${RESOURCE_GROUP}"
echo "API Management Name       : ${APIM_NAME}"
echo "Function App Name         : ${FUNCTION_APP_NAME}"
echo "API Version Segment       : ${API_VERSION_SEGMENT}"
echo "Application Insights Name : ${APP_INSIGHTS_NAME:-<none>}"
echo "Products                  : ${PRODUCT_LIST}"
echo ""

# -----------------------------------------------------------------------------
# PRECHECKS
# -----------------------------------------------------------------------------

echo -e "\033[1;33mStep 1: Checking Azure CLI authentication...\033[0m"
if ! az account show >/dev/null 2>&1; then
  echo -e "\033[0;31mError: Not logged in to Azure CLI. Run 'az login' first.\033[0m" >&2
  exit 1
fi

CURRENT_SUB=$(az account show --query id -o tsv)
if [[ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ]]; then
  echo -e "\033[1;33mSetting subscription to ${SUBSCRIPTION_ID}\033[0m"
  az account set --subscription "$SUBSCRIPTION_ID"
fi
echo -e "\033[0;32m✓ Azure CLI authenticated\033[0m"
echo ""

echo -e "\033[1;33mStep 2: Verifying remote state backend...\033[0m"
if ! az storage account show --name "$BACKEND_STORAGE" --resource-group "$BACKEND_RG" >/dev/null 2>&1; then
  echo -e "\033[0;31mError: Backend storage account ${BACKEND_STORAGE} not found in ${BACKEND_RG}\033[0m" >&2
  exit 1
fi
echo -e "\033[0;32m✓ Remote state storage verified\033[0m"
echo ""

echo -e "\033[1;33mStep 3: Initializing Terraform (remote backend)...\033[0m"
terraform init -reconfigure \
  -backend-config="resource_group_name=${BACKEND_RG}" \
  -backend-config="storage_account_name=${BACKEND_STORAGE}" \
  -backend-config="container_name=${BACKEND_CONTAINER}" \
  -backend-config="key=${STATE_KEY}"
echo ""

BASE_ID="/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ApiManagement/service/${APIM_NAME}"
API_RESOURCE_ID="${BASE_ID}/apis/pcpc-api-${ENVIRONMENT}"
BACKEND_ID="${BASE_ID}/backends/pcpc-function-backend-${ENVIRONMENT}"
NAMED_VALUE_ID="${BASE_ID}/namedValues/function-app-key"
LOGGER_ID="${BASE_ID}/loggers/applicationinsights-logger-${ENVIRONMENT}"
DIAGNOSTIC_ID="${API_RESOURCE_ID}/diagnostics/applicationinsights"

declare -A OPERATIONS=(
  ["get_sets"]="get-set-list"
  ["get_cards_by_set"]="get-cards-by-set"
  ["get_card_info"]="get-card-info"
)

# -----------------------------------------------------------------------------
# RESOURCE GROUP EXISTENCE
# -----------------------------------------------------------------------------

print_section_header "Validating required Azure resources"
if ! az apim show --name "$APIM_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  echo -e "  \033[0;31mError: API Management instance ${APIM_NAME} not found in ${RESOURCE_GROUP}\033[0m" >&2
  exit 1
else
  echo -e "  \033[0;32m✓ API Management instance found\033[0m"
fi

# -----------------------------------------------------------------------------
# IMPORT COMMANDS
# -----------------------------------------------------------------------------

print_section_header "API Core Resources"
if resource_in_state "azurerm_api_management_api.pcpc_api"; then
  echo "  ✓ API already imported"
else
  if resource_exists "$API_RESOURCE_ID"; then
    print_import_line "azurerm_api_management_api.pcpc_api" "$API_RESOURCE_ID"
  else
    echo "  ⚠️  API resource not found at ${API_RESOURCE_ID}"
  fi
fi

if resource_in_state "azurerm_api_management_named_value.function_app_key"; then
  echo "  ✓ Named value already imported"
else
  if resource_exists "$NAMED_VALUE_ID"; then
    print_import_line "azurerm_api_management_named_value.function_app_key" "$NAMED_VALUE_ID"
  else
    echo "  ⚠️  Named value ${NAMED_VALUE_ID} not found"
  fi
fi

if resource_in_state "azurerm_api_management_backend.function_app"; then
  echo "  ✓ Backend already imported"
else
  if resource_exists "$BACKEND_ID"; then
    print_import_line "azurerm_api_management_backend.function_app" "$BACKEND_ID"
  else
    echo "  ⚠️  Backend ${BACKEND_ID} not found"
  fi
fi

print_section_header "API Operations"
for key in "${!OPERATIONS[@]}"; do
  operation_id="${OPERATIONS[$key]}"
  address="azurerm_api_management_api_operation.${key}"
  operation_resource_id="${API_RESOURCE_ID}/operations/${operation_id}"
  if resource_in_state "$address"; then
    echo "  ✓ Operation ${operation_id} already imported"
  else
    if resource_exists "$operation_resource_id"; then
      print_import_line "$address" "$operation_resource_id"
    else
      echo "  ⚠️  Operation ${operation_id} not found"
    fi
  fi
done

print_section_header "API Policies"
API_POLICY_ID="${API_RESOURCE_ID}/policies/policy"
if resource_in_state "azurerm_api_management_api_policy.pcpc_api_global"; then
  echo "  ✓ Global API policy already imported"
else
  if az apim api policy show \
      --resource-group "$RESOURCE_GROUP" \
      --service-name "$APIM_NAME" \
      --api-id "pcpc-api-${ENVIRONMENT}" \
      --format rawxml >/dev/null 2>&1; then
    print_import_line "azurerm_api_management_api_policy.pcpc_api_global" "$API_POLICY_ID"
  else
    echo "  ⚠️  API policy not found (did you deploy it yet?)"
  fi
fi

# Backend operation policies (always created)
declare -A BACKEND_POLICY_ADDRESSES=(
  ["get_sets"]="azurerm_api_management_api_operation_policy.get_sets_backend"
  ["get_cards_by_set"]="azurerm_api_management_api_operation_policy.get_cards_backend"
  ["get_card_info"]="azurerm_api_management_api_operation_policy.get_card_info_backend"
)

for key in "${!BACKEND_POLICY_ADDRESSES[@]}"; do
  operation_id="${OPERATIONS[$key]}"
  address="${BACKEND_POLICY_ADDRESSES[$key]}"
  operation_policy_id="${API_RESOURCE_ID}/operations/${operation_id}/policies/policy"
  if resource_in_state "$address"; then
    echo "  ✓ Backend policy for ${operation_id} already imported"
  else
    if az apim api operation policy show \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --api-id "pcpc-api-${ENVIRONMENT}" \
        --operation-id "$operation_id" \
        --format rawxml >/dev/null 2>&1; then
      print_import_line "$address" "$operation_policy_id"
    else
      echo "  ⚠️  Backend policy for ${operation_id} not found"
    fi
  fi
done

# Caching operation policies (conditional)
declare -A CACHE_POLICY_ADDRESSES=(
  ["get_sets"]="azurerm_api_management_api_operation_policy.get_sets_cache[0]"
  ["get_cards_by_set"]="azurerm_api_management_api_operation_policy.get_cards_cache[0]"
  ["get_card_info"]="azurerm_api_management_api_operation_policy.get_card_info_cache[0]"
)

for key in "${!CACHE_POLICY_ADDRESSES[@]}"; do
  operation_id="${OPERATIONS[$key]}"
  address="${CACHE_POLICY_ADDRESSES[$key]}"
  operation_policy_id="${API_RESOURCE_ID}/operations/${operation_id}/policies/policy"
  if resource_in_state "$address"; then
    echo "  ✓ Cache policy for ${operation_id} already imported"
  else
    if az apim api operation policy show \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --api-id "pcpc-api-${ENVIRONMENT}" \
        --operation-id "$operation_id" \
        --format rawxml >/dev/null 2>&1; then
      print_import_line "$address" "$operation_policy_id"
    else
      echo "  ⚠️  Cache policy for ${operation_id} not found or caching disabled"
    fi
  fi
done

print_section_header "Products & Product APIs"
IFS=',' read -ra PRODUCT_IDS <<< "$PRODUCT_LIST"
for raw_product in "${PRODUCT_IDS[@]}"; do
  product="$(echo "$raw_product" | xargs)" # trim
  [[ -z "$product" ]] && continue
  product_address="azurerm_api_management_product.products[\"${product}\"]"
  product_id="${BASE_ID}/products/${product}"

  if resource_in_state "$product_address"; then
    echo "  ✓ Product ${product} already imported"
  else
    if az apim product show \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --product-id "$product" >/dev/null 2>&1; then
      print_import_line "$product_address" "$product_id"
    else
      echo "  ⚠️  Product ${product} not found"
    fi
  fi

  product_api_address="azurerm_api_management_product_api.pcpc_api_products[\"${product}\"]"
  product_api_id="${product_id}/apis/pcpc-api-${ENVIRONMENT}"

  if resource_in_state "$product_api_address"; then
    echo "  ✓ Product/API link for ${product} already imported"
  else
    product_api_link=$(az apim product api list \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --product-id "$product" \
        --query "[?name=='pcpc-api-${ENVIRONMENT}'].name" \
        --output tsv 2>/dev/null || true)
    if [[ -n "$product_api_link" ]]; then
      print_import_line "$product_api_address" "$product_api_id"
    else
      echo "  ⚠️  API not linked to product ${product}"
    fi
  fi
done

print_section_header "Monitoring (Application Insights)"
LOGGER_ADDRESS="azurerm_api_management_logger.application_insights[0]"
if resource_in_state "$LOGGER_ADDRESS"; then
  echo "  ✓ Application Insights logger already imported"
else
  if [[ -n "$APP_INSIGHTS_NAME" ]] && az apim logger show \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --name "applicationinsights-logger-${ENVIRONMENT}" >/dev/null 2>&1; then
    print_import_line "$LOGGER_ADDRESS" "$LOGGER_ID"
  else
    echo "  ⚠️  Logger not found or Application Insights disabled"
  fi
fi

DIAGNOSTIC_ADDRESS="azurerm_api_management_api_diagnostic.pcpc_api_diagnostics[0]"
if resource_in_state "$DIAGNOSTIC_ADDRESS"; then
  echo "  ✓ API diagnostic already imported"
else
  if az apim api diagnostic show \
        --resource-group "$RESOURCE_GROUP" \
        --service-name "$APIM_NAME" \
        --api-id "pcpc-api-${ENVIRONMENT}" \
        --name "applicationinsights" >/dev/null 2>&1; then
    print_import_line "$DIAGNOSTIC_ADDRESS" "$DIAGNOSTIC_ID"
  else
    echo "  ⚠️  API diagnostic not found or Application Insights disabled"
  fi
fi

echo ""
echo -e "\033[0;32m========================================\033[0m"
echo -e "\033[0;32mImport inspection complete\033[0m"
echo -e "\033[0;32m========================================\033[0m"
echo ""
echo "Run the commands above for any resources that need to be imported."
echo "After completing imports, run 'terraform plan' to validate state."
