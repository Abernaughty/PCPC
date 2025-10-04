# -----------------------------------------------------------------------------
# REQUIRED VARIABLES
# -----------------------------------------------------------------------------

variable "name" {
  description = "The name of the Static Web App"
  type        = string
}

variable "resource_group_name" {
  description = "The name of the resource group"
  type        = string
}

variable "location" {
  description = "The Azure region where resources will be created"
  type        = string
  default     = "centralus" # Limited regions for SWA
}

# -----------------------------------------------------------------------------
# OPTIONAL VARIABLES
# -----------------------------------------------------------------------------

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "sku_tier" {
  description = "The pricing tier (Free or Standard)"
  type        = string
  default     = "Free"
}

variable "sku_size" {
  description = "The pricing tier size"
  type        = string
  default     = "Free"
}

# GitHub Integration
variable "repository_url" {
  description = "The URL of the GitHub repository"
  type        = string
  default     = ""
}

variable "repository_branch" {
  description = "The branch to deploy from"
  type        = string
  default     = "main"
}

variable "repository_token" {
  description = "GitHub Personal Access Token for repo access"
  type        = string
  default     = ""
  sensitive   = true
}

# Configuration
variable "app_settings" {
  description = "Application settings for the Static Web App"
  type        = map(string)
  default     = {}
}

variable "preview_environments_enabled" {
  description = "Enable preview environments for pull requests"
  type        = bool
  default     = true
}

variable "configuration_file_changes_enabled" {
  description = "Enable automatic builds when config files change"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}

# Build Configuration
variable "app_location" {
  description = "The app location in the repository"
  type        = string
  default     = "/"
}

variable "api_location" {
  description = "The API location in the repository"
  type        = string
  default     = ""
}

variable "output_location" {
  description = "The output location for the built app"
  type        = string
  default     = ""
}
