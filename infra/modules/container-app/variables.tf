# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# -----------------------------------------------------------------------------

variable "name" {
  description = "Base name for the Container App resources. Used for the Container App itself, the Container Apps Environment (`<name>-env`), and the user-assigned managed identity (`<name>-uami`)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]{2,32}$", var.name))
    error_message = "Name must be 2-32 characters, lowercase letters, numbers, and hyphens only (Container App names have a 32-char limit)."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group that hosts the Container App resources."
  type        = string
}

variable "location" {
  description = "Azure region where the Container App resources will be created. Must match the region of the Log Analytics workspace passed in via log_analytics_workspace_id."
  type        = string
}

variable "log_analytics_workspace_id" {
  description = "Resource ID of an existing Log Analytics workspace that the Container Apps Environment writes its system + container logs to. Path C reuses Path B's workspace so traces from both runtimes are queryable side-by-side (see ADR-009)."
  type        = string
}

variable "acr_id" {
  description = "Resource ID of the Azure Container Registry the Container App pulls its image from. The module's user-assigned managed identity is granted the AcrPull role on this ACR. Path C reuses the shared `maberdevcontainerregistry` ACR (login server `maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io`) rather than provisioning a per-env registry (see ADR-009)."
  type        = string
}

variable "acr_login_server" {
  description = "Login server hostname for the ACR (e.g. `maberdevcontainerregistry-ccedhvhwfndwetdp.azurecr.io`). Used in the `registry.server` field on the Container App."
  type        = string
}

variable "image_repository" {
  description = "Image repository path within the ACR (e.g. `pcpc/functions`). Combined with `image_tag` to form the full image reference."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9._/-]*$", var.image_repository))
    error_message = "Image repository must be a valid ACR repository path (lowercase, slashes, dots, hyphens, underscores)."
  }
}

variable "image_tag" {
  description = "Image tag to deploy at module-apply time. The ADO pipeline updates this via `az containerapp update --image` post-apply, so the value here is the initial / baseline tag (`latest` is fine for first apply)."
  type        = string
  default     = "latest"
}

# -----------------------------------------------------------------------------
# OPTIONAL — environment + naming
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod). Used in default tagging and to derive environment-specific defaults."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "tags" {
  description = "Additional tags to apply to resources. Merged with module defaults (Environment, ManagedBy=Terraform, Module=container-app)."
  type        = map(string)
  default     = {}
}

# -----------------------------------------------------------------------------
# OPTIONAL — scaling + resources
# -----------------------------------------------------------------------------

variable "min_replicas" {
  description = "Minimum number of replicas. PCPC defaults to 1 in dev so the frontend's 2-second probeHealth timeout never falsely degrades Path C after an idle period (see ADR-009 and the open-question resolution in PORTFOLIO_PLAN.md)."
  type        = number
  default     = 1

  validation {
    condition     = var.min_replicas >= 0 && var.min_replicas <= 25
    error_message = "min_replicas must be between 0 and 25."
  }
}

variable "max_replicas" {
  description = "Maximum number of replicas the HTTP scale rule can scale out to."
  type        = number
  default     = 3

  validation {
    condition     = var.max_replicas >= 1 && var.max_replicas <= 300
    error_message = "max_replicas must be between 1 and 300."
  }
}

variable "cpu" {
  description = "vCPU cores per replica. Combined with `memory`, must match a valid ACA Consumption profile (e.g. 0.5 vCPU + 1Gi memory, 1.0 vCPU + 2Gi memory)."
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Memory per replica (e.g. `1Gi`, `2Gi`, `4Gi`). Must pair with `cpu` against a valid ACA Consumption profile."
  type        = string
  default     = "1Gi"
}

variable "http_concurrency" {
  description = "Concurrent HTTP requests per replica before the HTTP scale rule scales out. Defaults to 10 (ACA default)."
  type        = number
  default     = 10
}

# -----------------------------------------------------------------------------
# OPTIONAL — ingress + CORS
# -----------------------------------------------------------------------------

variable "target_port" {
  description = "Port the container listens on. The Functions base image listens on 80 by default."
  type        = number
  default     = 80
}

variable "cors_allowed_origins" {
  description = "List of origins allowed by the ACA ingress CORS rule. Path C bypasses APIM, so this is the only allowlist gate for browser requests to Path C — keep in sync with the APIM regex policy origins (see ADR-013) or source both from the same variable group entry."
  type        = list(string)
  default     = []
}

variable "cors_allowed_methods" {
  description = "HTTP methods permitted by the ingress CORS rule."
  type        = list(string)
  default     = ["GET", "POST", "OPTIONS"]
}

variable "cors_allowed_headers" {
  description = "Request headers permitted by the ingress CORS rule."
  type        = list(string)
  default     = ["content-type", "x-functions-key"]
}

variable "cors_max_age_in_seconds" {
  description = "Max age the browser can cache CORS preflight responses, in seconds."
  type        = number
  default     = 3600
}

# -----------------------------------------------------------------------------
# OPTIONAL — application settings + secrets
# -----------------------------------------------------------------------------

variable "app_settings" {
  description = "Non-secret application settings (env vars) for the container. Keys are emitted to the container with the original casing. Hyphenated keys are converted to underscores (parity with the function-app module's transform) so Node.js can read them as `process.env.*`."
  type        = map(string)
  default     = {}
}

variable "secret_settings" {
  description = "Secret application settings. Map of env-var name → secret value. Each entry materializes as both a Container App `secret` block and an `env` block that references it via `secret_name`, so the value never appears in env-var dumps or revision describe output."
  type        = map(string)
  default     = {}
  sensitive   = true
}
