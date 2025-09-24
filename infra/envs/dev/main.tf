terraform {
  required_version = ">= 1.13.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-pcpc-tfstate"
    storage_account_name = "stpcpctfstate"
    container_name       = "tfstate"
    key                  = "dev.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

provider "random" {}

# Generate random suffix for unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  # Common naming convention
  name_prefix = "pcpc-${var.environment}"
  name_suffix = random_string.suffix.result
  
  # Common tags
  common_tags = {
    Environment   = var.environment
    Project       = var.project_name
    ManagedBy     = "Terraform"
    CreatedDate   = formatdate("YYYY-MM-DD", timestamp())
    Repository    = "PCPC"
  }
}

# Resource Group
module "resource_group" {
  source = "../../modules/resource-group"

  name         = "rg-${local.name_prefix}"
  location     = var.location
  environment  = var.environment
  project_name = var.project_name
  tags         = local.common_tags
}

# Storage Account for Functions and Static Web App
module "storage_account" {
  source = "../../modules/storage-account"

  name                = "st${replace(local.name_prefix, "-", "")}${local.name_suffix}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment
  
  account_tier             = var.storage_account_tier
  account_replication_type = var.storage_account_replication_type
  
  tags = local.common_tags

  depends_on = [module.resource_group]
}

# Cosmos DB
module "cosmos_db" {
  source = "../../modules/cosmos-db"

  name                = "cosmos-${local.name_prefix}-${local.name_suffix}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  offer_type                    = var.cosmos_offer_type
  kind                         = var.cosmos_kind
  consistency_level            = var.cosmos_consistency_level
  max_interval_in_seconds      = var.cosmos_max_interval_in_seconds
  max_staleness_prefix         = var.cosmos_max_staleness_prefix
  enable_automatic_failover    = var.cosmos_enable_automatic_failover
  enable_multiple_write_locations = var.cosmos_enable_multiple_write_locations

  databases = var.cosmos_databases
  
  tags = local.common_tags

  depends_on = [module.resource_group]
}

# Function App
module "function_app" {
  source = "../../modules/function-app"

  name                = "func-${local.name_prefix}-${local.name_suffix}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  storage_account_name       = module.storage_account.name
  storage_account_access_key = module.storage_account.primary_access_key
  
  service_plan_sku_name = var.function_app_sku_name
  
  app_settings = merge(
    var.function_app_settings,
    {
      "COSMOS_DB_CONNECTION_STRING" = module.cosmos_db.connection_strings[0]
      "COSMOS_DB_ENDPOINT"          = module.cosmos_db.endpoint
      "COSMOS_DB_KEY"               = module.cosmos_db.primary_key
      "WEBSITE_NODE_DEFAULT_VERSION" = "~22"
      "FUNCTIONS_WORKER_RUNTIME"    = "node"
      "FUNCTIONS_EXTENSION_VERSION" = "~4"
    }
  )
  
  tags = local.common_tags

  depends_on = [module.resource_group, module.storage_account, module.cosmos_db]
}

# Static Web App
module "static_web_app" {
  source = "../../modules/static-web-app"

  name                = "swa-${local.name_prefix}-${local.name_suffix}"
  resource_group_name = module.resource_group.name
  location            = var.static_web_app_location
  environment         = var.environment

  sku_tier = var.static_web_app_sku_tier
  sku_size = var.static_web_app_sku_size

  app_settings = merge(
    var.static_web_app_settings,
    {
      "API_BASE_URL" = "https://${module.function_app.default_hostname}/api"
    }
  )

  tags = local.common_tags

  depends_on = [module.resource_group, module.function_app]
}

# API Management (Optional for dev environment)
module "api_management" {
  count  = var.enable_api_management ? 1 : 0
  source = "../../modules/api-management"

  name                = "apim-${local.name_prefix}-${local.name_suffix}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  publisher_name  = var.apim_publisher_name
  publisher_email = var.apim_publisher_email
  sku_name        = var.apim_sku_name

  tags = local.common_tags

  depends_on = [module.resource_group]
}
