output "id" {
  description = "Resource ID of the Key Vault."
  value       = azurerm_key_vault.this.id
}

output "name" {
  description = "Name of the Key Vault."
  value       = azurerm_key_vault.this.name
}

output "vault_uri" {
  description = "URI endpoint of the Key Vault."
  value       = azurerm_key_vault.this.vault_uri
}

output "resource_group_name" {
  description = "Resource group hosting the Key Vault."
  value       = azurerm_key_vault.this.resource_group_name
}

output "tags" {
  description = "Tags applied to the Key Vault."
  value       = azurerm_key_vault.this.tags
}
