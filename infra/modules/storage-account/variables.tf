variable "storage_account_name" {
  description = "Name of the storage account. Must be globally unique and 3-24 characters long."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]{3,24}$", var.storage_account_name))
    error_message = "Storage account name must be 3-24 characters long and contain only lowercase letters and numbers."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group where the storage account will be created"
  type        = string
}

variable "location" {
  description = "Azure region where the storage account will be created"
  type        = string
}

variable "account_tier" {
  description = "Storage account tier (Standard or Premium)"
  type        = string
  default     = "Standard"

  validation {
    condition     = contains(["Standard", "Premium"], var.account_tier)
    error_message = "Account tier must be either 'Standard' or 'Premium'."
  }
}

variable "replication_type" {
  description = "Storage account replication type"
  type        = string
  default     = "LRS"

  validation {
    condition     = contains(["LRS", "GRS", "RAGRS", "ZRS", "GZRS", "RAGZRS"], var.replication_type)
    error_message = "Replication type must be one of: LRS, GRS, RAGRS, ZRS, GZRS, RAGZRS."
  }
}

variable "account_kind" {
  description = "Storage account kind"
  type        = string
  default     = "StorageV2"

  validation {
    condition     = contains(["BlobStorage", "BlockBlobStorage", "FileStorage", "Storage", "StorageV2"], var.account_kind)
    error_message = "Account kind must be one of: BlobStorage, BlockBlobStorage, FileStorage, Storage, StorageV2."
  }
}

variable "allow_public_access" {
  description = "Allow public access to blobs"
  type        = bool
  default     = false
}

variable "public_network_access_enabled" {
  description = "Enable public network access to the storage account"
  type        = bool
  default     = true
}

variable "enable_versioning" {
  description = "Enable blob versioning"
  type        = bool
  default     = true
}

variable "enable_change_feed" {
  description = "Enable blob change feed"
  type        = bool
  default     = false
}

variable "soft_delete_retention_days" {
  description = "Number of days to retain soft deleted blobs (0 to disable)"
  type        = number
  default     = 7

  validation {
    condition     = var.soft_delete_retention_days >= 0 && var.soft_delete_retention_days <= 365
    error_message = "Soft delete retention days must be between 0 and 365."
  }
}

variable "container_delete_retention_days" {
  description = "Number of days to retain soft deleted containers (0 to disable)"
  type        = number
  default     = 7

  validation {
    condition     = var.container_delete_retention_days >= 0 && var.container_delete_retention_days <= 365
    error_message = "Container delete retention days must be between 0 and 365."
  }
}

variable "containers" {
  description = "Map of storage containers to create"
  type = map(object({
    access_type = string
  }))
  default = {}

  validation {
    condition = alltrue([
      for container in var.containers : contains(["blob", "container", "private"], container.access_type)
    ])
    error_message = "Container access_type must be one of: blob, container, private."
  }
}

variable "queues" {
  description = "Set of storage queue names to create"
  type        = set(string)
  default     = []
}

variable "tables" {
  description = "Set of storage table names to create"
  type        = set(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to the storage account"
  type        = map(string)
  default     = {}
}
