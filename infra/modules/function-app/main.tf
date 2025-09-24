# -----------------------------------------------------------------------------
# LOCALS
# -----------------------------------------------------------------------------

locals {
  default_cors_origins = [
    "https://functions.azure.com",
    "https://functions-staging.azure.com",
  ]
  merged_cors_origins = distinct(concat(local.default_cors_origins, var.cors_allowed_origins))
  # Merge default tags with user-provided tags
  common_tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "function-app"
    },
    var.tags
  )

  # Environment-specific configurations
  env_config = {
    dev = {
      always_on            = false
      min_instances        = 0
      max_burst            = 10
      health_check_enabled = false
    }
    staging = {
      always_on            = false
      min_instances        = 1
      max_burst            = 50
      health_check_enabled = true
    }
    prod = {
      always_on            = var.sku_name != "Y1" # Not available for consumption
      min_instances        = 2
      max_burst            = 100
      health_check_enabled = true
    }
  }

  selected_config = local.env_config[var.environment]

  # Determine if we need to create a service plan
  create_service_plan = var.service_plan_id == null

  # Build app settings with defaults - simplified for Node.js
  default_app_settings = {
    "FUNCTIONS_WORKER_RUNTIME"     = "node"
    "WEBSITE_RUN_FROM_PACKAGE"     = "1"
  }

  app_settings = merge(local.default_app_settings, var.app_settings)
}

# -----------------------------------------------------------------------------
# STORAGE ACCOUNT (Optional - create if not provided)
# -----------------------------------------------------------------------------

resource "azurerm_storage_account" "this" {
  count = var.storage_account_name == "" ? 1 : 0

  name                     = "${replace(var.name, "-", "")}st"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = var.environment == "prod" ? "GRS" : "LRS"
  min_tls_version          = "TLS1_2"

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# APP SERVICE PLAN (Create if not provided)
# -----------------------------------------------------------------------------

resource "azurerm_service_plan" "this" {
  count = local.create_service_plan ? 1 : 0

  name                = "${var.name}-plan"
  location            = var.location
  resource_group_name = var.resource_group_name
  os_type             = var.os_type
  sku_name            = var.sku_name

  # Premium plan features
  maximum_elastic_worker_count = var.sku_name == "EP1" || var.sku_name == "EP2" || var.sku_name == "EP3" ? var.app_scale_limit : null
  worker_count                 = var.sku_name != "Y1" ? var.elastic_instance_minimum : null

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# APPLICATION INSIGHTS (Create if enabled but not provided)
# -----------------------------------------------------------------------------

resource "azurerm_application_insights" "this" {
  count = var.application_insights_enabled && var.application_insights_id == null ? 1 : 0

  name                = "${var.name}-insights"
  location            = var.location
  resource_group_name = var.resource_group_name
  application_type    = "web"
  retention_in_days   = var.environment == "prod" ? 90 : 30

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# FUNCTION APP - WINDOWS
# -----------------------------------------------------------------------------

resource "azurerm_windows_function_app" "this" {
  count = var.os_type == "Windows" ? 1 : 0

  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  service_plan_id     = local.create_service_plan ? azurerm_service_plan.this[0].id : var.service_plan_id

  storage_account_name       = var.storage_account_name != "" ? var.storage_account_name : azurerm_storage_account.this[0].name
  storage_account_access_key = var.storage_account_key != "" ? var.storage_account_key : azurerm_storage_account.this[0].primary_access_key

  functions_extension_version = "~4"
  builtin_logging_enabled     = false
  enabled                     = true

  https_only                    = var.https_only
  public_network_access_enabled = var.environment == "dev" ? true : true # Can be restricted in prod
  client_certificate_enabled    = false
  client_certificate_mode       = "Required"

  # Authentication settings
  ftp_publish_basic_authentication_enabled       = var.environment == "dev"
  webdeploy_publish_basic_authentication_enabled = var.environment == "dev"

  # Virtual network integration
  virtual_network_subnet_id = var.virtual_network_subnet_id

  # Application settings
  # Note: Application Insights settings are configured in site_config block to prevent drift
  app_settings = local.app_settings
  lifecycle {
    ignore_changes = [
      app_settings["WEBSITE_NODE_DEFAULT_VERSION"],
    ]
  }

  # Managed identity
  dynamic "identity" {
    for_each = var.identity_type != null ? [1] : []
    content {
      type         = var.identity_type
      identity_ids = var.identity_ids
    }
  }

  site_config {
    always_on              = local.selected_config.always_on && var.sku_name != "Y1"
    ftps_state             = var.ftps_state
    minimum_tls_version    = var.minimum_tls_version
    http2_enabled          = true
    websockets_enabled     = false
    use_32_bit_worker      = var.sku_name == "Y1" || var.sku_name == "F1"
    vnet_route_all_enabled = var.virtual_network_subnet_id != null
    cors {
      allowed_origins     = local.merged_cors_origins
      support_credentials = var.cors_support_credentials
    }

    # Scaling
    app_scale_limit           = var.app_scale_limit
    elastic_instance_minimum  = var.elastic_instance_minimum
    pre_warmed_instance_count = var.pre_warmed_instance_count

    # Health check
    health_check_path                 = local.selected_config.health_check_enabled ? "/api/health" : null
    health_check_eviction_time_in_min = local.selected_config.health_check_enabled ? 5 : null

    # Application insights
    application_insights_connection_string = var.application_insights_enabled ? (
      var.application_insights_connection_string != null ? var.application_insights_connection_string : azurerm_application_insights.this[0].connection_string
    ) : null
    application_insights_key = var.application_insights_enabled ? (
      var.application_insights_key != null ? var.application_insights_key : azurerm_application_insights.this[0].instrumentation_key
    ) : null

    # Runtime stack - simplified for Node.js only
    dynamic "application_stack" {
      for_each = [1]
      content {
        node_version = "~22"
      }
    }

    # IP restrictions
    dynamic "ip_restriction" {
      for_each = var.ip_restrictions
      content {
        name                      = ip_restriction.value.name
        priority                  = ip_restriction.value.priority
        action                    = ip_restriction.value.action
        ip_address                = ip_restriction.value.ip_address
        virtual_network_subnet_id = ip_restriction.value.virtual_network_subnet_id
        service_tag               = ip_restriction.value.service_tag
      }
    }
  }

  tags = local.common_tags
}

# -----------------------------------------------------------------------------
# FUNCTION APP - LINUX
# -----------------------------------------------------------------------------

resource "azurerm_linux_function_app" "this" {
  count = var.os_type == "Linux" ? 1 : 0

  name                = var.name
  location            = var.location
  resource_group_name = var.resource_group_name
  service_plan_id     = local.create_service_plan ? azurerm_service_plan.this[0].id : var.service_plan_id

  storage_account_name       = var.storage_account_name != "" ? var.storage_account_name : azurerm_storage_account.this[0].name
  storage_account_access_key = var.storage_account_key != "" ? var.storage_account_key : azurerm_storage_account.this[0].primary_access_key

  functions_extension_version = "~4"
  builtin_logging_enabled     = false
  enabled                     = true

  https_only                    = var.https_only
  public_network_access_enabled = var.environment == "dev" ? true : true
  client_certificate_enabled    = false
  client_certificate_mode       = "Required"

  # Authentication settings
  ftp_publish_basic_authentication_enabled = var.environment == "dev"

  # Virtual network integration
  virtual_network_subnet_id = var.virtual_network_subnet_id

  # Application settings
  # Note: Application Insights settings are configured in site_config block to prevent drift
  app_settings = local.app_settings

  # Managed identity
  dynamic "identity" {
    for_each = var.identity_type != null ? [1] : []
    content {
      type         = var.identity_type
      identity_ids = var.identity_ids
    }
  }

  site_config {
    always_on              = local.selected_config.always_on && var.sku_name != "Y1"
    ftps_state             = var.ftps_state
    minimum_tls_version    = var.minimum_tls_version
    http2_enabled          = true
    websockets_enabled     = false
    vnet_route_all_enabled = var.virtual_network_subnet_id != null
    cors {
      allowed_origins     = local.merged_cors_origins
      support_credentials = var.cors_support_credentials
    }

    # Scaling
    app_scale_limit           = var.app_scale_limit
    elastic_instance_minimum  = var.elastic_instance_minimum
    pre_warmed_instance_count = var.pre_warmed_instance_count

    # Health check
    health_check_path                 = local.selected_config.health_check_enabled ? "/api/health" : null
    health_check_eviction_time_in_min = local.selected_config.health_check_enabled ? 5 : null

    # Application insights
    application_insights_connection_string = var.application_insights_enabled ? (
      var.application_insights_connection_string != null ? var.application_insights_connection_string : azurerm_application_insights.this[0].connection_string
    ) : null
    application_insights_key = var.application_insights_enabled ? (
      var.application_insights_key != null ? var.application_insights_key : azurerm_application_insights.this[0].instrumentation_key
    ) : null

    # Runtime stack - simplified for Node.js only
    dynamic "application_stack" {
      for_each = [1]
      content {
        node_version = "~22"
      }
    }

    # IP restrictions
    dynamic "ip_restriction" {
      for_each = var.ip_restrictions
      content {
        name                      = ip_restriction.value.name
        priority                  = ip_restriction.value.priority
        action                    = ip_restriction.value.action
        ip_address                = ip_restriction.value.ip_address
        virtual_network_subnet_id = ip_restriction.value.virtual_network_subnet_id
        service_tag               = ip_restriction.value.service_tag
      }
    }
  }

  tags = local.common_tags
}
