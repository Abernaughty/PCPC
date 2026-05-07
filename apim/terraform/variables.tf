# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# -----------------------------------------------------------------------------

variable "api_management_name" {
  description = "Name of the existing API Management instance"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{0,48}[a-z0-9]$", var.api_management_name))
    error_message = "API Management name must start with letter, contain only lowercase letters, numbers and hyphens, and be 1-50 characters."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group containing the API Management instance"
  type        = string
}

variable "function_app_name" {
  description = "Name of the Azure Function App backend"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "function_app_key" {
  description = "Function app access key for backend authentication"
  type        = string
  sensitive   = true
}

# -----------------------------------------------------------------------------
# CORS CONFIGURATION
# -----------------------------------------------------------------------------

variable "cors_origin_patterns" {
  description = <<-EOT
    Glob-style hostname patterns allowed by the CORS policy. Each pattern
    matches against the host portion of the Origin header. The policy
    automatically prepends `https://` when constructing the regex, so
    only secure origins are matched.

    Use `*` as a wildcard inside a pattern to match one or more
    hostname-safe characters (lowercase alphanumerics and hyphens).
    Standalone `*` is intentionally rejected — see ADR-013.

    Examples:
      "pcpc.maber.io"
        → matches https://pcpc.maber.io exactly
      "pcpc-git-*-abernaughtys-projects.vercel.app"
        → matches Vercel per-PR preview URLs
      "pcpc-*-abernaughtys-projects.vercel.app"
        → matches Vercel commit-level URLs

    See ADR-013 (CORS Regex Policy) for the design rationale: APIM's
    built-in <cors> element doesn't support wildcard subdomains, so this
    list is assembled into a regex used by a custom policy that echoes
    the matched Origin back as Access-Control-Allow-Origin.
  EOT
  type        = list(string)
  default     = ["pcpc.maber.io"]

  validation {
    condition = alltrue([
      for p in var.cors_origin_patterns :
      p != "*" && can(regex("^[a-z0-9.*-]+$", p))
    ])
    error_message = "Each pattern must be a hostname-style glob (lowercase alphanumerics, '.', '-', '*'). Standalone '*' is not supported; allow-any-origin is rejected by ADR-013."
  }
}

# -----------------------------------------------------------------------------
# RATE LIMITING CONFIGURATION
# -----------------------------------------------------------------------------

variable "rate_limit_calls" {
  description = "Number of calls allowed per renewal period"
  type        = number
  default     = 300

  validation {
    condition     = var.rate_limit_calls > 0 && var.rate_limit_calls <= 10000
    error_message = "Rate limit calls must be between 1 and 10000."
  }
}

variable "rate_limit_period" {
  description = "Rate limit renewal period in seconds"
  type        = number
  default     = 60

  validation {
    condition     = var.rate_limit_period > 0 && var.rate_limit_period <= 3600
    error_message = "Rate limit period must be between 1 and 3600 seconds."
  }
}

# -----------------------------------------------------------------------------
# CACHING CONFIGURATION
# -----------------------------------------------------------------------------

variable "cache_duration_sets" {
  description = "Cache duration for sets endpoint in seconds"
  type        = number
  default     = 300

  validation {
    condition     = var.cache_duration_sets >= 0 && var.cache_duration_sets <= 86400
    error_message = "Cache duration must be between 0 and 86400 seconds (24 hours)."
  }
}

variable "cache_duration_cards" {
  description = "Cache duration for cards endpoint in seconds"
  type        = number
  default     = 600

  validation {
    condition     = var.cache_duration_cards >= 0 && var.cache_duration_cards <= 86400
    error_message = "Cache duration must be between 0 and 86400 seconds (24 hours)."
  }
}

variable "cache_duration_card_info" {
  description = "Cache duration for card info endpoint in seconds"
  type        = number
  default     = 1800

  validation {
    condition     = var.cache_duration_card_info >= 0 && var.cache_duration_card_info <= 86400
    error_message = "Cache duration must be between 0 and 86400 seconds (24 hours)."
  }
}

# -----------------------------------------------------------------------------
# BACKEND CONFIGURATION
# -----------------------------------------------------------------------------

variable "backend_timeout" {
  description = "Backend request timeout in seconds"
  type        = number
  default     = 30

  validation {
    condition     = var.backend_timeout > 0 && var.backend_timeout <= 300
    error_message = "Backend timeout must be between 1 and 300 seconds."
  }
}

# -----------------------------------------------------------------------------
# OPTIONAL VARIABLES
# -----------------------------------------------------------------------------

variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "enable_caching" {
  description = "Enable response caching for API operations"
  type        = bool
  default     = true
}

variable "enable_detailed_logging" {
  description = "Enable detailed request/response logging"
  type        = bool
  default     = false
}

variable "api_version" {
  description = "API version for the PCPC API"
  type        = string
  default     = "v1"

  validation {
    condition     = can(regex("^v[0-9]+$", var.api_version))
    error_message = "API version must be in format 'v1', 'v2', etc."
  }
}

# -----------------------------------------------------------------------------
# PRODUCT CONFIGURATION
# -----------------------------------------------------------------------------

variable "products" {
  description = "API Management products configuration"
  type = map(object({
    display_name          = string
    description           = string
    published             = bool
    approval_required     = bool
    subscription_required = bool
    subscriptions_limit   = optional(number)
  }))
  default = {
    starter = {
      display_name          = "Starter"
      description           = "Starter product with limited calls"
      published             = true
      approval_required     = false
      subscription_required = false
      subscriptions_limit   = 1
    }
    premium = {
      display_name          = "Premium"
      description           = "Premium product with higher limits"
      published             = true
      approval_required     = true
      subscription_required = true
      subscriptions_limit   = 5
    }
    unlimited = {
      display_name          = "Unlimited"
      description           = "Unlimited product for trusted consumers"
      published             = true
      approval_required     = true
      subscription_required = true
    }
  }
}

# -----------------------------------------------------------------------------
# MONITORING CONFIGURATION
# -----------------------------------------------------------------------------

variable "enable_application_insights" {
  description = "Enable Application Insights integration"
  type        = bool
  default     = true
}

variable "application_insights_name" {
  description = "Name of the Application Insights instance"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 30

  validation {
    condition     = var.log_retention_days >= 1 && var.log_retention_days <= 365
    error_message = "Log retention must be between 1 and 365 days."
  }
}
