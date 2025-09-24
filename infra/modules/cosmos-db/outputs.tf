# -----------------------------------------------------------------------------
# OUTPUTS
# Values exposed to other modules and root configurations
# -----------------------------------------------------------------------------

# Basic information
output "id" {
  description = "The ID of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.id
}

output "name" {
  description = "The name of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.name
}

output "endpoint" {
  description = "The endpoint URI of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.endpoint
}

# Connection strings (marked as sensitive)
output "primary_key" {
  description = "The primary access key for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.primary_key
  sensitive   = true
}

output "secondary_key" {
  description = "The secondary access key for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.secondary_key
  sensitive   = true
}

output "primary_readonly_key" {
  description = "The primary read-only access key"
  value       = azurerm_cosmosdb_account.this.primary_readonly_key
  sensitive   = true
}

# Note: connection_strings attribute removed in Azure Provider 4.x
# Use primary_key and endpoint to construct connection strings

# Primary SQL connection string can be constructed from endpoint and key
output "primary_sql_connection_string" {
  description = "Constructed SQL connection string"
  value       = "AccountEndpoint=${azurerm_cosmosdb_account.this.endpoint};AccountKey=${azurerm_cosmosdb_account.this.primary_key};"
  sensitive   = true
}

# Read endpoints for applications
output "read_endpoints" {
  description = "List of read endpoints for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.read_endpoints
}

output "write_endpoints" {
  description = "List of write endpoints for the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.write_endpoints
}

# Configuration details
output "consistency_level" {
  description = "The consistency level of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.consistency_policy[0].consistency_level
}

output "capacity_mode" {
  description = "The capacity mode (serverless or provisioned)"
  value       = var.capacity_mode
}

output "location" {
  description = "The primary location of the Cosmos DB account"
  value       = azurerm_cosmosdb_account.this.location
}

# Useful for other modules
output "resource_group_name" {
  description = "The resource group name where Cosmos DB is deployed"
  value       = azurerm_cosmosdb_account.this.resource_group_name
}

# For monitoring and diagnostics
output "diagnostic_settings_enabled" {
  description = "Whether diagnostic settings should be configured (hint for monitoring module)"
  value       = var.environment == "prod" ? true : false
}

# Network configuration
output "public_network_access_enabled" {
  description = "Whether public network access is enabled"
  value       = azurerm_cosmosdb_account.this.public_network_access_enabled
}

output "ip_range_filter" {
  description = "The IP range filter applied to the account"
  value       = azurerm_cosmosdb_account.this.ip_range_filter
}
