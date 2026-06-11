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
  subscription_id = var.subscription_id
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

  # Convert glob-style hostname patterns into a single regex used by the
  # CORS policy. See apim/policies/templates/global-policy.xml.tpl and
  # ADR-013 for the design.
  #
  # Pipeline:
  #   1. Escape literal `.` so regex sees an escaped dot
  #   2. Convert glob `*` into [a-z0-9-]+ (one-or-more hostname-safe chars)
  #   3. Join with `|` and anchor with ^https://(...)$
  #
  # Example: ["pcpc.maber.io", "pcpc-git-*-abernaughtys-projects.vercel.app"]
  # becomes "^https://(pcpc\.maber\.io|pcpc-git-[a-z0-9-]+-abernaughtys-projects\.vercel\.app)$"
  cors_patterns_dot_escaped = [
    for p in var.cors_origin_patterns :
    replace(p, ".", "\\.")
  ]
  cors_patterns_with_classes = [
    for p in local.cors_patterns_dot_escaped :
    replace(p, "*", "[a-z0-9-]+")
  ]
  cors_origin_regex = "^https://(${join("|", local.cors_patterns_with_classes)})$"

  # Policy template variables
  policy_vars = {
    cors_origin_regex   = local.cors_origin_regex
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
        "groupByExpansion"
      ] : []
    }
    get_cards_by_set = {
      cache_enabled  = var.enable_caching
      cache_duration = var.cache_duration_cards
      vary_by_query_parameters = var.enable_caching ? [
        "page",
        "pageSize"
      ] : []
    }
    get_card_info = {
      cache_enabled            = var.enable_caching
      cache_duration           = var.cache_duration_card_info
      vary_by_query_parameters = []
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
