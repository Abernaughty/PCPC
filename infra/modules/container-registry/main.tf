# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "container-registry"
    },
    var.tags
  )
}

# -----------------------------------------------------------------------------
# CONTAINER REGISTRY
#
# Provisioned by PCPC's Terraform so the ADO service principal applying this
# module (which has rights on this RG) can also create AcrPull / AcrPush role
# assignments against it. This eliminates the cross-RG RBAC problem that
# arose when consuming an externally-owned shared registry. See ADR-009's
# "ACR ownership" subsection for the full rationale.
#
# admin_enabled stays off — managed-identity auth (AcrPull for the Container
# App, AcrPush for the ADO SP) replaces the admin user's static credentials.
# -----------------------------------------------------------------------------

resource "azurerm_container_registry" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location

  sku                           = var.sku
  admin_enabled                 = var.admin_enabled
  public_network_access_enabled = var.public_network_access_enabled

  tags = local.common_tags
}
