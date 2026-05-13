# -----------------------------------------------------------------------------
# Provider version pin for the container-registry module.
#
# Matches the pin used across sibling modules in infra/modules/.
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.47.0, < 5.0.0"
    }
  }
}
