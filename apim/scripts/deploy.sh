#!/bin/bash

# -----------------------------------------------------------------------------
# PCPC API Management Deployment Script
# -----------------------------------------------------------------------------
# This script deploys APIM configuration to the specified environment
# Usage: ./deploy.sh <environment> [validate-only]
# Example: ./deploy.sh dev
# Example: ./deploy.sh prod validate-only

set -e  # Exit on any error

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENVIRONMENTS_DIR="$PROJECT_ROOT/environments"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# FUNCTIONS
# -----------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_usage() {
    echo "Usage: $0 <environment> [validate-only]"
    echo ""
    echo "Arguments:"
    echo "  environment    Target environment (dev, staging, prod)"
    echo "  validate-only  Optional flag to run validation only (no deployment)"
    echo ""
    echo "Examples:"
    echo "  $0 dev                    # Deploy to development"
    echo "  $0 prod validate-only     # Validate production configuration"
    echo ""
    echo "Environment Variables:"
    echo "  ARM_CLIENT_ID             Azure Service Principal Client ID"
    echo "  ARM_CLIENT_SECRET         Azure Service Principal Client Secret"
    echo "  ARM_SUBSCRIPTION_ID       Azure Subscription ID"
    echo "  ARM_TENANT_ID             Azure Tenant ID"
    echo "  TF_VAR_function_app_key   Function App access key"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if required tools are installed
    local missing_tools=()
    
    if ! command -v terraform &> /dev/null; then
        missing_tools+=("terraform")
    fi
    
    if ! command -v az &> /dev/null; then
        missing_tools+=("azure-cli")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check Terraform version
    local tf_version=$(terraform version -json | jq -r '.terraform_version')
    log_info "Terraform version: $tf_version"
    
    # Check Azure CLI version
    local az_version=$(az version --query '"azure-cli"' -o tsv)
    log_info "Azure CLI version: $az_version"
    
    log_success "Prerequisites check passed"
}

check_environment_variables() {
    log_info "Checking environment variables..."
    
    local missing_vars=()
    
    if [ -z "$ARM_CLIENT_ID" ]; then
        missing_vars+=("ARM_CLIENT_ID")
    fi
    
    if [ -z "$ARM_CLIENT_SECRET" ]; then
        missing_vars+=("ARM_CLIENT_SECRET")
    fi
    
    if [ -z "$ARM_SUBSCRIPTION_ID" ]; then
        missing_vars+=("ARM_SUBSCRIPTION_ID")
    fi
    
    if [ -z "$ARM_TENANT_ID" ]; then
        missing_vars+=("ARM_TENANT_ID")
    fi
    
    if [ -z "$TF_VAR_function_app_key" ]; then
        missing_vars+=("TF_VAR_function_app_key")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_error "Please set the missing environment variables and try again."
        exit 1
    fi
    
    log_success "Environment variables check passed"
}

validate_openapi_spec() {
    log_info "Validating OpenAPI specification..."
    
    local spec_file="$PROJECT_ROOT/specs/pcpc-api-v1.yaml"
    
    if [ ! -f "$spec_file" ]; then
        log_error "OpenAPI specification not found: $spec_file"
        exit 1
    fi
    
    # Use swagger-codegen or openapi-generator if available
    if command -v swagger-codegen &> /dev/null; then
        swagger-codegen validate -i "$spec_file"
        log_success "OpenAPI specification validation passed"
    elif command -v openapi-generator &> /dev/null; then
        openapi-generator validate -i "$spec_file"
        log_success "OpenAPI specification validation passed"
    else
        log_warning "OpenAPI validation tools not found. Skipping validation."
        log_warning "Install swagger-codegen or openapi-generator for validation."
    fi
}

terraform_init() {
    local env_dir="$1"
    
    log_info "Initializing Terraform in $env_dir..."
    
    cd "$env_dir"
    
    terraform init -upgrade
    
    log_success "Terraform initialization completed"
}

terraform_plan() {
    local env_dir="$1"
    local plan_file="$env_dir/terraform.tfplan"
    
    log_info "Creating Terraform plan..."
    
    cd "$env_dir"
    
    terraform plan -detailed-exitcode -out="$plan_file"
    local plan_exit_code=$?
    
    case $plan_exit_code in
        0)
            log_info "No changes detected in Terraform plan"
            return 0
            ;;
        1)
            log_error "Terraform plan failed"
            exit 1
            ;;
        2)
            log_info "Changes detected in Terraform plan"
            return 2
            ;;
        *)
            log_error "Unexpected exit code from terraform plan: $plan_exit_code"
            exit 1
            ;;
    esac
}

terraform_apply() {
    local env_dir="$1"
    local plan_file="$env_dir/terraform.tfplan"
    
    log_info "Applying Terraform plan..."
    
    cd "$env_dir"
    
    if [ -f "$plan_file" ]; then
        terraform apply "$plan_file"
    else
        log_error "Plan file not found: $plan_file"
        exit 1
    fi
    
    log_success "Terraform apply completed"
}

test_api_endpoints() {
    local environment="$1"
    
    log_info "Testing API endpoints..."
    
    # Get API endpoints from Terraform output
    cd "$ENVIRONMENTS_DIR/$environment"
    
    local base_url=$(terraform output -raw api_endpoints | jq -r '.base_url' 2>/dev/null || echo "")
    
    if [ -z "$base_url" ]; then
        log_warning "Could not retrieve API base URL from Terraform output"
        log_warning "Skipping API endpoint tests"
        return
    fi
    
    log_info "Testing API base URL: $base_url"
    
    # Test health endpoint (if available)
    local health_url="$base_url/health"
    if curl -s -f "$health_url" > /dev/null 2>&1; then
        log_success "Health endpoint test passed: $health_url"
    else
        log_warning "Health endpoint test failed or not available: $health_url"
    fi
    
    # Test sets endpoint
    local sets_url="$base_url/sets?pageSize=1"
    if curl -s -f "$sets_url" > /dev/null 2>&1; then
        log_success "Sets endpoint test passed: $sets_url"
    else
        log_warning "Sets endpoint test failed: $sets_url"
    fi
    
    log_info "API endpoint testing completed"
}

cleanup() {
    log_info "Cleaning up temporary files..."
    
    # Remove plan files
    find "$ENVIRONMENTS_DIR" -name "terraform.tfplan" -delete 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# -----------------------------------------------------------------------------
# MAIN SCRIPT
# -----------------------------------------------------------------------------

main() {
    local environment="$1"
    local validate_only="$2"
    
    # Validate arguments
    if [ -z "$environment" ]; then
        log_error "Environment argument is required"
        print_usage
        exit 1
    fi
    
    if [ "$environment" != "dev" ] && [ "$environment" != "staging" ] && [ "$environment" != "prod" ]; then
        log_error "Invalid environment: $environment"
        log_error "Valid environments: dev, staging, prod"
        exit 1
    fi
    
    local env_dir="$ENVIRONMENTS_DIR/$environment"
    if [ ! -d "$env_dir" ]; then
        log_error "Environment directory not found: $env_dir"
        exit 1
    fi
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    log_info "🚀 Starting PCPC APIM deployment for environment: $environment"
    
    if [ "$validate_only" = "validate-only" ]; then
        log_info "Running in validation-only mode"
    fi
    
    # Run deployment steps
    check_prerequisites
    check_environment_variables
    validate_openapi_spec
    terraform_init "$env_dir"
    
    terraform_plan "$env_dir"
    local plan_result=$?
    
    if [ "$validate_only" = "validate-only" ]; then
        log_success "✅ Validation completed successfully!"
        if [ $plan_result -eq 2 ]; then
            log_info "Changes detected but not applied (validation-only mode)"
        fi
        exit 0
    fi
    
    if [ $plan_result -eq 2 ]; then
        terraform_apply "$env_dir"
        test_api_endpoints "$environment"
    fi
    
    log_success "✅ PCPC APIM deployment completed successfully!"
    log_info "Environment: $environment"
    log_info "Timestamp: $(date)"
}

# Run main function with all arguments
main "$@"
