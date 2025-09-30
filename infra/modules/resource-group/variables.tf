variable "name" {
  description = "The name of the resource group"
  type        = string
}

variable "location" {
  description = "The Azure region where the resource group will be created"
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

variable "tags" {
  description = "A map of tags to assign to the resource group"
  type        = map(string)
  default     = {}
}

variable "prevent_destroy" {
  description = "Whether to prevent destruction of the resource group"
  type        = bool
  default     = false
}

variable "lock_level" {
  description = "The level of lock to apply to the resource group (CanNotDelete or ReadOnly)"
  type        = string
  default     = null
  # Validation removed to avoid null value issues in Terraform validation
  # Valid values: null, "CanNotDelete", "ReadOnly"
}

variable "lock_notes" {
  description = "Notes for the management lock"
  type        = string
  default     = "Managed by Terraform"
}
