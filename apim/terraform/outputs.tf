# -----------------------------------------------------------------------------
# API MANAGEMENT OUTPUTS
# -----------------------------------------------------------------------------

output "api_management_name" {
  description = "Name of the API Management instance"
  value       = data.azurerm_api_management.existing.name
}

output "api_management_id" {
  description = "ID of the API Management instance"
  value       = data.azurerm_api_management.existing.id
}

output "api_management_gateway_url" {
  description = "Gateway URL of the API Management instance"
  value       = data.azurerm_api_management.existing.gateway_url
}

output "api_management_portal_url" {
  description = "Developer portal URL of the API Management instance"
  value       = data.azurerm_api_management.existing.developer_portal_url
}

# -----------------------------------------------------------------------------
# API OUTPUTS
# -----------------------------------------------------------------------------

output "pcpc_api_name" {
  description = "Name of the PCPC API"
  value       = azurerm_api_management_api.pcpc_api.name
}

output "pcpc_api_id" {
  description = "ID of the PCPC API"
  value       = azurerm_api_management_api.pcpc_api.id
}

output "pcpc_api_path" {
  description = "Path of the PCPC API"
  value       = azurerm_api_management_api.pcpc_api.path
}

output "pcpc_api_service_url" {
  description = "Service URL of the PCPC API"
  value       = azurerm_api_management_api.pcpc_api.service_url
}

# -----------------------------------------------------------------------------
# BACKEND OUTPUTS
# -----------------------------------------------------------------------------

output "function_app_backend_name" {
  description = "Name of the Function App backend"
  value       = azurerm_api_management_backend.function_app.name
}

output "function_app_backend_url" {
  description = "URL of the Function App backend"
  value       = azurerm_api_management_backend.function_app.url
}

output "function_app_name" {
  description = "Name of the Azure Function App"
  value       = var.function_app_name
}

output "function_app_url" {
  description = "URL of the Azure Function App"
  value       = local.function_app_url
}

# -----------------------------------------------------------------------------
# OPERATION OUTPUTS
# -----------------------------------------------------------------------------

output "api_operations" {
  description = "List of API operations"
  value = {
    get_sets = {
      operation_id = azurerm_api_management_api_operation.get_sets.operation_id
      method       = azurerm_api_management_api_operation.get_sets.method
      url_template = azurerm_api_management_api_operation.get_sets.url_template
    }
    get_cards_by_set = {
      operation_id = azurerm_api_management_api_operation.get_cards_by_set.operation_id
      method       = azurerm_api_management_api_operation.get_cards_by_set.method
      url_template = azurerm_api_management_api_operation.get_cards_by_set.url_template
    }
    get_card_info = {
      operation_id = azurerm_api_management_api_operation.get_card_info.operation_id
      method       = azurerm_api_management_api_operation.get_card_info.method
      url_template = azurerm_api_management_api_operation.get_card_info.url_template
    }
  }
}

# -----------------------------------------------------------------------------
# PRODUCT OUTPUTS
# -----------------------------------------------------------------------------

output "products" {
  description = "API Management products"
  value = {
    for k, v in azurerm_api_management_product.products : k => {
      product_id            = v.product_id
      display_name          = v.display_name
      published             = v.published
      subscription_required = v.subscription_required
    }
  }
}

# CONFIGURATION OUTPUTS
# -----------------------------------------------------------------------------

output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "cors_origins" {
  description = "Configured CORS origins"
  value       = var.cors_origins
}

output "rate_limiting" {
  description = "Rate limiting configuration"
  value = {
    calls  = var.rate_limit_calls
    period = var.rate_limit_period
  }
}

output "caching_configuration" {
  description = "Caching configuration"
  value = {
    enabled                  = var.enable_caching
    cache_duration_sets      = var.cache_duration_sets
    cache_duration_cards     = var.cache_duration_cards
    cache_duration_card_info = var.cache_duration_card_info
  }
}

# -----------------------------------------------------------------------------
# MONITORING OUTPUTS
# -----------------------------------------------------------------------------

output "monitoring_configuration" {
  description = "Monitoring and logging configuration"
  value = {
    application_insights_enabled = var.enable_application_insights
    application_insights_name    = var.application_insights_name
    detailed_logging_enabled     = var.enable_detailed_logging
    log_retention_days           = var.log_retention_days
  }
}

output "application_insights_logger_id" {
  description = "ID of the Application Insights logger (if enabled)"
  value       = var.enable_application_insights && var.application_insights_name != "" ? azurerm_api_management_logger.application_insights[0].id : null
}

# -----------------------------------------------------------------------------
# API ENDPOINTS
# -----------------------------------------------------------------------------

output "api_endpoints" {
  description = "Complete API endpoint URLs"
  value = {
    base_url = "${data.azurerm_api_management.existing.gateway_url}/${azurerm_api_management_api.pcpc_api.path}"
    endpoints = {
      get_sets         = "${data.azurerm_api_management.existing.gateway_url}/${azurerm_api_management_api.pcpc_api.path}/sets"
      get_cards_by_set = "${data.azurerm_api_management.existing.gateway_url}/${azurerm_api_management_api.pcpc_api.path}/sets/{setCode}/cards"
      get_card_info    = "${data.azurerm_api_management.existing.gateway_url}/${azurerm_api_management_api.pcpc_api.path}/sets/{setId}/cards/{cardId}"
    }
  }
}

# -----------------------------------------------------------------------------
# DEPLOYMENT INFORMATION
# -----------------------------------------------------------------------------

output "deployment_info" {
  description = "Deployment information and metadata"
  value = {
    environment       = var.environment
    api_version       = var.api_version
    terraform_version = "~> 1.13.0"
    azurerm_version   = "~> 3.60"
    deployment_time   = timestamp()
    resource_group    = var.resource_group_name
    subscription_id   = data.azurerm_client_config.current.subscription_id
  }
}
