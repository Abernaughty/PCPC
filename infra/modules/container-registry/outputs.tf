# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "id" {
  description = "Resource ID of the Container Registry. Used by callers to grant AcrPull/AcrPush role assignments and to feed `acr_id` into the container-app module."
  value       = azurerm_container_registry.this.id
}

output "name" {
  description = "Name of the Container Registry. Bare alphanumeric (no `.azurecr.io` suffix); use `login_server` for image references."
  value       = azurerm_container_registry.this.name
}

output "login_server" {
  description = "Login server hostname of the Container Registry (e.g. `pcpcacrdevgkoka4.azurecr.io`). Use this in the `registry.server` field on `azurerm_container_app` and as the prefix for image push/pull references."
  value       = azurerm_container_registry.this.login_server
}

output "resource_group_name" {
  description = "Resource group containing the Container Registry. Same as `var.resource_group_name`; re-exported for convenience when callers compose multiple modules."
  value       = azurerm_container_registry.this.resource_group_name
}
