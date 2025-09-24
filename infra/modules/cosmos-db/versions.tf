# -----------------------------------------------------------------------------
# TERRAFORM VERSION REQUIREMENTS
# Ensures consistent behavior across different environments
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.9.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40.0"
    }

    # Random provider for generating unique names if needed
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6.0"
    }
  }
}
