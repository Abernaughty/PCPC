# -----------------------------------------------------------------------------
# TERRAFORM CONFIGURATION
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.13.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.47.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }

  backend "azurerm" {}
}

# -----------------------------------------------------------------------------
# PROVIDER CONFIGURATION
# -----------------------------------------------------------------------------

provider "azurerm" {
  features {}
}

# -----------------------------------------------------------------------------
# DATA SOURCES
# -----------------------------------------------------------------------------

# Get existing API Management instance
data "azurerm_api_management" "existing" {
  name                = var.api_management_name
  resource_group_name = var.resource_group_name
}

# Get existing Function App for backend configuration
data "azurerm_windows_function_app" "backend" {
  name                = var.function_app_name
  resource_group_name = var.resource_group_name

}

# -----------------------------------------------------------------------------
# LOCAL VALUES
# -----------------------------------------------------------------------------

locals {
  # Common tags
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Component   = "APIM-Configuration"
      Project     = "PCPC"
    },
    var.additional_tags
  )

  # Function App URL
  function_app_url = "https://${data.azurerm_windows_function_app.backend.default_hostname}/api"

  # Policy template variables
  policy_vars = {
    cors_origins        = var.cors_origins
    rate_limit_calls    = var.rate_limit_calls
    rate_limit_period   = var.rate_limit_period
    cache_duration_sets = var.cache_duration_sets
    function_app_url    = local.function_app_url
    function_app_key    = var.function_app_key
    environment         = var.environment
    backend_timeout     = var.backend_timeout
  }

  rendered_global_policy = templatefile(
    "${path.module}/../policies/templates/global-policy.xml.tpl",
    local.policy_vars
  )

  rendered_cache_policy = templatefile(
    "${path.module}/../policies/templates/cache-sets-response.xml.tpl",
    local.policy_vars
  )

  rendered_backend_policy = templatefile(
    "${path.module}/../policies/templates/azure-functions-backend.xml.tpl",
    local.policy_vars
  )
}

# -----------------------------------------------------------------------------
# SAVE RENDERED POLICIES
# -----------------------------------------------------------------------------

# Save rendered policies to generated directory for reference
resource "local_file" "rendered_global_policy" {
  content  = local.rendered_global_policy
  filename = "${path.module}/../policies/generated/global-policy-${var.environment}.xml"
}

resource "local_file" "rendered_cache_policy" {
  content  = local.rendered_cache_policy
  filename = "${path.module}/../policies/generated/cache-sets-policy-${var.environment}.xml"
}

resource "local_file" "rendered_backend_policy" {
  content  = local.rendered_backend_policy
  filename = "${path.module}/../policies/generated/backend-policy-${var.environment}.xml"
}
