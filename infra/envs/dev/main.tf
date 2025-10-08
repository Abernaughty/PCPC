terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Remote backend for state management
  backend "azurerm" {
    resource_group_name  = "pcpc-terraform-state-rg"
    storage_account_name = "pcpctfstatedacc29c2"
    container_name       = "tfstate"
    key                  = "dev.terraform.tfstate"
    tenant_id            = "5f445a68-ec75-42cf-a50f-6ec158ee675c"
    subscription_id      = "555b4cfa-ad2e-4c71-9433-620a59cf7616"
    lock_timeout         = "5m" # Automatically release after 5 minutes of inactivity
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
  subscription_id = "555b4cfa-ad2e-4c71-9433-620a59cf7616"
}

provider "random" {}

# Generate random suffix for unique resource names
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  # New naming convention: pcpc-{resource}-{environment}
  environment = var.environment

  # Common tags
  common_tags = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
    CreatedDate = formatdate("YYYY-MM-DD", timestamp())
    Repository  = "PCPC"
  }
}

# Resource Group
module "resource_group" {
  source = "../../modules/resource-group"

  name         = "pcpc-rg-${local.environment}"
  location     = var.location
  environment  = var.environment
  project_name = var.project_name
  tags         = local.common_tags
}

# Storage Account for Functions and Static Web App
module "storage_account" {
  source = "../../modules/storage-account"

  storage_account_name = "pcpcst${local.environment}${random_string.suffix.result}"
  resource_group_name  = module.resource_group.name
  location             = var.location

  account_tier     = var.storage_account_tier
  replication_type = var.storage_account_replication_type

  tags = local.common_tags

  depends_on = [module.resource_group]
}

# Cosmos DB
module "cosmos_db" {
  source = "../../modules/cosmos-db"

  name                = "pcpc-cosmos-${local.environment}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  consistency_level               = var.cosmos_consistency_level
  enable_automatic_failover       = var.cosmos_enable_automatic_failover
  enable_multiple_write_locations = var.cosmos_enable_multiple_write_locations

  tags = local.common_tags

  depends_on = [module.resource_group]
}

# Function App
module "function_app" {
  source = "../../modules/function-app"

  name                = "pcpc-func-${local.environment}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  storage_account_name = module.storage_account.storage_account_name
  storage_account_key  = module.storage_account.primary_access_key

  sku_name = var.function_app_sku_name

  app_settings = merge(
    var.function_app_secrets, # Secrets from Key Vault
    var.function_app_config,  # Non-secret config (with underscores)
    {
      "COSMOS_DB_CONNECTION_STRING"           = module.cosmos_db.primary_sql_connection_string
      "COSMOS_DB_ENDPOINT"                    = module.cosmos_db.endpoint
      "COSMOS_DB_KEY"                         = module.cosmos_db.primary_key
      "WEBSITE_NODE_DEFAULT_VERSION"          = "~22"
      "FUNCTIONS_WORKER_RUNTIME"              = "node"
      "FUNCTIONS_EXTENSION_VERSION"           = "~4"
      "APPINSIGHTS_INSTRUMENTATIONKEY"        = module.application_insights.instrumentation_key
      "APPLICATIONINSIGHTS_CONNECTION_STRING" = module.application_insights.connection_string
    }
  )

  application_insights_id                = module.application_insights.id
  application_insights_key               = module.application_insights.instrumentation_key
  application_insights_connection_string = module.application_insights.connection_string

  tags = local.common_tags

  depends_on = [module.resource_group, module.storage_account, module.cosmos_db, module.application_insights]
}

# Static Web App
module "static_web_app" {
  source = "../../modules/static-web-app"

  name                = "pcpc-swa-${local.environment}"
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

# Log Analytics Workspace
module "log_analytics" {
  source = "../../modules/log-analytics"

  name                = "pcpc-log-${local.environment}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment
  project_name        = var.project_name

  sku               = var.log_analytics_sku
  retention_in_days = var.log_analytics_retention_days
  daily_quota_gb    = var.log_analytics_daily_quota_gb

  tags = local.common_tags

  depends_on = [module.resource_group]
}

# Application Insights
module "application_insights" {
  source = "../../modules/application-insights"

  name                = "pcpc-appi-${local.environment}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment
  project_name        = var.project_name

  application_type = var.application_insights_type
  workspace_id     = module.log_analytics.id

  retention_in_days                     = var.application_insights_retention_days
  daily_data_cap_in_gb                  = var.application_insights_daily_cap_gb
  daily_data_cap_notifications_disabled = var.application_insights_disable_cap_notifications
  sampling_percentage                   = var.application_insights_sampling_percentage

  # Create basic action groups for alerting
  action_groups = [
    {
      name       = "pcpc-critical-alerts"
      short_name = "pcpc-crit"
      email_receivers = [
        {
          name          = "admin"
          email_address = var.alert_email_address
        }
      ]
      webhook_receivers = []
    }
  ]

  # Create basic metric alerts
  metric_alerts = [
    {
      name        = "High Error Rate"
      description = "Triggers when error rate exceeds 5%"
      severity    = 1
      frequency   = "PT1M"
      window_size = "PT5M"
      enabled     = true
      metric_name = "requests/failed"
      aggregation = "Count"
      operator    = "GreaterThan"
      threshold   = 10
    },
    {
      name        = "Slow Response Time"
      description = "Triggers when average response time exceeds 2 seconds"
      severity    = 2
      frequency   = "PT5M"
      window_size = "PT15M"
      enabled     = true
      metric_name = "requests/duration"
      aggregation = "Average"
      operator    = "GreaterThan"
      threshold   = 2000
    }
  ]

  tags = local.common_tags

  depends_on = [module.resource_group, module.log_analytics]
}

# API Management (Optional for dev environment)
module "api_management" {
  count  = var.enable_api_management ? 1 : 0
  source = "../../modules/api-management"

  name                = "pcpc-apim-${local.environment}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  publisher_name  = var.apim_publisher_name
  publisher_email = var.apim_publisher_email
  sku_name        = var.apim_sku_name

  tags = local.common_tags

  depends_on = [module.resource_group]
}
