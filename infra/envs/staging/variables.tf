# Environment Configuration
variable "environment" {
  description = "The environment name"
  type        = string
  default     = "staging"
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
  default     = "GRS" # Geo-redundant for staging
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
  default     = true # Enable for staging
}

variable "cosmos_enable_multiple_write_locations" {
  description = "Enable multiple write locations for Cosmos DB"
  type        = bool
  default     = false
}

# Function App Configuration
variable "function_app_sku_name" {
  description = "The SKU name for the Function App service plan"
  type        = string
  default     = "Y1" # Consumption plan
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
    "ENVIRONMENT" = "staging"
    "LOG_LEVEL"   = "info"
    "NODE_ENV"    = "production"
    "DEBUG_MODE"  = "false"

    # Cosmos DB Configuration
    "COSMOS_DB_DATABASE_NAME"        = "PokemonCards"
    "COSMOS_DB_CARDS_CONTAINER_NAME" = "Cards"
    "COSMOS_DB_SETS_CONTAINER_NAME"  = "Sets"

    # API Configuration
    "SCRYDEX_API_BASE_URL" = "https://api.scrydex.com/pokemon/v1"

    # Storage Configuration
    "AZURE_STORAGE_CONTAINER_NAME" = "images"

    # Feature Flags
    "ENABLE_CACHING"     = "true"
    "ENABLE_REDIS_CACHE" = "false"

    # Cache TTL Settings (in seconds)
    "CACHE_TTL_SETS"  = "604800" # 7 days
    "CACHE_TTL_CARDS" = "86400"  # 1 day
  }
}

# Porkbun provider credentials. Kept until the destroy applies — the
# porkbun_dns_record resource pending destroy still references them. Remove in
# the follow-up cleanup PR.
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
  default     = true
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
  default     = "Consumption_0"
}

variable "apim_gateway_hostnames" {
  description = <<-EOT
    Custom hostnames for the APIM gateway in this environment.

    Default is empty during the Azure-managed cert creation suspension
    (Aug 15 2025 — Jun 30 2026). When the suspension lifts, restore:

      staging: { host_name = "staging-api.pcpc.maber.io", default_ssl_binding = true }

    See `docs/adr/ADR-012-apim-managed-cert-suspension.md` for the
    full deferral rationale and re-enable checklist.
  EOT
  type = list(object({
    host_name           = string
    default_ssl_binding = optional(bool, false)
  }))
  default = []
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
  default     = 90 # Longer retention for staging
}

variable "log_analytics_daily_quota_gb" {
  description = "The workspace daily quota for ingestion in GB"
  type        = number
  default     = -1
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
  default     = 90 # Longer retention for staging
}

variable "application_insights_daily_cap_gb" {
  description = "The daily data volume cap in GB for Application Insights"
  type        = number
  default     = 5 # Higher cap for staging
}

variable "application_insights_disable_cap_notifications" {
  description = "Disable daily data cap notifications"
  type        = bool
  default     = false
}

variable "application_insights_sampling_percentage" {
  description = "The percentage of telemetry to sample"
  type        = number
  default     = 50 # 50% sampling for staging
}

variable "alert_email_address" {
  description = "Email address for alert notifications"
  type        = string
  default     = "devops@maber.io"
}

# -----------------------------------------------------------------------------
# Phase 2.2 — Path C (ACA Container) variables
#
# Same defaults as dev — staging is an architectural-demonstration tier, not a
# real higher-traffic tier. Tune per env later if needed. The shared ACR is
# provisioned once in `infra/shared/` and consumed here via
# terraform_remote_state. Env TFs only own the Container App itself.
# -----------------------------------------------------------------------------

variable "container_app_image_repository" {
  description = "Repository path within the shared ACR for the Functions image (e.g. `pcpc/functions`). Distinct from the `pcpc-ci/*` CI tooling image repos."
  type        = string
  default     = "pcpc/functions"
}

variable "container_app_image_tag" {
  description = "Initial image tag at terraform-apply time. Subsequent CD runs use `az containerapp update --image <new_sha>` to roll new revisions; the container-app module ignores image changes via lifecycle.ignore_changes."
  type        = string
  default     = "latest"
}

variable "container_app_min_replicas" {
  description = "Minimum ACA replicas. Default 1 keeps the frontend's 2-second probeHealth timeout from falsely degrading Path C after idle periods."
  type        = number
  default     = 1
}

variable "container_app_max_replicas" {
  description = "Maximum ACA replicas the HTTP scale rule can scale out to."
  type        = number
  default     = 3
}

variable "container_app_cpu" {
  description = "vCPU per replica."
  type        = number
  default     = 0.5
}

variable "container_app_memory" {
  description = "Memory per replica (e.g. 1Gi, 2Gi)."
  type        = string
  default     = "1Gi"
}

variable "container_app_http_concurrency" {
  description = "Concurrent HTTP requests per replica before the HTTP scale rule scales out."
  type        = number
  default     = 10
}

variable "container_app_cors_allowed_origins" {
  description = "Origins allowed by the ACA ingress CORS rule. Path C bypasses APIM, so this is the only allowlist gate. Keep in sync with the APIM regex policy (ADR-013) — both should be driven from the same canonical source. ACA CORS does not support regex; pass literal origins. Vercel preview origins can be added explicitly here when needed."
  type        = list(string)
  default     = ["https://pcpc.maber.io"]
}
