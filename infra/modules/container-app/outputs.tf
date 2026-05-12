# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "id" {
  description = "Resource ID of the Container App."
  value       = azurerm_container_app.this.id
}

output "name" {
  description = "Name of the Container App."
  value       = azurerm_container_app.this.name
}

output "ingress_fqdn" {
  description = "Public FQDN exposed by the Container App's ingress. The frontend's PUBLIC_ACA_API_BASE_URL Vercel env var should point at https://<this>."
  value       = azurerm_container_app.this.latest_revision_fqdn
}

output "environment_id" {
  description = "Resource ID of the Container Apps Environment."
  value       = azurerm_container_app_environment.this.id
}

output "principal_id" {
  description = "Principal ID of the user-assigned managed identity (used for ACR pull). Exposed so the caller can grant additional roles (e.g. Cosmos data reader) if it later moves off connection-string auth."
  value       = azurerm_user_assigned_identity.this.principal_id
}

output "identity_id" {
  description = "Resource ID of the user-assigned managed identity."
  value       = azurerm_user_assigned_identity.this.id
}

output "latest_revision_name" {
  description = "Name of the most recently deployed revision. Useful for pipeline post-deploy verification (poll until Active)."
  value       = azurerm_container_app.this.latest_revision_name
}
