# -----------------------------------------------------------------------------
# OUTPUTS
# -----------------------------------------------------------------------------

# Function App details
output "id" {
  description = "The ID of the Function App"
  value       = var.os_type == "Windows" ? azurerm_windows_function_app.this[0].id : azurerm_linux_function_app.this[0].id
}

output "name" {
  description = "The name of the Function App"
  value       = var.os_type == "Windows" ? azurerm_windows_function_app.this[0].name : azurerm_linux_function_app.this[0].name
}

output "default_hostname" {
  description = "The default hostname of the Function App"
  value       = var.os_type == "Windows" ? azurerm_windows_function_app.this[0].default_hostname : azurerm_linux_function_app.this[0].default_hostname
}

output "kind" {
  description = "The kind of the Function App"
  value       = var.os_type == "Windows" ? azurerm_windows_function_app.this[0].kind : azurerm_linux_function_app.this[0].kind
}

output "outbound_ip_addresses" {
  description = "A list of outbound IP addresses"
  value       = var.os_type == "Windows" ? split(",", azurerm_windows_function_app.this[0].outbound_ip_addresses) : split(",", azurerm_linux_function_app.this[0].outbound_ip_addresses)
}

output "possible_outbound_ip_addresses" {
  description = "A list of possible outbound IP addresses"
  value       = var.os_type == "Windows" ? split(",", azurerm_windows_function_app.this[0].possible_outbound_ip_addresses) : split(",", azurerm_linux_function_app.this[0].possible_outbound_ip_addresses)
}

# Identity outputs
output "identity_principal_id" {
  description = "The Principal ID of the System Assigned Managed Identity"
  value = var.identity_type != null ? (
    var.os_type == "Windows" ?
    (length(azurerm_windows_function_app.this[0].identity) > 0 ? azurerm_windows_function_app.this[0].identity[0].principal_id : null) :
    (length(azurerm_linux_function_app.this[0].identity) > 0 ? azurerm_linux_function_app.this[0].identity[0].principal_id : null)
  ) : null
}

output "identity_tenant_id" {
  description = "The Tenant ID of the System Assigned Managed Identity"
  value = var.identity_type != null ? (
    var.os_type == "Windows" ?
    (length(azurerm_windows_function_app.this[0].identity) > 0 ? azurerm_windows_function_app.this[0].identity[0].tenant_id : null) :
    (length(azurerm_linux_function_app.this[0].identity) > 0 ? azurerm_linux_function_app.this[0].identity[0].tenant_id : null)
  ) : null
}

# Service Plan outputs
output "service_plan_id" {
  description = "The ID of the App Service Plan"
  value       = local.create_service_plan ? azurerm_service_plan.this[0].id : var.service_plan_id
}

output "service_plan_name" {
  description = "The name of the App Service Plan"
  value       = local.create_service_plan ? azurerm_service_plan.this[0].name : null
}

# Storage Account outputs
output "storage_account_name" {
  description = "The name of the Storage Account"
  value       = var.storage_account_name != "" ? var.storage_account_name : azurerm_storage_account.this[0].name
}

output "storage_account_primary_key" {
  description = "The primary access key of the Storage Account"
  value       = var.storage_account_name == "" ? azurerm_storage_account.this[0].primary_access_key : null
  sensitive   = true
}

# Application Insights outputs
output "application_insights_id" {
  description = "The ID of the Application Insights instance"
  value       = var.application_insights_enabled && var.application_insights_id == null ? azurerm_application_insights.this[0].id : var.application_insights_id
}

output "application_insights_instrumentation_key" {
  description = "The instrumentation key of the Application Insights instance"
  value       = var.application_insights_enabled && var.application_insights_id == null ? azurerm_application_insights.this[0].instrumentation_key : var.application_insights_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "The connection string of the Application Insights instance"
  value       = var.application_insights_enabled && var.application_insights_id == null ? azurerm_application_insights.this[0].connection_string : var.application_insights_connection_string
  sensitive   = true
}

# Configuration outputs
output "resource_group_name" {
  description = "The resource group name"
  value       = var.resource_group_name
}

output "location" {
  description = "The Azure region"
  value       = var.location
}

output "environment" {
  description = "The environment name"
  value       = var.environment
}

# Function URL (for HTTP triggered functions)
output "function_app_url" {
  description = "The URL of the Function App"
  value       = "https://${var.os_type == "Windows" ? azurerm_windows_function_app.this[0].default_hostname : azurerm_linux_function_app.this[0].default_hostname}"
}

# Deployment slot support (for future enhancement)
output "deployment_slot_support" {
  description = "Whether deployment slots are supported (Premium plans only)"
  value       = contains(["EP1", "EP2", "EP3", "P1v2", "P2v2", "P3v2"], var.sku_name)
}
