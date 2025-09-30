# -----------------------------------------------------------------------------
# DEVELOPMENT ENVIRONMENT VARIABLES
# -----------------------------------------------------------------------------

variable "api_management_name" {
  description = "Name of the existing API Management instance"
  type        = string
  default     = "maber-apim-test"  # Based on your current setup
}

variable "resource_group_name" {
  description = "Name of the resource group containing the API Management instance"
  type        = string
  default     = "pokedata-dev-rg"  # Based on your naming convention
}

variable "function_app_name" {
  description = "Name of the Azure Function App backend"
  type        = string
  default     = "pokedata-func-dev"  # Based on your naming convention
}

variable "function_app_key" {
  description = "Function app access key for backend authentication"
  type        = string
  sensitive   = true
  # This should be provided via environment variable or terraform.tfvars
}

variable "enable_application_insights" {
  description = "Enable Application Insights integration"
  type        = bool
  default     = true
}

variable "application_insights_name" {
  description = "Name of the Application Insights instance"
  type        = string
  default     = "pokedata-appinsights-dev"  # Based on your naming convention
}

# -----------------------------------------------------------------------------
# OPTIONAL OVERRIDES
# -----------------------------------------------------------------------------

variable "additional_cors_origins" {
  description = "Additional CORS origins specific to development environment"
  type        = list(string)
  default     = []
}

variable "override_rate_limit_calls" {
  description = "Override rate limit calls for development testing"
  type        = number
  default     = null
}

variable "override_cache_durations" {
  description = "Override cache durations for development testing"
  type = object({
    sets      = optional(number)
    cards     = optional(number)
    card_info = optional(number)
  })
  default = {}
}

variable "enable_debug_features" {
  description = "Enable additional debug features for development"
  type        = bool
  default     = true
}
