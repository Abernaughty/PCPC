terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "azurerm_application_insights" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  application_type    = var.application_type
  workspace_id        = var.workspace_id

  retention_in_days                     = var.retention_in_days
  daily_data_cap_in_gb                  = var.daily_data_cap_in_gb
  daily_data_cap_notifications_disabled = var.daily_data_cap_notifications_disabled
  sampling_percentage                   = var.sampling_percentage
  disable_ip_masking                    = var.disable_ip_masking
  local_authentication_disabled         = var.local_authentication_disabled
  internet_ingestion_enabled            = var.internet_ingestion_enabled
  internet_query_enabled                = var.internet_query_enabled
  force_customer_storage_for_profiler   = var.force_customer_storage_for_profiler

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

# Optional: Create action groups for alerting
resource "azurerm_monitor_action_group" "this" {
  count = length(var.action_groups) > 0 ? length(var.action_groups) : 0

  name                = var.action_groups[count.index].name
  resource_group_name = var.resource_group_name
  short_name          = var.action_groups[count.index].short_name

  dynamic "email_receiver" {
    for_each = var.action_groups[count.index].email_receivers
    content {
      name          = email_receiver.value.name
      email_address = email_receiver.value.email_address
    }
  }

  dynamic "webhook_receiver" {
    for_each = var.action_groups[count.index].webhook_receivers
    content {
      name        = webhook_receiver.value.name
      service_uri = webhook_receiver.value.service_uri
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

  lifecycle {
    ignore_changes = [
      tags["CreatedDate"]
    ]
  }
}

# Optional: Create metric alerts
resource "azurerm_monitor_metric_alert" "this" {
  count = length(var.metric_alerts) > 0 ? length(var.metric_alerts) : 0

  name                = var.metric_alerts[count.index].name
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.this.id]
  description         = var.metric_alerts[count.index].description
  severity            = var.metric_alerts[count.index].severity
  frequency           = var.metric_alerts[count.index].frequency
  window_size         = var.metric_alerts[count.index].window_size
  enabled             = var.metric_alerts[count.index].enabled

  criteria {
    metric_namespace = "Microsoft.Insights/components"
    metric_name      = var.metric_alerts[count.index].metric_name
    aggregation      = var.metric_alerts[count.index].aggregation
    operator         = var.metric_alerts[count.index].operator
    threshold        = var.metric_alerts[count.index].threshold
  }

  action {
    action_group_id = azurerm_monitor_action_group.this[0].id
  }

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

  depends_on = [azurerm_monitor_action_group.this]
}
