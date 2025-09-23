# Environment Configuration
variable "environment" {
  description = "The environment name"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "PCPC"
}

variable "location" {
  description = "The Azure region for resources"
  type        = string
  default     = "East US 2"
}

# Storage Account Configuration
variable "storage_account_tier" {
  description = "The tier of the storage account"
  type        = string
  default     = "Standard"
}

variable "storage_account_replication_type" {
  description = "The replication type of the storage account"
  type        = string
  default     = "LRS"
}

# Cosmos DB Configuration
variable "cosmos_offer_type" {
  description = "The offer type for Cosmos DB"
  type        = string
  default     = "Standard"
}

variable "cosmos_kind" {
  description = "The kind of Cosmos DB account"
  type        = string
  default     = "GlobalDocumentDB"
}

variable "cosmos_consistency_level" {
  description = "The consistency level for Cosmos DB"
  type        = string
  default     = "Session"
}

variable "cosmos_max_interval_in_seconds" {
  description = "The max interval in seconds for Cosmos DB consistency"
  type        = number
  default     = 300
}

variable "cosmos_max_staleness_prefix" {
  description = "The max staleness prefix for Cosmos DB consistency"
  type        = number
  default     = 100000
}

variable "cosmos_enable_automatic_failover" {
  description = "Enable automatic failover for Cosmos DB"
  type        = bool
  default     = false
}

variable "cosmos_enable_multiple_write_locations" {
  description = "Enable multiple write locations for Cosmos DB"
  type        = bool
  default     = false
}

variable "cosmos_databases" {
  description = "List of Cosmos DB databases to create"
  type = list(object({
    name       = string
    throughput = number
    containers = list(object({
      name               = string
      partition_key_path = string
      throughput         = number
    }))
  }))
  default = [
    {
      name       = "PokeData"
      throughput = 400
      containers = [
        {
          name               = "cards"
          partition_key_path = "/setId"
          throughput         = 400
        },
        {
          name               = "sets"
          partition_key_path = "/id"
          throughput         = 400
        },
        {
          name               = "pricing-history"
          partition_key_path = "/cardId"
          throughput         = 400
        }
      ]
    }
  ]
}

# Function App Configuration
variable "function_app_sku_name" {
  description = "The SKU name for the Function App service plan"
  type        = string
  default     = "Y1"
}

variable "function_app_settings" {
  description = "Additional app settings for the Function App"
  type        = map(string)
  default = {
    "POKEMON_TCG_API_KEY" = ""
    "ENVIRONMENT"         = "development"
    "LOG_LEVEL"          = "debug"
  }
}

# Static Web App Configuration
variable "static_web_app_location" {
  description = "The location for the Static Web App"
  type        = string
  default     = "East US 2"
}

variable "static_web_app_sku_tier" {
  description = "The SKU tier for the Static Web App"
  type        = string
  default     = "Free"
}

variable "static_web_app_sku_size" {
  description = "The SKU size for the Static Web App"
  type        = string
  default     = "Free"
}

variable "static_web_app_settings" {
  description = "App settings for the Static Web App"
  type        = map(string)
  default = {
    "ENVIRONMENT" = "development"
    "DEBUG_MODE"  = "true"
  }
}

# API Management Configuration
variable "enable_api_management" {
  description = "Whether to enable API Management"
  type        = bool
  default     = false
}

variable "apim_publisher_name" {
  description = "The publisher name for API Management"
  type        = string
  default     = "PCPC Development"
}

variable "apim_publisher_email" {
  description = "The publisher email for API Management"
  type        = string
  default     = "dev@pcpc.local"
}

variable "apim_sku_name" {
  description = "The SKU name for API Management"
  type        = string
  default     = "Developer_1"
}
