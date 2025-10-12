# -----------------------------------------------------------------------------
# OUTPUTS
# Terraform outputs for the dev environment
# These outputs are used by the CI/CD pipeline for post-deployment validation
# -----------------------------------------------------------------------------

# Resource Group Outputs
output "resource_group_name" {
  description = "Name of the resource group"
  value       = module.resource_group.name
}

output "resource_group_id" {
  description = "ID of the resource group"
  value       = module.resource_group.id
}

output "resource_group_location" {
  description = "Location of the resource group"
  value       = module.resource_group.location
}

# Key Vault Outputs
output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = module.key_vault.name
}

output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = module.key_vault.id
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = module.key_vault.vault_uri
}

# Storage Account Outputs
output "storage_account_name" {
  description = "Name of the storage account"
  value       = module.storage_account.storage_account_name
}

output "storage_account_id" {
  description = "ID of the storage account"
  value       = module.storage_account.storage_account_id
}

output "storage_account_primary_blob_endpoint" {
  description = "Primary blob endpoint of the storage account"
  value       = module.storage_account.primary_blob_endpoint
}

# Cosmos DB Outputs
output "cosmos_db_endpoint" {
  description = "Cosmos DB endpoint"
  value       = module.cosmos_db.endpoint
}

output "cosmos_db_account_name" {
  description = "Cosmos DB account name"
  value       = module.cosmos_db.name
}

output "cosmos_db_id" {
  description = "Cosmos DB account ID"
  value       = module.cosmos_db.id
}

output "cosmos_db_primary_key" {
  description = "Cosmos DB primary key"
  value       = module.cosmos_db.primary_key
  sensitive   = true
}

output "cosmos_db_connection_string" {
  description = "Cosmos DB connection string"
  value       = module.cosmos_db.primary_sql_connection_string
  sensitive   = true
}

# Function App Outputs
output "function_app_name" {
  description = "Name of the Function App"
  value       = module.function_app.name
}

output "function_app_id" {
  description = "ID of the Function App"
  value       = module.function_app.id
}

output "function_app_default_hostname" {
  description = "Default hostname of the Function App"
  value       = module.function_app.default_hostname
}

output "function_app_url" {
  description = "URL of the Function App"
  value       = module.function_app.function_app_url
}

output "function_app_identity_principal_id" {
  description = "Principal ID of the Function App managed identity"
  value       = module.function_app.identity_principal_id
}

# Static Web App Outputs
output "static_web_app_name" {
  description = "Name of the Static Web App"
  value       = module.static_web_app.name
}

output "static_web_app_id" {
  description = "ID of the Static Web App"
  value       = module.static_web_app.id
}

output "static_web_app_default_hostname" {
  description = "Default hostname of the Static Web App"
  value       = module.static_web_app.default_host_name
}

output "static_web_app_url" {
  description = "URL of the Static Web App"
  value       = module.static_web_app.url
}

output "static_web_app_api_key" {
  description = "API key for the Static Web App"
  value       = module.static_web_app.api_key
  sensitive   = true
}

# Log Analytics Outputs
output "log_analytics_workspace_id" {
  description = "ID of the Log Analytics workspace"
  value       = module.log_analytics.id
}

output "log_analytics_workspace_name" {
  description = "Name of the Log Analytics workspace"
  value       = module.log_analytics.name
}

output "log_analytics_workspace_workspace_id" {
  description = "Workspace ID of the Log Analytics workspace"
  value       = module.log_analytics.workspace_id
}

# Application Insights Outputs
output "application_insights_id" {
  description = "ID of the Application Insights instance"
  value       = module.application_insights.id
}

output "application_insights_name" {
  description = "Name of the Application Insights instance"
  value       = module.application_insights.name
}

output "application_insights_instrumentation_key" {
  description = "Instrumentation key of the Application Insights instance"
  value       = module.application_insights.instrumentation_key
  sensitive   = true
}

output "application_insights_connection_string" {
  description = "Connection string of the Application Insights instance"
  value       = module.application_insights.connection_string
  sensitive   = true
}

output "application_insights_app_id" {
  description = "App ID of the Application Insights instance"
  value       = module.application_insights.app_id
}

# API Management Outputs (conditional)
output "api_management_name" {
  description = "Name of the API Management instance"
  value       = var.enable_api_management ? module.api_management[0].name : null
}

output "api_management_id" {
  description = "ID of the API Management instance"
  value       = var.enable_api_management ? module.api_management[0].id : null
}

output "api_management_gateway_url" {
  description = "Gateway URL of the API Management instance"
  value       = var.enable_api_management ? module.api_management[0].gateway_url : null
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "location" {
  description = "Azure region"
  value       = var.location
}

output "project_name" {
  description = "Project name"
  value       = var.project_name
}

# Debug Output - App Settings Keys
output "debug_function_app_settings_keys" {
  description = "DEBUG: List of app setting keys being passed to Function App (for troubleshooting)"
  sensitive   = true
  value = keys(merge(
    var.function_app_secrets,
    var.function_app_config,
    {
      "COSMOS_DB_CONNECTION_STRING"           = "(set)"
      "COSMOS_DB_ENDPOINT"                    = "(set)"
      "COSMOS_DB_KEY"                         = "(set)"
      "WEBSITE_NODE_DEFAULT_VERSION"          = "(set)"
      "FUNCTIONS_WORKER_RUNTIME"              = "(set)"
      "FUNCTIONS_EXTENSION_VERSION"           = "(set)"
      "APPINSIGHTS_INSTRUMENTATIONKEY"        = "(set)"
      "APPLICATIONINSIGHTS_CONNECTION_STRING" = "(set)"
    }
  ))
}

output "debug_secrets_keys_received" {
  description = "DEBUG: Keys from function_app_secrets variable (should have 4 keys with hyphens)"
  sensitive   = true
  value       = keys(var.function_app_secrets)
}

output "debug_config_keys_received" {
  description = "DEBUG: Keys from function_app_config variable"
  value       = keys(var.function_app_config)
}

# Deployment Summary
output "deployment_summary" {
  description = "Summary of deployed resources"
  value = {
    environment          = var.environment
    resource_group       = module.resource_group.name
    location             = var.location
    function_app         = module.function_app.name
    static_web_app       = module.static_web_app.name
    cosmos_db            = module.cosmos_db.name
    storage_account      = module.storage_account.storage_account_name
    log_analytics        = module.log_analytics.name
    application_insights = module.application_insights.name
    api_management       = var.enable_api_management ? module.api_management[0].name : "Not deployed"
  }
}
