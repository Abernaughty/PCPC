terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.47.0, < 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    # Kept while pending-destroy SWA + porkbun_dns_record + time_sleep are still
    # in state. Remove in the follow-up cleanup PR once `terraform apply` has
    # destroyed those resources in all three envs.
    porkbun = {
      source  = "marcfrederick/porkbun"
      version = ">= 1.3.1"
    }
    time = {
      source  = "hashicorp/time"
      version = ">= 0.9.1"
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

# Kept until the destroy applies — porkbun_dns_record + time_sleep resources
# still exist in state and need their providers configured. Remove in the
# follow-up cleanup PR.
provider "porkbun" {
  api_key        = var.porkbun_api_key
  secret_api_key = var.porkbun_secret_key
}

provider "time" {}

data "azurerm_client_config" "current" {}

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
    # CreatedDate = formatdate("YYYY-MM-DD", timestamp())
    Repository = "PCPC"
  }

  function_app_secret_exclusions = [
    "ARM_CLIENT_ID",
    "ARM_CLIENT_SECRET",
  ]

  function_app_secrets_filtered = {
    for key, value in var.function_app_secrets :
    key => value
    if !contains(local.function_app_secret_exclusions, replace(key, "-", "_"))
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

module "key_vault" {
  source = "../../modules/key-vault"

  name                = "pcpc-kv-${local.environment}"
  location            = var.location
  resource_group_name = module.resource_group.name
  environment         = var.environment
  tenant_id           = data.azurerm_client_config.current.tenant_id

  sku_name                        = var.key_vault_sku_name
  soft_delete_retention_days      = var.key_vault_soft_delete_retention_days
  purge_protection_enabled        = var.key_vault_purge_protection_enabled
  public_network_access_enabled   = var.key_vault_public_network_access_enabled
  enabled_for_deployment          = var.key_vault_enabled_for_deployment
  enabled_for_disk_encryption     = var.key_vault_enabled_for_disk_encryption
  enabled_for_template_deployment = var.key_vault_enabled_for_template_deployment
  network_acls                    = var.key_vault_network_acls
  access_policies                 = var.key_vault_access_policies
  rbac_assignments                = var.key_vault_rbac_assignments

  tags = local.common_tags

  depends_on = [module.resource_group]
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

# File share to host Function App content (ensures app uses the Terraform-managed storage account)
resource "azurerm_storage_share" "function_app_content" {
  name               = "pcpc-func-${local.environment}"
  storage_account_id = module.storage_account.storage_account_id
  quota              = 1024

  depends_on = [module.storage_account]
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
    local.function_app_secrets_filtered, # Secrets from Key Vault (filtered)
    var.function_app_config,             # Non-secret config (with underscores)
    {
      "COSMOS_DB_CONNECTION_STRING"              = module.cosmos_db.primary_sql_connection_string
      "COSMOS_DB_ENDPOINT"                       = module.cosmos_db.endpoint
      "COSMOS_DB_KEY"                            = module.cosmos_db.primary_key
      "FUNCTIONS_WORKER_RUNTIME"                 = "node"
      "APPINSIGHTS_INSTRUMENTATIONKEY"           = module.application_insights.instrumentation_key
      "APPLICATIONINSIGHTS_CONNECTION_STRING"    = module.application_insights.connection_string
      "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING" = module.storage_account.primary_connection_string
      "WEBSITE_CONTENTSHARE"                     = azurerm_storage_share.function_app_content.name
    }
  )

  external_app_settings_preserve_keys = ["DEPLOY_PACKAGE_HASH"]
  subscription_id                     = data.azurerm_client_config.current.subscription_id

  application_insights_id                = module.application_insights.id
  application_insights_key               = module.application_insights.instrumentation_key
  application_insights_connection_string = module.application_insights.connection_string
  create_application_insights            = false

  tags = local.common_tags

  depends_on = [module.resource_group, module.storage_account, module.cosmos_db, module.application_insights]
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

  # Phase 1B: bind dev-api.pcpc.maber.io to the gateway with an Azure-managed
  # cert. The CNAME record (dev-api.pcpc.maber.io -> pcpc-apim-dev.azure-api.net)
  # must exist in Cloudflare before this applies.
  gateway_hostnames = var.apim_gateway_hostnames

  tags = local.common_tags

  depends_on = [module.resource_group]
}

# -----------------------------------------------------------------------------
# Phase 2.2 — Path C (ACA Container)
#
# The ACR consumed by this Container App lives in `pcpc-rg-shared` (PR 2.5),
# not in `pcpc-rg-dev`. Each env's TF reads the shared ACR via
# `data.terraform_remote_state.shared` and scopes its own UAMI's AcrPull
# role assignment to that ACR. Dev/staging/prod all consume symmetrically.
# See ADR-009's "ACR ownership" subsection for the rationale.
# -----------------------------------------------------------------------------

data "terraform_remote_state" "shared" {
  backend = "azurerm"
  config = {
    resource_group_name  = "pcpc-terraform-state-rg"
    storage_account_name = "pcpctfstatedacc29c2"
    container_name       = "tfstate"
    key                  = "shared.terraform.tfstate"
    tenant_id            = "5f445a68-ec75-42cf-a50f-6ec158ee675c"
    subscription_id      = "555b4cfa-ad2e-4c71-9433-620a59cf7616"
  }
}

module "container_app" {
  source = "../../modules/container-app"

  name                = "pcpc-aca-${local.environment}"
  resource_group_name = module.resource_group.name
  location            = var.location
  environment         = var.environment

  log_analytics_workspace_id = module.log_analytics.id

  acr_id           = data.terraform_remote_state.shared.outputs.acr_id
  acr_login_server = data.terraform_remote_state.shared.outputs.acr_login_server
  image_repository = var.container_app_image_repository
  image_tag        = var.container_app_image_tag

  min_replicas     = var.container_app_min_replicas
  max_replicas     = var.container_app_max_replicas
  cpu              = var.container_app_cpu
  memory           = var.container_app_memory
  http_concurrency = var.container_app_http_concurrency

  cors_allowed_origins = var.container_app_cors_allowed_origins

  # Non-secret env vars: same shape Path B uses (cosmos config, runtime
  # flags, App Insights endpoint references). Container-runtime additions:
  # FUNCTIONS_WORKER_RUNTIME (required) and AzureWebJobsStorage (set via
  # secret_settings below).
  app_settings = merge(
    var.function_app_config, # non-secret config shared with Path B
    {
      "COSMOS_DB_ENDPOINT"                    = module.cosmos_db.endpoint
      "FUNCTIONS_WORKER_RUNTIME"              = "node"
      "APPINSIGHTS_INSTRUMENTATIONKEY"        = module.application_insights.instrumentation_key
      "APPLICATIONINSIGHTS_CONNECTION_STRING" = module.application_insights.connection_string
      "AZURE_FUNCTIONS_ENVIRONMENT"           = var.environment
    }
  )

  # Secret env vars. Note we DO NOT carry over the Consumption-only
  # WEBSITE_CONTENTAZUREFILECONNECTIONSTRING / WEBSITE_CONTENTSHARE
  # settings here — those are file-share settings for the Functions
  # Consumption plan, irrelevant in a container runtime.
  secret_settings = merge(
    local.function_app_secrets_filtered, # Scrydex creds (same map Path B uses)
    {
      "COSMOS_DB_CONNECTION_STRING" = module.cosmos_db.primary_sql_connection_string
      "COSMOS_DB_KEY"               = module.cosmos_db.primary_key
      "AzureWebJobsStorage"         = module.storage_account.primary_connection_string
    }
  )

  tags = local.common_tags

  depends_on = [
    module.resource_group,
    module.storage_account,
    module.cosmos_db,
    module.application_insights,
    module.log_analytics,
  ]
}
