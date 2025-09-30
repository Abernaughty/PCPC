output "id" {
  description = "The ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.id
}

output "workspace_id" {
  description = "The workspace ID of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.workspace_id
}

output "name" {
  description = "The name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.name
}

output "location" {
  description = "The location of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.location
}

output "resource_group_name" {
  description = "The resource group name of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.resource_group_name
}

output "primary_shared_key" {
  description = "The primary shared key for the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.primary_shared_key
  sensitive   = true
}

output "secondary_shared_key" {
  description = "The secondary shared key for the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.secondary_shared_key
  sensitive   = true
}

output "retention_in_days" {
  description = "The retention period for the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.retention_in_days
}

output "sku" {
  description = "The SKU of the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.sku
}

output "daily_quota_gb" {
  description = "The daily quota for the Log Analytics workspace"
  value       = azurerm_log_analytics_workspace.this.daily_quota_gb
}

output "data_collection_rule_ids" {
  description = "The IDs of the data collection rules"
  value       = azurerm_monitor_data_collection_rule.this[*].id
}

output "saved_search_ids" {
  description = "The IDs of the saved searches"
  value       = azurerm_log_analytics_saved_search.this[*].id
}
