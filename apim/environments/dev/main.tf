# -----------------------------------------------------------------------------
# DEVELOPMENT ENVIRONMENT CONFIGURATION
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.13.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
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
  environment         = "dev"
  function_app_key    = var.function_app_key

  # CORS configuration for development
  cors_origins = [
    "https://pokedata.maber.io",
    "http://localhost:3000",
    "http://localhost:52783",
    "https://calm-mud-07a7f7a10.6.azurestaticapps.net"
  ]

  # Rate limiting configuration
  rate_limit_calls  = 300
  rate_limit_period = 60

  # Caching configuration (shorter durations for development)
  cache_duration_sets      = 300 # 5 minutes
  cache_duration_cards     = 600 # 10 minutes
  cache_duration_card_info = 900 # 15 minutes

  # Backend configuration
  backend_timeout = 30

  # Feature flags
  enable_caching              = true
  enable_detailed_logging     = true
  enable_application_insights = var.enable_application_insights
  application_insights_name   = var.application_insights_name

  # API version
  api_version = "v1"

  # Products configuration for development
  products = {
    starter = {
      display_name          = "Starter (Dev)"
      description           = "Starter product for development testing"
      published             = true
      approval_required     = false
      subscription_required = true
      subscriptions_limit   = 5 # Higher limit for dev testing
    }
    premium = {
      display_name          = "Premium (Dev)"
      description           = "Premium product for development testing"
      published             = true
      approval_required     = false # No approval required in dev
      subscription_required = true
      subscriptions_limit   = 10
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
