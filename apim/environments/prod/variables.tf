# -----------------------------------------------------------------------------
# PRODUCTION ENVIRONMENT VARIABLES
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment identifier"
  type        = string
  default     = "prod"
}

variable "api_management_name" {
  description = "Name of the existing API Management instance"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group containing the API Management instance"
  type        = string
}

variable "function_app_name" {
  description = "Name of the Azure Function App backend"
  type        = string
}

variable "function_app_key" {
  description = "Function app access key for backend authentication"
  type        = string
  sensitive   = true
}

variable "enable_application_insights" {
  description = "Enable Application Insights integration"
  type        = bool
  default     = true
}

variable "application_insights_name" {
  description = "Name of the Application Insights instance"
  type        = string
}

# -----------------------------------------------------------------------------
# OPTIONAL OVERRIDES (PIPELINE/LOCAL)
# -----------------------------------------------------------------------------

variable "cors_origins" {
  description = "Explicit list of allowed CORS origins (overrides defaults when non-empty)"
  type        = list(string)
  default     = []
}

variable "rate_limit_calls" {
  description = "Override rate limit calls per renewal period"
  type        = number
  default     = null
}

variable "rate_limit_period" {
  description = "Override rate limit renewal period in seconds"
  type        = number
  default     = null
}

variable "cache_duration_sets" {
  description = "Override cache duration for sets endpoint in seconds"
  type        = number
  default     = null
}

variable "cache_duration_cards" {
  description = "Override cache duration for cards endpoint in seconds"
  type        = number
  default     = null
}

variable "cache_duration_card_info" {
  description = "Override cache duration for card info endpoint in seconds"
  type        = number
  default     = null
}

variable "backend_timeout" {
  description = "Override backend request timeout in seconds"
  type        = number
  default     = null
}

variable "api_version" {
  description = "Override API version identifier"
  type        = string
  default     = ""
}

# -----------------------------------------------------------------------------
# ADDITIONAL CONFIGURATION
# -----------------------------------------------------------------------------

variable "additional_cors_origins" {
  description = "Additional CORS origins specific to production environment"
  type        = list(string)
  default     = []
}

variable "override_rate_limit_calls" {
  description = "Legacy override for rate limit calls (use rate_limit_calls when possible)"
  type        = number
  default     = null
}

variable "override_cache_durations" {
  description = "Legacy override for cache durations"
  type = object({
    sets      = optional(number)
    cards     = optional(number)
    card_info = optional(number)
  })
  default = {}
}

variable "enable_debug_features" {
  description = "Enable additional debug features for production"
  type        = bool
  default     = false
}
