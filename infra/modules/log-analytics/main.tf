terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = var.sku
  retention_in_days   = var.retention_in_days
  daily_quota_gb      = var.daily_quota_gb

  internet_ingestion_enabled = var.internet_ingestion_enabled
  internet_query_enabled     = var.internet_query_enabled

  tags = merge(
    var.tags,
    {
      "Environment" = var.environment
      "Project"     = var.project_name
      "ManagedBy"   = "Terraform"
    }
  )

  lifecycle {
    ignore_changes = [
      tags["CreatedDate"]
    ]
  }
}

# Optional: Create data collection rules for custom logs
resource "azurerm_monitor_data_collection_rule" "this" {
  count = length(var.data_collection_rules) > 0 ? length(var.data_collection_rules) : 0

  name                = var.data_collection_rules[count.index].name
  resource_group_name = var.resource_group_name
  location            = var.location
  description         = var.data_collection_rules[count.index].description

  destinations {
    log_analytics {
      workspace_resource_id = azurerm_log_analytics_workspace.this.id
      name                  = "destination-log"
    }
  }

  data_flow {
    streams      = var.data_collection_rules[count.index].streams
    destinations = ["destination-log"]
  }

  data_sources {
    performance_counter {
      streams                       = ["Microsoft-Perf"]
      sampling_frequency_in_seconds = 60
      counter_specifiers = [
        "\\Processor Information(_Total)\\% Processor Time",
        "\\Processor Information(_Total)\\% Privileged Time",
        "\\Processor Information(_Total)\\% User Time",
        "\\Processor Information(_Total)\\Processor Frequency",
        "\\System\\Processes",
        "\\Process(_Total)\\Thread Count",
        "\\Process(_Total)\\Handle Count",
        "\\System\\System Up Time",
        "\\System\\Context Switches/sec",
        "\\System\\Processor Queue Length",
        "\\Memory\\Available Bytes",
        "\\Memory\\Committed Bytes",
        "\\Memory\\Cache Bytes",
        "\\Memory\\Pool Paged Bytes",
        "\\Memory\\Pool Nonpaged Bytes",
        "\\Memory\\Pages/sec",
        "\\Memory\\Page Faults/sec",
        "\\Process(_Total)\\Working Set",
        "\\Process(_Total)\\Working Set - Private"
      ]
      name = "perfCounterDataSource60"
    }
  }

  tags = merge(
    var.tags,
    {
      "Environment" = var.environment
      "Project"     = var.project_name
      "ManagedBy"   = "Terraform"
    }
  )
}

# Optional: Create saved searches for common queries
resource "azurerm_log_analytics_saved_search" "this" {
  count = length(var.saved_searches) > 0 ? length(var.saved_searches) : 0

  name                       = var.saved_searches[count.index].name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  category                   = var.saved_searches[count.index].category
  display_name               = var.saved_searches[count.index].display_name
  query                      = var.saved_searches[count.index].query

  tags = merge(
    var.tags,
    {
      "Environment" = var.environment
      "Project"     = var.project_name
      "ManagedBy"   = "Terraform"
    }
  )
}
