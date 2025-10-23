# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "api-management"
    },
    var.tags
  )

  # Environment-specific SKU configuration
  sku_config = {
    dev     = "Consumption_0"
    staging = "Consumption_0"
    prod    = "Consumption_0"
  }

  selected_sku = var.sku_name != "Consumption_0" ? var.sku_name : local.sku_config[var.environment]
}

# -----------------------------------------------------------------------------
# API MANAGEMENT SERVICE
# -----------------------------------------------------------------------------

resource "azurerm_api_management" "this" {
  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  publisher_name      = var.publisher_name
  publisher_email     = var.publisher_email

  sku_name = local.selected_sku

  # Network configuration
  virtual_network_type          = var.virtual_network_type
  public_network_access_enabled = var.public_network_access_enabled
  public_ip_address_id          = var.public_ip_address_id

  # VNet configuration (if applicable)
  dynamic "virtual_network_configuration" {
    for_each = var.subnet_id != null ? [1] : []
    content {
      subnet_id = var.subnet_id
    }
  }

  # Security settings
  client_certificate_enabled = var.client_certificate_enabled
  gateway_disabled           = var.gateway_disabled
  min_api_version            = var.min_api_version

  # Notification settings
  notification_sender_email = var.notification_sender_email

  # Managed identity
  identity {
    type = var.identity_type
  }

  timeouts {
    create = "60m"
    delete = "60m"
  }

  # Security configuration
  security {
    backend_ssl30_enabled  = false
    backend_tls10_enabled  = var.tls_10_enabled
    backend_tls11_enabled  = var.tls_11_enabled
    frontend_ssl30_enabled = false
    frontend_tls10_enabled = var.tls_10_enabled
    frontend_tls11_enabled = var.tls_11_enabled

    # Disable weak ciphers
    tls_ecdhe_ecdsa_with_aes128_cbc_sha_ciphers_enabled = false
    tls_ecdhe_ecdsa_with_aes256_cbc_sha_ciphers_enabled = false
    tls_ecdhe_rsa_with_aes128_cbc_sha_ciphers_enabled   = false
    tls_ecdhe_rsa_with_aes256_cbc_sha_ciphers_enabled   = false
    tls_rsa_with_aes128_cbc_sha256_ciphers_enabled      = false
    tls_rsa_with_aes128_cbc_sha_ciphers_enabled         = false
    tls_rsa_with_aes128_gcm_sha256_ciphers_enabled      = false
    tls_rsa_with_aes256_cbc_sha256_ciphers_enabled      = false
    tls_rsa_with_aes256_cbc_sha_ciphers_enabled         = false
    tls_rsa_with_aes256_gcm_sha384_ciphers_enabled      = false
  }

  tags = local.common_tags
}
