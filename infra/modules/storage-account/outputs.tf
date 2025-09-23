output "storage_account_id" {
  description = "The ID of the storage account"
  value       = azurerm_storage_account.main.id
}

output "storage_account_name" {
  description = "The name of the storage account"
  value       = azurerm_storage_account.main.name
}

output "primary_blob_endpoint" {
  description = "The primary blob endpoint of the storage account"
  value       = azurerm_storage_account.main.primary_blob_endpoint
}

output "primary_connection_string" {
  description = "The primary connection string for the storage account"
  value       = azurerm_storage_account.main.primary_connection_string
  sensitive   = true
}

output "secondary_connection_string" {
  description = "The secondary connection string for the storage account"
  value       = azurerm_storage_account.main.secondary_connection_string
  sensitive   = true
}

output "primary_access_key" {
  description = "The primary access key for the storage account"
  value       = azurerm_storage_account.main.primary_access_key
  sensitive   = true
}

output "secondary_access_key" {
  description = "The secondary access key for the storage account"
  value       = azurerm_storage_account.main.secondary_access_key
  sensitive   = true
}

output "primary_blob_host" {
  description = "The hostname with port if applicable for blob storage in the primary location"
  value       = azurerm_storage_account.main.primary_blob_host
}

output "primary_queue_endpoint" {
  description = "The primary queue endpoint of the storage account"
  value       = azurerm_storage_account.main.primary_queue_endpoint
}

output "primary_table_endpoint" {
  description = "The primary table endpoint of the storage account"
  value       = azurerm_storage_account.main.primary_table_endpoint
}

output "containers" {
  description = "Map of created storage containers"
  value = {
    for k, v in azurerm_storage_container.containers : k => {
      name                    = v.name
      id                      = v.id
      has_immutability_policy = v.has_immutability_policy
      has_legal_hold          = v.has_legal_hold
      resource_manager_id     = v.resource_manager_id
    }
  }
}

output "queues" {
  description = "Map of created storage queues"
  value = {
    for k, v in azurerm_storage_queue.queues : k => {
      name                = v.name
      id                  = v.id
      resource_manager_id = v.resource_manager_id
    }
  }
}

output "tables" {
  description = "Map of created storage tables"
  value = {
    for k, v in azurerm_storage_table.tables : k => {
      name = v.name
      id   = v.id
    }
  }
}
