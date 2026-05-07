# -----------------------------------------------------------------------------
# DEVELOPMENT ENVIRONMENT CONFIGURATION
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
    key                  = "apim/dev/terraform.tfstate"
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
  # Phase 1B (per ADR-013): dev allows the production frontend hostname
  # plus glob-style patterns matching Vercel's per-PR preview URLs and
  # commit-level URLs. The cors_origin_regex local in apim/terraform/main.tf
  # converts these to a regex applied by the policy template.
  #
  # Patterns matched here (after https:// prefix is automatically added):
  #   - pcpc.maber.io                                  — production custom domain
  #   - pcpc-git-{branch}-abernaughtys-projects.vercel.app — Vercel per-PR previews
  #   - pcpc-{commit-hash}-abernaughtys-projects.vercel.app — Vercel commit-level URLs
  base_cors_origin_patterns = [
    "pcpc.maber.io",
    "pcpc-git-*-abernaughtys-projects.vercel.app",
    "pcpc-*-abernaughtys-projects.vercel.app",
  ]

  configured_cors_origin_patterns = length(var.cors_origin_patterns) > 0 ? var.cors_origin_patterns : local.base_cors_origin_patterns
  effective_cors_origin_patterns  = distinct(concat(local.configured_cors_origin_patterns, var.additional_cors_origin_patterns))

  effective_rate_limit_calls  = coalesce(var.rate_limit_calls, var.override_rate_limit_calls, 300)
  effective_rate_limit_period = coalesce(var.rate_limit_period, 60)

  effective_cache_duration_sets = coalesce(
    var.cache_duration_sets,
    lookup(var.override_cache_durations, "sets", null),
    300
  )

  effective_cache_duration_cards = coalesce(
    var.cache_duration_cards,
    lookup(var.override_cache_durations, "cards", null),
    600
  )

  effective_cache_duration_card_info = coalesce(
    var.cache_duration_card_info,
    lookup(var.override_cache_durations, "card_info", null),
    900
  )

  effective_backend_timeout = coalesce(var.backend_timeout, 30)
  effective_api_version     = var.api_version != "" ? var.api_version : "v1"

  detailed_logging_enabled = var.enable_debug_features
}

# -----------------------------------------------------------------------------
# MODULE CONFIGURATION
# -----------------------------------------------------------------------------

# -----------------------------------------------------------------------------
# IMPORT BLOCK (Terraform 1.5+)
# -----------------------------------------------------------------------------
# Adopt the get-health operation that the OpenAPI spec import (in
# azurerm_api_management_api.pcpc_api) created in Azure on the first apply
# that included /health in apim/specs/pcpc-api-v1.yaml. Without this block,
# Terraform tries to create get-health from scratch and fails with
# "resource already exists" because Azure already has it from the spec
# import. Import blocks must live in the root module (this file), not the
# child module under apim/terraform/.
import {
  to = module.pcpc_apim.azurerm_api_management_api_operation.get_health
  id = "/subscriptions/555b4cfa-ad2e-4c71-9433-620a59cf7616/resourceGroups/${var.resource_group_name}/providers/Microsoft.ApiManagement/service/${var.api_management_name}/apis/pcpc-api-${var.environment}/operations/get-health"
}

module "pcpc_apim" {
  source = "../../terraform"

  # Required variables
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  function_app_name   = var.function_app_name
  environment         = var.environment
  function_app_key    = var.function_app_key

  # CORS configuration for development (regex-based; see ADR-013)
  cors_origin_patterns = local.effective_cors_origin_patterns

  # Rate limiting configuration
  rate_limit_calls  = local.effective_rate_limit_calls
  rate_limit_period = local.effective_rate_limit_period

  # Caching configuration (shorter durations for development)
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

  # Products configuration for development
  products = {
    starter = {
      display_name          = "Starter (Dev)"
      description           = "Starter product for development testing"
      published             = true
      approval_required     = false
      subscription_required = false
      subscriptions_limit   = 0
    }
    premium = {
      display_name          = "Premium (Dev)"
      description           = "Premium product for development testing"
      published             = true
      approval_required     = false # No approval required in dev
      subscription_required = true
      subscriptions_limit   = 10
    }
    unlimited = {
      display_name          = "Unlimited (Dev)"
      description           = "Unlimited product for trusted development consumers"
      published             = true
      approval_required     = false
      subscription_required = true
    }
  }

  # Monitoring configuration
  log_retention_days = 7 # Shorter retention for dev

  # Additional tags
  additional_tags = {
    Environment = "Development"
    Purpose     = "API Development and Testing"
    Owner       = "PCPC Development Team"
    CostCenter  = "Development"
  }
}
