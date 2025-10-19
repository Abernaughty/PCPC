# -----------------------------------------------------------------------------
# STAGING ENVIRONMENT CONFIGURATION
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.13.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.47.0, < 5.0.0"
    }
  }

  # Backend configuration for remote state
  backend "azurerm" {
    resource_group_name  = "pcpc-terraform-state-rg"
    storage_account_name = "pcpctfstatedacc29c2"
    container_name       = "tfstate"
    key                  = "apim/staging/terraform.tfstate"
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
# LOCALS
# -----------------------------------------------------------------------------

locals {
  base_cors_origins = [
    "https://pcpc-staging.maber.io"
  ]

  configured_cors_origins = length(var.cors_origins) > 0 ? var.cors_origins : local.base_cors_origins
  effective_cors_origins  = distinct(concat(local.configured_cors_origins, var.additional_cors_origins))

  effective_rate_limit_calls  = coalesce(var.rate_limit_calls, var.override_rate_limit_calls, 300)
  effective_rate_limit_period = coalesce(var.rate_limit_period, 60)

  effective_cache_duration_sets = coalesce(
    var.cache_duration_sets,
    lookup(var.override_cache_durations, "sets", null),
    900
  )

  effective_cache_duration_cards = coalesce(
    var.cache_duration_cards,
    lookup(var.override_cache_durations, "cards", null),
    1200
  )

  effective_cache_duration_card_info = coalesce(
    var.cache_duration_card_info,
    lookup(var.override_cache_durations, "card_info", null),
    1800
  )

  effective_backend_timeout = coalesce(var.backend_timeout, 30)
  effective_api_version     = var.api_version != "" ? var.api_version : "v1"

  detailed_logging_enabled = var.enable_debug_features
  log_retention_days       = 14
}

# -----------------------------------------------------------------------------
# MODULE CONFIGURATION
# -----------------------------------------------------------------------------

module "pcpc_apim" {
  source = "../../terraform"

  # Required variables
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  function_app_name   = var.function_app_name
  environment         = var.environment
  function_app_key    = var.function_app_key

  # CORS configuration
  cors_origins = local.effective_cors_origins

  # Rate limiting configuration
  rate_limit_calls  = local.effective_rate_limit_calls
  rate_limit_period = local.effective_rate_limit_period

  # Caching configuration (medium durations for staging)
  cache_duration_sets      = local.effective_cache_duration_sets
  cache_duration_cards     = local.effective_cache_duration_cards
  cache_duration_card_info = local.effective_cache_duration_card_info

  # Backend configuration
  backend_timeout = local.effective_backend_timeout

  # Feature flags
  enable_caching              = true
  enable_detailed_logging     = local.detailed_logging_enabled
  enable_application_insights = var.enable_application_insights
  application_insights_name   = var.application_insights_name

  # API version
  api_version = local.effective_api_version

  # Products configuration for staging
  products = {
    starter = {
      display_name          = "Starter (Staging)"
      description           = "Starter product for staging validation"
      published             = true
      approval_required     = false
      subscription_required = false
      subscriptions_limit   = 3
    }
    premium = {
      display_name          = "Premium (Staging)"
      description           = "Premium product for staging validation"
      published             = true
      approval_required     = true
      subscription_required = false
      subscriptions_limit   = 5
    }
  }

  # Monitoring configuration
  log_retention_days = local.log_retention_days

  # Additional tags
  additional_tags = {
    Environment = "Staging"
    Purpose     = "Pre-Production Validation"
    Owner       = "PCPC Engineering Team"
    CostCenter  = "Staging"
  }
}
