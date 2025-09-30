variable "name" {
  description = "The name of the Application Insights instance"
  type        = string
}

variable "location" {
  description = "The Azure region where the Application Insights instance will be created"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group in which to create the Application Insights instance"
  type        = string
}

variable "environment" {
  description = "The environment name (e.g., dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "PCPC"
}

variable "application_type" {
  description = "The type of Application Insights to create"
  type        = string
  default     = "web"
  
  validation {
    condition = contains([
      "web", "ios", "other", "store", "java", "phone"
    ], var.application_type)
    error_message = "Application type must be one of: web, ios, other, store, java, phone."
  }
}

variable "workspace_id" {
  description = "The ID of the Log Analytics workspace to associate with Application Insights"
  type        = string
}

variable "retention_in_days" {
  description = "The retention period in days for Application Insights"
  type        = number
  default     = 90
  
  validation {
    condition     = var.retention_in_days >= 30 && var.retention_in_days <= 730
    error_message = "Retention in days must be between 30 and 730."
  }
}

variable "daily_data_cap_in_gb" {
  description = "The daily data volume cap in GB for Application Insights"
  type        = number
  default     = 1
}

variable "daily_data_cap_notifications_disabled" {
  description = "Disable daily data cap notifications"
  type        = bool
  default     = false
}

variable "sampling_percentage" {
  description = "The percentage of telemetry to sample"
  type        = number
  default     = 100
  
  validation {
    condition     = var.sampling_percentage >= 0 && var.sampling_percentage <= 100
    error_message = "Sampling percentage must be between 0 and 100."
  }
}

variable "disable_ip_masking" {
  description = "Disable IP masking for Application Insights"
  type        = bool
  default     = false
}

variable "local_authentication_disabled" {
  description = "Disable local authentication for Application Insights"
  type        = bool
  default     = false
}

variable "internet_ingestion_enabled" {
  description = "Should the Application Insights component support ingestion over the Public Internet?"
  type        = bool
  default     = true
}

variable "internet_query_enabled" {
  description = "Should the Application Insights component support querying over the Public Internet?"
  type        = bool
  default     = true
}

variable "force_customer_storage_for_profiler" {
  description = "Should the Application Insights component force users to create their own storage account for profiling?"
  type        = bool
  default     = false
}

variable "tags" {
  description = "A mapping of tags to assign to the resource"
  type        = map(string)
  default     = {}
}

variable "action_groups" {
  description = "List of action groups to create for alerting"
  type = list(object({
    name       = string
    short_name = string
    email_receivers = list(object({
      name          = string
      email_address = string
    }))
    webhook_receivers = list(object({
      name        = string
      service_uri = string
    }))
  }))
  default = []
}

variable "metric_alerts" {
  description = "List of metric alerts to create"
  type = list(object({
    name        = string
    description = string
    severity    = number
    frequency   = string
    window_size = string
    enabled     = bool
    metric_name = string
    aggregation = string
    operator    = string
    threshold   = number
  }))
  default = []
}
