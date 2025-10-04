# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

output "id" {
  description = "The ID of the API Management service"
  value       = azurerm_api_management.this.id
}

output "name" {
  description = "The name of the API Management service"
  value       = azurerm_api_management.this.name
}

output "gateway_url" {
  description = "The URL of the API Management gateway"
  value       = azurerm_api_management.this.gateway_url
}

output "management_api_url" {
  description = "The URL of the API Management API"
  value       = azurerm_api_management.this.management_api_url
}

output "portal_url" {
  description = "The URL of the API Management portal"
  value       = azurerm_api_management.this.portal_url
}

output "developer_portal_url" {
  description = "The URL of the API Management developer portal"
  value       = azurerm_api_management.this.developer_portal_url
}

output "scm_url" {
  description = "The URL of the API Management SCM endpoint"
  value       = azurerm_api_management.this.scm_url
}

output "public_ip_addresses" {
  description = "The public IP addresses of the API Management service"
  value       = azurerm_api_management.this.public_ip_addresses
}

output "identity_principal_id" {
  description = "The Principal ID of the System Assigned Managed Identity"
  value       = length(azurerm_api_management.this.identity) > 0 ? azurerm_api_management.this.identity[0].principal_id : null
}

output "identity_tenant_id" {
  description = "The Tenant ID of the System Assigned Managed Identity"
  value       = length(azurerm_api_management.this.identity) > 0 ? azurerm_api_management.this.identity[0].tenant_id : null
}

output "resource_group_name" {
  description = "The resource group name"
  value       = var.resource_group_name
}

output "location" {
  description = "The Azure region"
  value       = var.location
}

output "sku_name" {
  description = "The SKU of the API Management service"
  value       = azurerm_api_management.this.sku_name
}
