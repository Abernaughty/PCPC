# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "id" {
  description = "The ID of the Static Web App"
  value       = azurerm_static_web_app.this.id
}

output "name" {
  description = "The name of the Static Web App"
  value       = azurerm_static_web_app.this.name
}

output "default_host_name" {
  description = "The default hostname of the Static Web App"
  value       = azurerm_static_web_app.this.default_host_name
}

output "api_key" {
  description = "The API key for the Static Web App"
  value       = azurerm_static_web_app.this.api_key
  sensitive   = true
}

output "url" {
  description = "The URL of the Static Web App"
  value       = "https://${azurerm_static_web_app.this.default_host_name}"
}

output "resource_group_name" {
  description = "The resource group name"
  value       = var.resource_group_name
}

output "location" {
  description = "The Azure region"
  value       = var.location
}

output "sku_tier" {
  description = "The SKU tier of the Static Web App"
  value       = azurerm_static_web_app.this.sku_tier
}
