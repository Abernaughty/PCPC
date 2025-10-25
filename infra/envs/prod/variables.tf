# Environment Configuration
variable "environment" {
  description = "The environment name"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "PCPC"
}

variable "location" {
  description = "The Azure region for resources"
  type        = string
  default     = "Central US"
}

variable "enable_debug_outputs" {
  description = "When true, emits debug outputs that list function app configuration keys."
  type        = bool
  default     = false
}

# Key Vault Configuration
variable "key_vault_sku_name" {
  description = "SKU for the Key Vault"
  type        = string
  default     = "standard"
}

variable "key_vault_soft_delete_retention_days" {
  description = "Soft delete retention for Key Vault secrets"
  type        = number
  default     = 90
}

variable "key_vault_purge_protection_enabled" {
  description = "Enable purge protection on the Key Vault"
  type        = bool
  default     = true
}

variable "key_vault_public_network_access_enabled" {
  description = "Allow public network access to the Key Vault"
  type        = bool
  default     = true
}

variable "key_vault_enabled_for_deployment" {
  description = "Allow Azure Resource Manager to retrieve secrets"
  type        = bool
  default     = false
}

variable "key_vault_enabled_for_disk_encryption" {
  description = "Allow Azure Disk Encryption to retrieve secrets"
  type        = bool
  default     = false
}

variable "key_vault_enabled_for_template_deployment" {
  description = "Allow template deployments to retrieve secrets"
  type        = bool
  default     = false
}

variable "key_vault_network_acls" {
  description = "Optional network ACL configuration for the Key Vault"
  type        = any
  default     = null
}

variable "key_vault_access_policies" {
  description = "List of Key Vault access policies to apply"
  type        = list(map(any))
  default     = []
}

variable "key_vault_rbac_assignments" {
  description = "List of RBAC role assignments for the Key Vault"
  type        = list(map(any))
  default     = []
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
  default     = "GRS" # Geo-redundant for production
}

# Cosmos DB Configuration
variable "cosmos_consistency_level" {
  description = "The consistency level for Cosmos DB"
  type        = string
  default     = "Session"
}

variable "cosmos_enable_automatic_failover" {
  description = "Enable automatic failover for Cosmos DB"
  type        = bool
  default     = true # Always enabled for production
}

variable "cosmos_enable_multiple_write_locations" {
  description = "Enable multiple write locations for Cosmos DB"
  type        = bool
  default     = false # Can be enabled for global distribution
}

# Function App Configuration
variable "function_app_sku_name" {
  description = "The SKU name for the Function App service plan"
  type        = string
  default     = "Y1" # Consumption plan (can upgrade to Premium for production needs)
}

variable "function_app_secrets" {
  description = "Secrets from Azure Key Vault for the Function App (with hyphens as required by Key Vault)"
  type        = map(string)
  sensitive   = true
  default     = {}
}

variable "function_app_config" {
  description = "Non-secret configuration for the Function App"
  type        = map(string)
  default = {
    # Environment Configuration
    "ENVIRONMENT" = "production"
    "LOG_LEVEL"   = "warn"
    "NODE_ENV"    = "production"
    "DEBUG_MODE"  = "false"

    # Cosmos DB Configuration
    "COSMOS_DB_DATABASE_NAME"        = "PokemonCards"
    "COSMOS_DB_CARDS_CONTAINER_NAME" = "Cards"
    "COSMOS_DB_SETS_CONTAINER_NAME"  = "Sets"

    # API Configuration
    "POKEMON_TCG_API_BASE_URL" = "https://api.pokemontcg.io/v2"
    "POKEDATA_API_BASE_URL"    = "https://www.pokedata.io/v0"

    # Storage Configuration
    "AZURE_STORAGE_CONTAINER_NAME" = "images"

    # Feature Flags
    "CREDIT_MONITORING_ENABLED" = "true"
    "ENABLE_CACHING"            = "true"
    "ENABLE_IMAGE_ENHANCEMENT"  = "true"
    "ENABLE_CREDIT_MONITORING"  = "true"
    "ENABLE_REDIS_CACHE"        = "false"

    # Credit Monitoring Thresholds
    "CREDIT_THRESHOLD_WARNING"  = "1000"
    "CREDIT_THRESHOLD_CRITICAL" = "100"

    # Cache TTL Settings (in seconds)
    "CACHE_TTL_SETS"  = "604800" # 7 days
    "CACHE_TTL_CARDS" = "86400"  # 1 day
  }
}

# Static Web App Configuration
variable "static_web_app_location" {
  description = "The location for the Static Web App"
  type        = string
  default     = "Central US"
}

variable "static_web_app_sku_tier" {
  description = "The SKU tier for the Static Web App"
  type        = string
  default     = "Standard" # Standard tier for production
}

variable "static_web_app_sku_size" {
  description = "The SKU size for the Static Web App"
  type        = string
  default     = "Standard"
}

variable "static_web_app_settings" {
  description = "App settings for the Static Web App"
  type        = map(string)
  default = {
    "ENVIRONMENT" = "production"
    "DEBUG_MODE"  = "false"
  }
}

variable "enable_custom_domain" {
  description = "Enable custom domain configuration for the Static Web App"
  type        = bool
  default     = true
}

variable "custom_domain_name" {
  description = "Custom domain to associate with the Static Web App"
  type        = string
  default     = "pcpc.maber.io"
}

variable "custom_domain_dns_zone" {
  description = "Authoritative DNS zone for the custom domain"
  type        = string
  default     = "maber.io"
}

variable "custom_domain_validation_type" {
  description = "Validation method for the custom domain (cname-delegation or dns-txt-token)"
  type        = string
  default     = "cname-delegation"
}

variable "custom_domain_dns_propagation_delay" {
  description = "Duration terraform should wait after creating the Porkbun DNS record before attempting Azure custom domain validation (e.g. 30s, 1m)"
  type        = string
  default     = "45s"
}

variable "porkbun_dns_record_ttl" {
  description = "TTL for Porkbun DNS records (seconds)"
  type        = number
  default     = 600

  validation {
    condition     = var.porkbun_dns_record_ttl >= 600
    error_message = "Porkbun requires TTL to be at least 600 seconds."
  }
}

variable "porkbun_api_key" {
  description = "Porkbun API key used by the Terraform provider"
  type        = string
  sensitive   = true
}

variable "porkbun_secret_key" {
  description = "Porkbun secret API key used by the Terraform provider"
  type        = string
  sensitive   = true
}

# API Management Configuration
variable "enable_api_management" {
  description = "Whether to enable API Management"
  type        = bool
  default     = true # Always enabled for production
}

variable "apim_publisher_name" {
  description = "The publisher name for API Management"
  type        = string
  default     = "maber.io"
}

variable "apim_publisher_email" {
  description = "The publisher email for API Management"
  type        = string
  default     = "devops@maber.io"
}

variable "apim_sku_name" {
  description = "The SKU name for API Management"
  type        = string
  default     = "Consumption_0" # Can upgrade to Standard/Premium for production needs
}

# Log Analytics Configuration
variable "log_analytics_sku" {
  description = "The SKU of the Log Analytics workspace"
  type        = string
  default     = "PerGB2018"
}

variable "log_analytics_retention_days" {
  description = "The workspace data retention in days"
  type        = number
  default     = 365 # 1 year retention for production
}

variable "log_analytics_daily_quota_gb" {
  description = "The workspace daily quota for ingestion in GB"
  type        = number
  default     = -1 # Unlimited for production
}

# Application Insights Configuration
variable "application_insights_type" {
  description = "The type of Application Insights to create"
  type        = string
  default     = "web"
}

variable "application_insights_retention_days" {
  description = "The retention period in days for Application Insights"
  type        = number
  default     = 365 # 1 year retention for production
}

variable "application_insights_daily_cap_gb" {
  description = "The daily data volume cap in GB for Application Insights"
  type        = number
  default     = 100 # Higher cap for production
}

variable "application_insights_disable_cap_notifications" {
  description = "Disable daily data cap notifications"
  type        = bool
  default     = false
}

variable "application_insights_sampling_percentage" {
  description = "The percentage of telemetry to sample"
  type        = number
  default     = 10 # 10% sampling for production (reduce costs while maintaining visibility)
}

variable "alert_email_address" {
  description = "Email address for alert notifications"
  type        = string
  default     = "devops@maber.io"
}

variable "oncall_email_address" {
  description = "On-call email address for critical alerts"
  type        = string
  default     = "oncall@maber.io"
}
