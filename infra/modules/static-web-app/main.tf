# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "static-web-app"
    },
    var.tags
  )

  # Environment-specific SKU
  sku_config = {
    dev     = { tier = "Free", size = "Free" }
    staging = { tier = "Free", size = "Free" }
    prod    = { tier = "Standard", size = "Standard" }
  }

  selected_sku = local.sku_config[var.environment]
}

# -----------------------------------------------------------------------------
# STATIC WEB APP
# -----------------------------------------------------------------------------

resource "azurerm_static_web_app" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location

  sku_tier = var.sku_tier != "" ? var.sku_tier : local.selected_sku.tier
  sku_size = var.sku_size != "" ? var.sku_size : local.selected_sku.size

  # GitHub Integration (optional)
  # Note: Build configuration (app_location, api_location, output_location) 
  # is typically configured in the staticwebapp.config.json file in the repository
  # or through GitHub Actions workflow, not in Terraform
  #repository_url    = var.repository_url
  #repository_branch = var.repository_url != "" ? var.repository_branch : null
  #repository_token  = var.repository_url != "" ? var.repository_token : null

  # Configuration
  app_settings                       = var.app_settings
  preview_environments_enabled       = var.preview_environments_enabled
  configuration_file_changes_enabled = var.configuration_file_changes_enabled
  public_network_access_enabled      = true

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# CUSTOM DOMAIN (Optional - for future use)
# -----------------------------------------------------------------------------

# resource "azurerm_static_web_app_custom_domain" "this" {
#   count = var.custom_domain != "" ? 1 : 0
#   
#   static_web_app_id = azurerm_static_web_app.this.id
#   domain_name       = var.custom_domain
#   validation_type   = "cname-delegation"
# }
