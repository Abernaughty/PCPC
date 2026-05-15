variable "location" {
  description = "Azure region for the shared resource group and its resources. Should match the region of the env workloads that pull from this ACR — cross-region pulls work but add latency."
  type        = string
  default     = "centralus"
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
