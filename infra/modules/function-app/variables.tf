# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# -----------------------------------------------------------------------------

variable "name" {
  description = "The name of the Function App"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{2,60}$", var.name))
    error_message = "Name must be 2-60 characters, lowercase letters, numbers, and hyphens only."
  }
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "location" {
  description = "The Azure region where resources will be created"
  type        = string
}

variable "storage_account_name" {
  description = "The name of the storage account for the Function App"
  type        = string
}

variable "storage_account_key" {
  description = "The access key for the storage account"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# OPTIONAL VARIABLES
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "os_type" {
  description = "The operating system type (Windows or Linux)"
  type        = string
  default     = "Windows"

  validation {
    condition     = contains(["Windows", "Linux"], var.os_type)
    error_message = "OS type must be Windows or Linux."
  }
}


variable "service_plan_id" {
  description = "The ID of the App Service Plan. If not provided, a consumption plan will be created"
  type        = string
  default     = null
}

variable "sku_name" {
  description = "The SKU for the App Service Plan (Y1 for consumption, B1, S1, P1v2, etc.)"
  type        = string
  default     = "Y1"
}

variable "app_settings" {
  description = "Application settings for the Function App"
  type        = map(string)
  default     = {}
}

variable "cors_allowed_origins" {
  description = "List of allowed origins for CORS"
  type        = list(string)
  default     = []
}

variable "cors_support_credentials" {
  description = "Whether CORS requests with credentials are allowed"
  type        = bool
  default     = false
}

variable "https_only" {
  description = "Force HTTPS for all traffic"
  type        = bool
  default     = true
}

variable "minimum_tls_version" {
  description = "The minimum TLS version (1.0, 1.1, 1.2)"
  type        = string
  default     = "1.2"
}

variable "ftps_state" {
  description = "State of FTP / FTPS service (AllAllowed, FtpsOnly, Disabled)"
  type        = string
  default     = "FtpsOnly"
}

variable "always_on" {
  description = "Should the Function App be always on (not available for consumption plan)"
  type        = bool
  default     = false
}

variable "application_insights_enabled" {
  description = "Enable Application Insights for the Function App"
  type        = bool
  default     = true
}

variable "application_insights_id" {
  description = "The ID of an existing Application Insights instance"
  type        = string
  default     = null
}

variable "application_insights_key" {
  description = "The instrumentation key of an existing Application Insights instance"
  type        = string
  default     = null
  sensitive   = true
}

variable "application_insights_connection_string" {
  description = "The connection string of an existing Application Insights instance"
  type        = string
  default     = null
  sensitive   = true
}

variable "identity_type" {
  description = "The type of managed identity (SystemAssigned, UserAssigned, SystemAssigned,UserAssigned)"
  type        = string
  default     = "SystemAssigned"
}

variable "identity_ids" {
  description = "List of user-assigned managed identity IDs"
  type        = list(string)
  default     = []
}

variable "ip_restrictions" {
  description = "IP restriction rules for the Function App"
  type = list(object({
    name                      = string
    priority                  = number
    action                    = string
    ip_address                = optional(string)
    virtual_network_subnet_id = optional(string)
    service_tag               = optional(string)
  }))
  default = []
}

variable "virtual_network_subnet_id" {
  description = "The subnet ID for VNet integration"
  type        = string
  default     = null
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# SCALING CONFIGURATION
# -----------------------------------------------------------------------------

variable "app_scale_limit" {
  description = "The maximum number of instances for the Function App"
  type        = number
  default     = 200
}

variable "elastic_instance_minimum" {
  description = "The minimum number of elastic instances"
  type        = number
  default     = 1
}

variable "pre_warmed_instance_count" {
  description = "The number of pre-warmed instances (Premium plan only)"
  type        = number
  default     = 0
}
