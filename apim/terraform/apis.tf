# -----------------------------------------------------------------------------
# API DEFINITIONS
# -----------------------------------------------------------------------------

# PCPC API Definition
resource "azurerm_api_management_api" "pcpc_api" {
  name                  = "pcpc-api-${var.environment}"
  resource_group_name   = var.resource_group_name
  api_management_name   = var.api_management_name
  revision              = "1"
  display_name          = "Pokemon Card Price Checker API"
  path                  = "api/${var.api_version}"
  protocols             = ["https"]
  service_url           = local.function_app_url
  subscription_required = true

  description = "API for retrieving Pokemon card sets, cards, and pricing information"

  # Import OpenAPI specification
  import {
    content_format = "openapi+json"
    content_value  = file("${path.module}/../specs/pcpc-api-v1.yaml")
  }
}

# -----------------------------------------------------------------------------
# BACKEND CONFIGURATION
# -----------------------------------------------------------------------------

# Azure Functions Backend
resource "azurerm_api_management_backend" "function_app" {
  name                = "pcpc-function-backend-${var.environment}"
  resource_group_name = var.resource_group_name
  api_management_name = var.api_management_name
  protocol            = "http"
  url                 = local.function_app_url
  description         = "Backend for ${var.function_app_name} Azure Functions"

  credentials {
    header = {
      "x-functions-key" = var.function_app_key
    }
  }

  tls {
    validate_certificate_chain = true
    validate_certificate_name  = true
  }
}

# -----------------------------------------------------------------------------
# API OPERATIONS
# -----------------------------------------------------------------------------

# Get Set List Operation
resource "azurerm_api_management_api_operation" "get_sets" {
  operation_id        = "get-set-list"
  api_name            = azurerm_api_management_api.pcpc_api.name
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  display_name        = "Get Set List"
  method              = "GET"
  url_template        = "/sets"
  description         = "Returns a paginated list of all Pokemon card sets"

  request {
    query_parameter {
      name          = "language"
      type          = "string"
      description   = "Filter sets by language (ENGLISH, JAPANESE, or ALL)"
      values        = ["ENGLISH", "JAPANESE", "ALL"]
      default_value = "ENGLISH"
      required      = false
    }

    query_parameter {
      name          = "page"
      type          = "integer"
      description   = "Page number for pagination (minimum 1)"
      default_value = "1"
      required      = false
    }

    query_parameter {
      name          = "pageSize"
      type          = "integer"
      description   = "Number of items per page (1-100)"
      default_value = "100"
      required      = false
    }

    query_parameter {
      name          = "all"
      type          = "boolean"
      description   = "Return all sets without pagination"
      default_value = "false"
      required      = false
    }

    query_parameter {
      name          = "forceRefresh"
      type          = "boolean"
      description   = "Force refresh of cached data"
      default_value = "false"
      required      = false
    }
  }

  response {
    status_code = 200
    description = "Successful response with set list"
    representation {
      content_type = "application/json"
    }
  }

  response {
    status_code = 400
    description = "Bad request - invalid parameters"
    representation {
      content_type = "application/json"
    }
  }

  response {
    status_code = 404
    description = "No sets found for specified criteria"
    representation {
      content_type = "application/json"
    }
  }
}

# Get Cards By Set Operation
resource "azurerm_api_management_api_operation" "get_cards_by_set" {
  operation_id        = "get-cards-by-set"
  api_name            = azurerm_api_management_api.pcpc_api.name
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  display_name        = "Get Cards By Set"
  method              = "GET"
  url_template        = "/sets/{setCode}/cards"
  description         = "Returns cards for a specific Pokemon card set"

  template_parameter {
    name        = "setCode"
    type        = "string"
    description = "The set code (e.g., 'sv8', 'base1')"
    required    = true
  }

  request {
    query_parameter {
      name          = "page"
      type          = "integer"
      description   = "Page number for pagination (minimum 1)"
      default_value = "1"
      required      = false
    }

    query_parameter {
      name          = "pageSize"
      type          = "integer"
      description   = "Number of cards per page (1-100)"
      default_value = "50"
      required      = false
    }

    query_parameter {
      name          = "forceRefresh"
      type          = "boolean"
      description   = "Force refresh of cached data"
      default_value = "false"
      required      = false
    }
  }

  response {
    status_code = 200
    description = "Successful response with cards for the set"
    representation {
      content_type = "application/json"
    }
  }

  response {
    status_code = 400
    description = "Bad request - invalid set code or parameters"
    representation {
      content_type = "application/json"
    }
  }

  response {
    status_code = 404
    description = "Set not found or no cards available"
    representation {
      content_type = "application/json"
    }
  }
}

# Get Card Info Operation
resource "azurerm_api_management_api_operation" "get_card_info" {
  operation_id        = "get-card-info"
  api_name            = azurerm_api_management_api.pcpc_api.name
  api_management_name = var.api_management_name
  resource_group_name = var.resource_group_name
  display_name        = "Get Card Info"
  method              = "GET"
  url_template        = "/sets/{setId}/cards/{cardId}"
  description         = "Returns detailed information for a specific Pokemon card"

  template_parameter {
    name        = "setId"
    type        = "string"
    description = "The set identifier"
    required    = true
  }

  template_parameter {
    name        = "cardId"
    type        = "string"
    description = "The card identifier within the set"
    required    = true
  }

  request {
    query_parameter {
      name          = "forceRefresh"
      type          = "boolean"
      description   = "Force refresh of cached pricing data"
      default_value = "false"
      required      = false
    }
  }

  response {
    status_code = 200
    description = "Successful response with detailed card information"
    representation {
      content_type = "application/json"
    }
  }

  response {
    status_code = 400
    description = "Bad request - invalid set or card identifiers"
    representation {
      content_type = "application/json"
    }
  }

  response {
    status_code = 404
    description = "Card not found"
    representation {
      content_type = "application/json"
    }
  }
}
