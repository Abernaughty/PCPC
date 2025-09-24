# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# These variables must be set when using this module
# -----------------------------------------------------------------------------

variable "name" {
  description = "The name of the Cosmos DB account. Must be globally unique."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{3,44}$", var.name))
    error_message = "Name must be 3-44 characters, lowercase letters, numbers, and hyphens only."
  }
}

variable "resource_group_name" {
  description = "The name of the resource group where Cosmos DB will be created"
  type        = string
}

variable "location" {
  description = "The Azure region where resources will be created"
  type        = string
}

# -----------------------------------------------------------------------------
# OPTIONAL VARIABLES
# These variables have defaults but can be overridden
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod) - used for tagging and configuration"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "capacity_mode" {
  description = "Cosmos DB capacity mode: 'serverless' or 'provisioned'"
  type        = string
  default     = "serverless"

  validation {
    condition     = contains(["serverless", "provisioned"], var.capacity_mode)
    error_message = "Capacity mode must be 'serverless' or 'provisioned'."
  }
}

variable "consistency_level" {
  description = "The consistency level for Cosmos DB (BoundedStaleness, Eventual, Session, Strong, ConsistentPrefix)"
  type        = string
  default     = "Session"
}

variable "backup_type" {
  description = "Backup type: 'Continuous' or 'Periodic'"
  type        = string
  default     = "Continuous"
}

variable "backup_tier" {
  description = "Backup tier for continuous backup: 'Continuous7Days' or 'Continuous30Days'"
  type        = string
  default     = "Continuous7Days"
}

variable "enable_automatic_failover" {
  description = "Enable automatic failover for the Cosmos DB account"
  type        = bool
  default     = true
}

variable "enable_multiple_write_locations" {
  description = "Enable multiple write locations (multi-master)"
  type        = bool
  default     = false
}

variable "enable_free_tier" {
  description = "Enable free tier for Cosmos DB (only one per subscription)"
  type        = bool
  default     = false
}

variable "public_network_access_enabled" {
  description = "Whether public network access is allowed"
  type        = bool
  default     = true
}

variable "ip_range_filter" {
  description = "List of IP addresses or CIDR blocks that can access Cosmos DB"
  type        = list(string)
  default     = []
}

variable "throughput_limit" {
  description = "Total throughput limit for serverless mode (RU/s)"
  type        = number
  default     = 4000
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# NETWORK CONFIGURATION
# -----------------------------------------------------------------------------

variable "virtual_network_rules" {
  description = "List of virtual network subnet IDs to allow access from"
  type        = list(string)
  default     = []
}

variable "enable_private_endpoint" {
  description = "Enable private endpoint for Cosmos DB"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# ADVANCED CONFIGURATION
# -----------------------------------------------------------------------------

variable "analytical_storage_enabled" {
  description = "Enable analytical storage for Cosmos DB"
  type        = bool
  default     = false
}

variable "cors_rules" {
  description = "CORS rules for Cosmos DB"
  type = list(object({
    allowed_headers    = list(string)
    allowed_methods    = list(string)
    allowed_origins    = list(string)
    exposed_headers    = list(string)
    max_age_in_seconds = number
  }))
  default = []
}
