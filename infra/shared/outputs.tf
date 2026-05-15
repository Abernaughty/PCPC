# -----------------------------------------------------------------------------
# OUTPUTS
#
# Consumed by env Terraform roots via `data "terraform_remote_state" "shared"`.
# Names match the prior `module.container_registry.*` references that lived
# in dev's TF before PR 2.5 split the ACR out into this shared root.
# -----------------------------------------------------------------------------

output "resource_group_name" {
  description = "Name of the shared resource group hosting the ACR."
  value       = module.resource_group.name
}

output "resource_group_id" {
  description = "Resource ID of the shared resource group."
  value       = module.resource_group.id
}

output "acr_name" {
  description = "Name of the shared Container Registry (alphanumeric, random-suffixed). Used by the pipeline's image-build job to discover the registry via `az acr list -g pcpc-rg-shared`."
  value       = module.container_registry.name
}

output "acr_id" {
  description = "Resource ID of the shared Container Registry. Env TFs use this to scope cross-RG AcrPull role assignments to the shared ACR."
  value       = module.container_registry.id
}

output "acr_login_server" {
  description = "Login server hostname for the shared ACR (e.g. `pcpcacr<suffix>.azurecr.io`). Used in container_app `registry.server` and as the prefix for image references."
  value       = module.container_registry.login_server
}
