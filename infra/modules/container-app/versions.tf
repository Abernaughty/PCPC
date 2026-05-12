# -----------------------------------------------------------------------------
# Provider version pin for the container-app module.
#
# Pinned to the same range as the rest of the modules in infra/modules/.
# azurerm 4.47.0+ supports azurerm_container_app and
# azurerm_container_app_environment with the ingress.cors block we use.
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
