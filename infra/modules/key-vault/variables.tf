variable "name" {
  description = "Name of the Key Vault."
  type        = string
}

variable "resource_group_name" {
  description = "Resource group where the Key Vault will be created."
  type        = string
}

variable "location" {
  description = "Azure region for the Key Vault."
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)."
  type        = string
}

variable "tenant_id" {
  description = "Azure Active Directory tenant ID for the Key Vault."
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to the Key Vault."
  type        = map(string)
  default     = {}
}

variable "sku_name" {
  description = "Pricing SKU for the Key Vault."
  type        = string
  default     = "standard"
}

variable "soft_delete_retention_days" {
  description = "Number of days soft-deleted secrets are retained."
  type        = number
  default     = 90
}

variable "purge_protection_enabled" {
  description = "Whether purge protection is enabled."
  type        = bool
  default     = true
}

variable "public_network_access_enabled" {
  description = "Allow public network access to the Key Vault."
  type        = bool
  default     = true
}

variable "enabled_for_deployment" {
  description = "Allow Azure Resource Manager to retrieve secrets."
  type        = bool
  default     = false
}

variable "enabled_for_disk_encryption" {
  description = "Allow Azure Disk Encryption to retrieve secrets."
  type        = bool
  default     = false
}

variable "enabled_for_template_deployment" {
  description = "Allow template deployments to retrieve secrets."
  type        = bool
  default     = false
}

variable "network_acls" {
  description = "Optional network ACL configuration for the Key Vault."
  type        = any
  default     = null
}

variable "access_policies" {
  description = "List of data-plane access policies to apply to the Key Vault."
  type        = list(map(any))
  default     = []

  validation {
    condition = alltrue([
      for policy in var.access_policies :
      can(policy.object_id)
    ])
    error_message = "Each Key Vault access policy must include an object_id."
  }
}

variable "rbac_assignments" {
  description = "List of RBAC role assignments to grant on the Key Vault."
  type        = list(map(any))
  default     = []

  validation {
    condition = alltrue([
      for assignment in var.rbac_assignments :
      can(assignment.principal_id)
    ])
    error_message = "Each Key Vault RBAC assignment must include a principal_id."
  }
}
