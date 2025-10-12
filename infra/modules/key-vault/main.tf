locals {
  tags = merge(
    {
      Environment = var.environment
      ManagedBy   = "Terraform"
      Module      = "key-vault"
    },
    var.tags
  )

  filtered_access_policies = [
    for policy in var.access_policies :
    policy if trimspace(try(policy.object_id, "")) != ""
  ]

  filtered_rbac_assignments = [
    for assignment in var.rbac_assignments :
    assignment if trimspace(try(assignment.principal_id, "")) != ""
  ]
}

resource "azurerm_key_vault" "this" {
  name                          = var.name
  location                      = var.location
  resource_group_name           = var.resource_group_name
  tenant_id                     = var.tenant_id
  sku_name                      = var.sku_name
  soft_delete_retention_days    = var.soft_delete_retention_days
  purge_protection_enabled      = var.purge_protection_enabled
  public_network_access_enabled = var.public_network_access_enabled

  enabled_for_deployment          = var.enabled_for_deployment
  enabled_for_disk_encryption     = var.enabled_for_disk_encryption
  enabled_for_template_deployment = var.enabled_for_template_deployment

  dynamic "network_acls" {
    for_each = var.network_acls != null ? [var.network_acls] : []
    content {
      default_action             = lookup(network_acls.value, "default_action", "Deny")
      bypass                     = lookup(network_acls.value, "bypass", "AzureServices")
      ip_rules                   = lookup(network_acls.value, "ip_rules", [])
      virtual_network_subnet_ids = lookup(network_acls.value, "subnet_ids", [])
    }
  }

  tags = local.tags
}

resource "azurerm_key_vault_access_policy" "this" {
  for_each = {
    for idx, policy in local.filtered_access_policies :
    format("%03d-%s", idx, trimspace(policy.object_id)) => policy
  }

  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = var.tenant_id
  object_id    = trimspace(each.value.object_id)

  secret_permissions      = lookup(each.value, "secret_permissions", [])
  key_permissions         = lookup(each.value, "key_permissions", [])
  certificate_permissions = lookup(each.value, "certificate_permissions", [])
  storage_permissions     = lookup(each.value, "storage_permissions", [])
}

resource "azurerm_role_assignment" "this" {
  for_each = {
    for idx, assignment in local.filtered_rbac_assignments :
    format("%03d-%s", idx, trimspace(assignment.principal_id)) => assignment
  }

  scope                = coalesce(lookup(each.value, "scope", null), azurerm_key_vault.this.id)
  principal_id         = trimspace(each.value.principal_id)
  role_definition_id   = lookup(each.value, "role_definition_id", null)
  role_definition_name = lookup(each.value, "role_definition_name", null)

  depends_on = [azurerm_key_vault.this]
}
