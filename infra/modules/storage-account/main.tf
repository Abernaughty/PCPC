terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.40.0"
    }
  }
}

# Storage Account for blob storage
resource "azurerm_storage_account" "main" {
  name                     = var.storage_account_name
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = var.account_tier
  account_replication_type = var.replication_type
  account_kind             = var.account_kind

  # Security settings
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = var.allow_public_access
  public_network_access_enabled   = var.public_network_access_enabled

  # Enable blob versioning and soft delete for data protection
  blob_properties {
    versioning_enabled  = var.enable_versioning
    change_feed_enabled = var.enable_change_feed

    dynamic "delete_retention_policy" {
      for_each = var.soft_delete_retention_days > 0 ? [1] : []
      content {
        days = var.soft_delete_retention_days
      }
    }

    dynamic "container_delete_retention_policy" {
      for_each = var.container_delete_retention_days > 0 ? [1] : []
      content {
        days = var.container_delete_retention_days
      }
    }
  }

  tags = var.tags
}

# Storage containers
resource "azurerm_storage_container" "containers" {
  for_each = var.containers

  name                  = each.key
  storage_account_name  = azurerm_storage_account.main.name
  container_access_type = each.value.access_type
}

# Storage queues (if needed)
resource "azurerm_storage_queue" "queues" {
  for_each = var.queues

  name                 = each.key
  storage_account_name = azurerm_storage_account.main.name
}

# Storage tables (if needed)
resource "azurerm_storage_table" "tables" {
  for_each = var.tables

  name                 = each.key
  storage_account_name = azurerm_storage_account.main.name
}
