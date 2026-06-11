# -----------------------------------------------------------------------------
# PCPC Shared Platform Infrastructure
#
# Hosts shared resources that span environments — currently just the single
# Container Registry that all envs (dev/staging/prod) pull from. Lives in its
# own resource group (`pcpc-rg-shared`) and its own Terraform state file
# (`shared.terraform.tfstate`) so the ACR's lifecycle is decoupled from any
# single env's lifecycle.
#
# Originally the ACR lived in `pcpc-rg-dev` (PR #153). That worked while only
# dev had ACA, but it implicitly treated dev as the "platform owner" — any
# staging/prod ACA promotion would have needed cross-RG AcrPull grants
# reaching back into `pcpc-rg-dev`, the same coupling Phase 2.2 explicitly
# moved away from. Moving the ACR here lets dev/staging/prod each manage only
# their own RG while the platform RG holds the shared piece.
#
# Apply procedure (one-time bootstrap):
#   1. Operator manually creates `pcpc-rg-shared` and grants the ADO SP
#      `Contributor` + `Role Based Access Control Administrator` on it
#      (ABAC condition: AcrPull + AcrPush role-definition GUIDs).
#   2. Operator runs `terraform init && terraform apply` from this directory.
#   3. Env TFs (dev/staging/prod) consume the ACR via
#      `data.terraform_remote_state.shared` against this state file.
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.0.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.47.0, < 5.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Remote backend for state management — same storage account as env states,
  # different key. The state container already exists (provisioned out-of-band
  # before any env's first apply).
  backend "azurerm" {
    resource_group_name  = "pcpc-terraform-state-rg"
    storage_account_name = "pcpctfstatedacc29c2"
    container_name       = "tfstate"
    key                  = "shared.terraform.tfstate"
    # tenant_id and subscription_id are supplied at init time via the
    # ARM_TENANT_ID / ARM_SUBSCRIPTION_ID environment variables, Azure CLI
    # authentication, or -backend-config arguments.
  }
}

provider "azurerm" {
  features {
    resource_group {
      # Shared RG holds platform infra consumed by all envs — deletion should
      # only happen via deliberate `terraform destroy`. Set to true to prevent
      # accidental destroy when child resources are present.
      prevent_deletion_if_contains_resources = true
    }
  }
  subscription_id = var.subscription_id
  tenant_id       = var.tenant_id
}

provider "random" {}

data "azurerm_client_config" "current" {}

# Random suffix to satisfy ACR's global-uniqueness requirement. ACR names
# are alphanumeric only (no hyphens), so we concatenate without separator.
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  common_tags = {
    Environment = "shared"
    Project     = var.project_name
    ManagedBy   = "Terraform"
    Repository  = "PCPC"
  }
}

# -----------------------------------------------------------------------------
# Shared Resource Group
#
# Read via data source rather than managed by this module. The RG must be
# created manually by an operator BEFORE this TF runs because RG-scoped
# RBAC grants (Contributor + RBAC Administrator) on the SP are themselves
# the prerequisite for `terraform apply` to succeed — if Terraform tried
# to create the RG itself, the SP would need broader (subscription-scoped)
# Contributor, which we want to avoid. Operator workflow:
#   1. `az group create -n pcpc-rg-shared -l <location> --tags ...`
#   2. Grant SP `Contributor` + `RBAC Administrator` (ABAC: AcrPull/AcrPush)
#      on the RG.
#   3. `terraform init && terraform apply` (this module) — data-sources
#      the existing RG and creates the ACR + role assignment inside it.
# -----------------------------------------------------------------------------
data "azurerm_resource_group" "shared" {
  name = "pcpc-rg-shared"
}

# -----------------------------------------------------------------------------
# Shared Container Registry
#
# Single ACR consumed by all envs. Each env's container_app module's UAMI
# gets AcrPull on this registry via the env's own TF (cross-RG role
# assignment, scoped to this ACR's id).
# -----------------------------------------------------------------------------
module "container_registry" {
  source = "../modules/container-registry"

  name                = "pcpcacr${random_string.suffix.result}"
  resource_group_name = data.azurerm_resource_group.shared.name
  location            = data.azurerm_resource_group.shared.location
  environment         = "shared"

  sku           = var.container_registry_sku
  admin_enabled = false

  tags = local.common_tags
}

# Grant the ADO service principal AcrPush on the shared ACR so the pipeline's
# `Build_Container_Image` job can `az acr login && docker push`. Same pattern
# as the role assignment previously in `infra/envs/dev/main.tf` (which is
# being removed in the dev rewire half of this PR).
resource "azurerm_role_assignment" "ado_sp_acr_push" {
  scope                = module.container_registry.id
  role_definition_name = "AcrPush"
  principal_id         = data.azurerm_client_config.current.object_id

  depends_on = [module.container_registry]
}
