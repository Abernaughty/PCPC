# -----------------------------------------------------------------------------
# LOCALS
# Computed values and environment-specific configurations
# -----------------------------------------------------------------------------

locals {
  # Merge default tags with user-provided tags
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "cosmos-db"
    },
    var.tags
  )

  # Environment-specific settings
  env_config = {
    dev = {
      min_tls_version = "Tls12"
      zone_redundant  = false
    }
    staging = {
      min_tls_version = "Tls12"
      zone_redundant  = false
    }
    prod = {
      min_tls_version = "Tls12"
      zone_redundant  = true
    }
  }

  # Select configuration based on environment
  selected_config = local.env_config[var.environment]
}

# -----------------------------------------------------------------------------
# COSMOS DB ACCOUNT
# The main Cosmos DB resource
# -----------------------------------------------------------------------------

resource "azurerm_cosmosdb_account" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  # Consistency configuration
  consistency_policy {
    consistency_level       = var.consistency_level
    max_interval_in_seconds = var.consistency_level == "BoundedStaleness" ? 300 : 5
    max_staleness_prefix    = var.consistency_level == "BoundedStaleness" ? 100000 : 100
  }

  # Geo-location configuration
  geo_location {
    location          = var.location
    failover_priority = 0
    zone_redundant    = local.selected_config.zone_redundant
  }

  # Capacity configuration - Dynamic based on mode
  dynamic "capabilities" {
    for_each = var.capacity_mode == "serverless" ? [1] : []
    content {
      name = "EnableServerless"
    }
  }

  # Serverless capacity limits
  dynamic "capacity" {
    for_each = var.capacity_mode == "serverless" ? [1] : []
    content {
      total_throughput_limit = var.throughput_limit
    }
  }

  # Backup configuration - Dynamic based on type
  dynamic "backup" {
    for_each = var.backup_type == "Continuous" ? [1] : []
    content {
      type = "Continuous"
      tier = var.backup_tier
    }
  }

  dynamic "backup" {
    for_each = var.backup_type == "Periodic" ? [1] : []
    content {
      type                = "Periodic"
      interval_in_minutes = 240
      retention_in_hours  = 8
      storage_redundancy  = "Geo"
    }
  }

  # Analytical storage (optional)
  dynamic "analytical_storage" {
    for_each = var.analytical_storage_enabled ? [1] : []
    content {
      schema_type = "WellDefined"
    }
  }

  # Network configuration
  public_network_access_enabled     = var.public_network_access_enabled
  ip_range_filter                   = toset(var.ip_range_filter)
  is_virtual_network_filter_enabled = length(var.virtual_network_rules) > 0

  # Virtual network rules
  dynamic "virtual_network_rule" {
    for_each = var.virtual_network_rules
    content {
      id = virtual_network_rule.value
    }
  }

  # CORS configuration
  dynamic "cors_rule" {
    for_each = var.cors_rules
    content {
      allowed_headers    = cors_rule.value.allowed_headers
      allowed_methods    = cors_rule.value.allowed_methods
      allowed_origins    = cors_rule.value.allowed_origins
      exposed_headers    = cors_rule.value.exposed_headers
      max_age_in_seconds = cors_rule.value.max_age_in_seconds
    }
  }

  # Security settings
  minimal_tls_version                   = local.selected_config.min_tls_version
  local_authentication_disabled         = false
  access_key_metadata_writes_enabled    = true
  network_acl_bypass_for_azure_services = false

  # High availability settings
  automatic_failover_enabled       = var.enable_automatic_failover
  multiple_write_locations_enabled = var.enable_multiple_write_locations

  # Free tier (only one per subscription allowed)
  free_tier_enabled = var.enable_free_tier

  # Advanced features
  analytical_storage_enabled = var.analytical_storage_enabled
  partition_merge_enabled    = false
  burst_capacity_enabled     = false

  # Identity
  default_identity_type = "FirstPartyIdentity"

  # Tags
  tags = local.common_tags
}
