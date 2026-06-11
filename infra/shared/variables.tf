# Azure Configuration
variable "subscription_id" {
  description = "The Azure subscription ID to deploy resources into"
  type        = string
}

variable "tenant_id" {
  description = "The Azure AD tenant ID"
  type        = string
}

variable "project_name" {
  description = "Project name used in tags."
  type        = string
  default     = "PCPC"
}

variable "container_registry_sku" {
  description = "SKU for the shared Container Registry. Basic is sufficient for portfolio scale (10 GiB storage, no geo-replication). Upgrade only when geo-replication or content trust become needed."
  type        = string
  default     = "Basic"

  validation {
    condition     = contains(["Basic", "Standard", "Premium"], var.container_registry_sku)
    error_message = "container_registry_sku must be Basic, Standard, or Premium."
  }
}
