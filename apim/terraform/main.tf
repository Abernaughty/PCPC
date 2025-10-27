# -----------------------------------------------------------------------------
# TERRAFORM CONFIGURATION
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.13.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.47.0, < 5.0.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
  }
}

# -----------------------------------------------------------------------------
# PROVIDER CONFIGURATION
# -----------------------------------------------------------------------------

provider "azurerm" {
  features {}
  subscription_id = "555b4cfa-ad2e-4c71-9433-620a59cf7616"
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

  operation_policy_configs = {
    get_sets = {
      cache_enabled  = var.enable_caching
      cache_duration = var.cache_duration_sets
      vary_by_query_parameters = var.enable_caching ? [
        "language",
        "page",
        "pageSize",
        "all",
        "forceRefresh",
        "groupByExpansion"
      ] : []
    }
    get_cards_by_set = {
      cache_enabled  = var.enable_caching
      cache_duration = var.cache_duration_cards
      vary_by_query_parameters = var.enable_caching ? [
        "page",
        "pageSize",
        "forceRefresh"
      ] : []
    }
    get_card_info = {
      cache_enabled  = var.enable_caching
      cache_duration = var.cache_duration_card_info
      vary_by_query_parameters = var.enable_caching ? [
        "forceRefresh"
      ] : []
    }
  }

  rendered_operation_policies = {
    for policy_name, cfg in local.operation_policy_configs :
    policy_name => templatefile(
      "${path.module}/../policies/templates/azure-functions-backend.xml.tpl",
      merge(local.policy_vars, cfg)
    )
  }
}
