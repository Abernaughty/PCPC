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
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id
}

# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  # Phase 1B (per ADR-013): staging accepts only the production frontend
  # hostname. No Vercel preview support — staging exists for pipeline-only
  # validation per ADR-011, not for browser-level testing.
  base_cors_origin_patterns = [
    "pcpc.maber.io",
  ]

  configured_cors_origin_patterns = length(var.cors_origin_patterns) > 0 ? var.cors_origin_patterns : local.base_cors_origin_patterns
  effective_cors_origin_patterns  = distinct(concat(local.configured_cors_origin_patterns, var.additional_cors_origin_patterns))

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

# -----------------------------------------------------------------------------
# REMOVED BLOCK (Terraform 1.7+) — Codex P1 fix on PR #138
# -----------------------------------------------------------------------------
# See apim/environments/dev/main.tf for the full rationale. This is a no-op
# in staging (the resource was never in state) but kept for symmetry so the
# state migration is uniform across envs. Can be deleted in a follow-up
# cleanup PR after every env has applied PR #138 once.
removed {
  from = module.pcpc_apim.azurerm_api_management_api_operation.get_health
  lifecycle {
    destroy = false
  }
}

module "pcpc_apim" {
  source = "../../terraform"

  # Required variables
  subscription_id     = var.subscription_id
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  function_app_name   = var.function_app_name
  environment         = var.environment
  function_app_key    = var.function_app_key

  # CORS configuration (regex-based; see ADR-013)
  cors_origin_patterns = local.effective_cors_origin_patterns

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
      subscriptions_limit   = 0
    }
    premium = {
      display_name          = "Premium (Staging)"
      description           = "Premium product for staging validation"
      published             = true
      approval_required     = false
      subscription_required = true
      subscriptions_limit   = 5
    }
    unlimited = {
      display_name          = "Unlimited (Staging)"
      description           = "Unlimited product for trusted staging consumers"
      published             = true
      approval_required     = false
      subscription_required = true
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
