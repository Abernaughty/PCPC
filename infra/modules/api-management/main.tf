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
    staging = "Developer_1"
    prod    = "Standard_1"
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

  # Protocol configuration
  protocols {
    http2_enabled = var.enable_http2
  }

  # Security configuration - Using v5.0 compatible property names
  security {
    # Use new property names for v5.0 compatibility
    backend_tls10_enabled  = var.tls_10_enabled
    backend_tls11_enabled  = var.tls_11_enabled
    frontend_tls10_enabled = var.tls_10_enabled
    frontend_tls11_enabled = var.tls_11_enabled

    triple_des_ciphers_enabled = var.triple_des_enabled

    # Disable weak ciphers - using new property names
    backend_ssl30_enabled                               = false
    frontend_ssl30_enabled                              = false
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

# -----------------------------------------------------------------------------
# PRODUCTS (Example - can be extended)
# -----------------------------------------------------------------------------

resource "azurerm_api_management_product" "starter" {
  count = var.environment != "prod" ? 1 : 0

  api_management_name   = azurerm_api_management.this.name
  resource_group_name   = var.resource_group_name
  product_id            = "starter"
  display_name          = "Starter"
  description           = "Starter product with limited calls"
  published             = true
  approval_required     = false
  subscription_required = true
  subscriptions_limit   = 1
}

resource "azurerm_api_management_product" "unlimited" {
  count = var.environment == "prod" ? 1 : 0

  api_management_name   = azurerm_api_management.this.name
  resource_group_name   = var.resource_group_name
  product_id            = "unlimited"
  display_name          = "Unlimited"
  description           = "Unlimited product for production"
  published             = true
  approval_required     = true
  subscription_required = true
}
