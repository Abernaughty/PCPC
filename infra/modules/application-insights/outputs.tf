output "id" {
  description = "The ID of the Application Insights instance"
  value       = azurerm_application_insights.this.id
}

output "name" {
  description = "The name of the Application Insights instance"
  value       = azurerm_application_insights.this.name
}

output "location" {
  description = "The location of the Application Insights instance"
  value       = azurerm_application_insights.this.location
}

output "resource_group_name" {
  description = "The resource group name of the Application Insights instance"
  value       = azurerm_application_insights.this.resource_group_name
}

output "instrumentation_key" {
  description = "The instrumentation key of the Application Insights instance"
  value       = azurerm_application_insights.this.instrumentation_key
  sensitive   = true
}

output "connection_string" {
  description = "The connection string of the Application Insights instance"
  value       = azurerm_application_insights.this.connection_string
  sensitive   = true
}

output "app_id" {
  description = "The App ID of the Application Insights instance"
  value       = azurerm_application_insights.this.app_id
}

output "application_type" {
  description = "The application type of the Application Insights instance"
  value       = azurerm_application_insights.this.application_type
}

output "workspace_id" {
  description = "The workspace ID of the associated Log Analytics workspace"
  value       = azurerm_application_insights.this.workspace_id
}

output "retention_in_days" {
  description = "The retention period in days for the Application Insights instance"
  value       = azurerm_application_insights.this.retention_in_days
}

output "daily_data_cap_in_gb" {
  description = "The daily data cap in GB for the Application Insights instance"
  value       = azurerm_application_insights.this.daily_data_cap_in_gb
}

output "sampling_percentage" {
  description = "The sampling percentage for the Application Insights instance"
  value       = azurerm_application_insights.this.sampling_percentage
}

output "action_group_ids" {
  description = "The IDs of the created action groups"
  value       = azurerm_monitor_action_group.this[*].id
}

output "metric_alert_ids" {
  description = "The IDs of the created metric alerts"
  value       = azurerm_monitor_metric_alert.this[*].id
}
