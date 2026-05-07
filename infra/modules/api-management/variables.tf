# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# -----------------------------------------------------------------------------

variable "name" {
  description = "The name of the API Management instance"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,48}[a-z0-9]$", var.name))
    error_message = "Name must start with letter, contain only lowercase letters, numbers and hyphens, and be 1-50 characters."
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

variable "publisher_name" {
  description = "The name of the publisher"
  type        = string
}

variable "publisher_email" {
  description = "The email of the publisher"
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.publisher_email))
    error_message = "Publisher email must be a valid email address."
  }
}

# -----------------------------------------------------------------------------
# OPTIONAL VARIABLES
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "sku_name" {
  description = "The pricing tier of this API Management service"
  type        = string
  default     = "Consumption_0"

  validation {
    condition     = contains(["Consumption_0", "Developer_1", "Basic_1", "Standard_1", "Premium_1"], var.sku_name)
    error_message = "SKU must be one of: Consumption_0, Developer_1, Basic_1, Standard_1, Premium_1."
  }
}

variable "identity_type" {
  description = "The type of managed identity"
  type        = string
  default     = "SystemAssigned"
}

variable "virtual_network_type" {
  description = "The type of virtual network configuration"
  type        = string
  default     = "None"

  validation {
    condition     = contains(["None", "External", "Internal"], var.virtual_network_type)
    error_message = "Virtual network type must be None, External, or Internal."
  }
}

variable "enable_http2" {
  description = "Enable HTTP/2 support"
  type        = bool
  default     = true
}

variable "min_api_version" {
  description = "The minimum API version to support"
  type        = string
  default     = null
}

variable "notification_sender_email" {
  description = "Email address for notifications"
  type        = string
  default     = "apimgmt-noreply@mail.windowsazure.com"
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Network Configuration
variable "public_network_access_enabled" {
  description = "Whether public network access is enabled"
  type        = bool
  default     = true
}

variable "public_ip_address_id" {
  description = "ID of a public IP address for the API Management service"
  type        = string
  default     = null
}

variable "subnet_id" {
  description = "The ID of the subnet for VNet integration"
  type        = string
  default     = null
}

# Security Configuration
variable "client_certificate_enabled" {
  description = "Enable client certificate authentication"
  type        = bool
  default     = false
}

variable "gateway_disabled" {
  description = "Disable the gateway"
  type        = bool
  default     = false
}

variable "tls_10_enabled" {
  description = "Enable TLS 1.0"
  type        = bool
  default     = false
}

variable "tls_11_enabled" {
  description = "Enable TLS 1.1"
  type        = bool
  default     = false
}

variable "triple_des_enabled" {
  description = "Enable Triple DES ciphers"
  type        = bool
  default     = false
}

# -----------------------------------------------------------------------------
# CUSTOM DOMAIN CONFIGURATION
# -----------------------------------------------------------------------------

variable "gateway_hostnames" {
  description = <<-EOT
    Custom hostnames bound to the APIM gateway with Azure-managed TLS certs.

    PRECONDITION: For each hostname, a CNAME record pointing at the APIM
    service's default `*.azure-api.net` gateway hostname must exist before
    `terraform apply`. Azure validates the cert via that DNS record. Apply
    will hang or fail if the CNAME is not in place.

    Set `default_ssl_binding = true` on exactly one hostname per APIM if
    you want SNI clients without SNI to land on it; otherwise leave it
    false on all of them.
  EOT
  type = list(object({
    host_name           = string
    default_ssl_binding = optional(bool, false)
  }))
  default = []

  validation {
    condition = alltrue([
      for h in var.gateway_hostnames : can(regex("^[a-z0-9.-]+\\.[a-z]{2,}$", h.host_name))
    ])
    error_message = "Each gateway hostname must be a lowercase FQDN (e.g. dev-api.pcpc.maber.io)."
  }

  validation {
    condition = length([
      for h in var.gateway_hostnames : h if h.default_ssl_binding == true
    ]) <= 1
    error_message = "At most one gateway hostname may set default_ssl_binding = true."
  }
}
