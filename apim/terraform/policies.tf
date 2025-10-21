# -----------------------------------------------------------------------------
# GLOBAL POLICIES
# -----------------------------------------------------------------------------

# Global API policy (CORS, rate limiting, etc.)
resource "azurerm_api_management_api_policy" "pcpc_api_global" {
  api_name            = azurerm_api_management_api.pcpc_api.name
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name

  xml_content = local.rendered_global_policy

  depends_on = [azurerm_api_management_api.pcpc_api]
}

# -----------------------------------------------------------------------------
# OPERATION-SPECIFIC POLICIES
# -----------------------------------------------------------------------------

locals {
  operation_policy_map = {
    get_sets = {
      operation_id = azurerm_api_management_api_operation.get_sets.operation_id
      xml_content  = local.rendered_operation_policies["get_sets"]
    }
    get_cards_by_set = {
      operation_id = azurerm_api_management_api_operation.get_cards_by_set.operation_id
      xml_content  = local.rendered_operation_policies["get_cards_by_set"]
    }
    get_card_info = {
      operation_id = azurerm_api_management_api_operation.get_card_info.operation_id
      xml_content  = local.rendered_operation_policies["get_card_info"]
    }
  }
}

# Combined backend and caching policy for Get Set List operation
resource "azurerm_api_management_api_operation_policy" "operation_policies" {
  for_each = local.operation_policy_map

  api_name            = azurerm_api_management_api.pcpc_api.name
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  operation_id        = each.value.operation_id

  xml_content = each.value.xml_content

  depends_on = [
    azurerm_api_management_backend.function_app,
    azurerm_api_management_api_operation.get_sets,
    azurerm_api_management_api_operation.get_cards_by_set,
    azurerm_api_management_api_operation.get_card_info
  ]
}

# -----------------------------------------------------------------------------
# PRODUCTS AND SUBSCRIPTIONS
# -----------------------------------------------------------------------------

# Create API Management products
resource "azurerm_api_management_product" "products" {
  for_each = var.products

  api_management_name   = var.api_management_name
  resource_group_name   = var.resource_group_name
  product_id            = each.key
  display_name          = each.value.display_name
  description           = each.value.description
  published             = each.value.published
  approval_required     = each.value.approval_required
  subscription_required = each.value.subscription_required
  subscriptions_limit   = each.value.subscriptions_limit
}

# Associate API with products
resource "azurerm_api_management_product_api" "pcpc_api_products" {
  for_each = var.products

  api_name            = azurerm_api_management_api.pcpc_api.name
  product_id          = azurerm_api_management_product.products[each.key].product_id
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name

  depends_on = [
    azurerm_api_management_api.pcpc_api,
    azurerm_api_management_product.products
  ]
}

# -----------------------------------------------------------------------------
# LOGGING AND MONITORING
# -----------------------------------------------------------------------------

# API Management Logger (if Application Insights is enabled)
resource "azurerm_api_management_logger" "application_insights" {
  count = var.enable_application_insights && var.application_insights_name != "" ? 1 : 0

  name                = "applicationinsights-logger-${var.environment}"
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  resource_id         = "/subscriptions/${data.azurerm_client_config.current.subscription_id}/resourceGroups/${var.resource_group_name}/providers/Microsoft.Insights/components/${var.application_insights_name}"

  application_insights {
    instrumentation_key = data.azurerm_application_insights.existing[0].instrumentation_key
  }
}

# Get current client configuration
data "azurerm_client_config" "current" {}

# Get existing Application Insights instance
data "azurerm_application_insights" "existing" {
  count = var.enable_application_insights && var.application_insights_name != "" ? 1 : 0

  name                = var.application_insights_name
  resource_group_name = var.resource_group_name
}

# API Management Diagnostic Settings
resource "azurerm_api_management_api_diagnostic" "pcpc_api_diagnostics" {
  count = var.enable_application_insights && var.application_insights_name != "" ? 1 : 0

  identifier               = "applicationinsights"
  resource_group_name      = var.resource_group_name
  api_management_name      = var.api_management_name
  api_name                 = azurerm_api_management_api.pcpc_api.name
  api_management_logger_id = azurerm_api_management_logger.application_insights[0].id

  sampling_percentage       = 100.0
  always_log_errors         = true
  log_client_ip             = true
  verbosity                 = var.enable_detailed_logging ? "verbose" : "information"
  http_correlation_protocol = "W3C"

  frontend_request {
    body_bytes = var.enable_detailed_logging ? 8192 : 0
    headers_to_log = var.enable_detailed_logging ? [
      "Content-Type",
      "User-Agent",
      "X-Correlation-ID"
    ] : []
  }

  frontend_response {
    body_bytes = var.enable_detailed_logging ? 8192 : 0
    headers_to_log = var.enable_detailed_logging ? [
      "Content-Type",
      "X-RateLimit-Remaining",
      "X-Powered-By"
    ] : []
  }

  backend_request {
    body_bytes = var.enable_detailed_logging ? 8192 : 0
    headers_to_log = var.enable_detailed_logging ? [
      "Content-Type",
      "X-Correlation-ID",
      "X-Environment"
    ] : []
  }

  backend_response {
    body_bytes = var.enable_detailed_logging ? 8192 : 0
    headers_to_log = var.enable_detailed_logging ? [
      "Content-Type"
    ] : []
  }

  depends_on = [
    azurerm_api_management_api.pcpc_api,
    azurerm_api_management_logger.application_insights
  ]
}
