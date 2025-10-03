variable "name" {
  description = "The name of the Log Analytics workspace"
  type        = string
}

variable "location" {
  description = "The Azure region where the Log Analytics workspace will be created"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group in which to create the Log Analytics workspace"
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

variable "sku" {
  description = "The SKU of the Log Analytics workspace"
  type        = string
  default     = "PerGB2018"

  validation {
    condition = contains([
      "Free", "Standalone", "PerNode", "PerGB2018"
    ], var.sku)
    error_message = "The sku must be one of: Free, Standalone, PerNode, PerGB2018."
  }
}

variable "retention_in_days" {
  description = "The workspace data retention in days"
  type        = number
  default     = 30

  validation {
    condition     = var.retention_in_days >= 30 && var.retention_in_days <= 730
    error_message = "Retention in days must be between 30 and 730."
  }
}

variable "daily_quota_gb" {
  description = "The workspace daily quota for ingestion in GB"
  type        = number
  default     = -1
}

variable "internet_ingestion_enabled" {
  description = "Should the Log Analytics workspace allow ingestion over the public internet?"
  type        = bool
  default     = true
}

variable "internet_query_enabled" {
  description = "Should the Log Analytics workspace allow queries over the public internet?"
  type        = bool
  default     = true
}

variable "tags" {
  description = "A mapping of tags to assign to the resource"
  type        = map(string)
  default     = {}
}

variable "data_collection_rules" {
  description = "List of data collection rules to create"
  type = list(object({
    name        = string
    description = string
    streams     = list(string)
  }))
  default = []
}

variable "saved_searches" {
  description = "List of saved searches to create"
  type = list(object({
    name         = string
    category     = string
    display_name = string
    query        = string
  }))
  default = []
}
