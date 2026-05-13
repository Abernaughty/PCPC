# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# -----------------------------------------------------------------------------

variable "name" {
  description = "Name of the Container Registry. Must be globally unique. Azure restricts ACR names to alphanumeric characters only — no hyphens, dots, or underscores. 5-50 characters."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{5,50}$", var.name))
    error_message = "ACR name must be 5-50 characters, lowercase alphanumeric only (no hyphens, dots, or underscores)."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group that hosts the Container Registry."
  type        = string
}

variable "location" {
  description = "Azure region where the Container Registry will be created."
  type        = string
}

# -----------------------------------------------------------------------------
# OPTIONAL VARIABLES
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod). Used in default tagging."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "sku" {
  description = "SKU for the Container Registry. `Basic` is sufficient for portfolio use (10 GiB storage, no geo-replication, no content trust). Upgrade to `Standard` or `Premium` only when those features are actually needed."
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.sku)
    error_message = "SKU must be Basic, Standard, or Premium."
  }
}

variable "admin_enabled" {
  description = "Whether the ACR admin user is enabled. Default `false` — production pattern is to authenticate via managed identity + AcrPull/AcrPush role assignments rather than the admin user's static credentials."
  type        = bool
  default     = false
}

variable "public_network_access_enabled" {
  description = "Whether the registry is reachable from the public internet. Default `true` for portfolio simplicity. Set `false` and use Private Endpoints in regulated environments — requires Premium SKU."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to the resource. Merged with module defaults (Environment, ManagedBy=Terraform, Module=container-registry)."
  type        = map(string)
  default     = {}
}
