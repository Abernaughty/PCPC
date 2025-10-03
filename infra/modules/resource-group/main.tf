terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.0.0"
}

resource "azurerm_resource_group" "this" {
  name     = var.name
  location = var.location

  tags = merge(
    var.tags,
    {
      "Environment" = var.environment
      "Project"     = var.project_name
      "ManagedBy"   = "Terraform"
    }
  )

  # Note: prevent_destroy must be a literal value, not a variable
  # Uncomment the lifecycle block below if you want to prevent accidental deletion
  # lifecycle {
  #   prevent_destroy = true
  # }
}

# Optional: Create a management lock if specified
resource "azurerm_management_lock" "this" {
  count = var.lock_level != null ? 1 : 0

  name       = "${var.name}-lock"
  scope      = azurerm_resource_group.this.id
  lock_level = var.lock_level
  notes      = var.lock_notes

  depends_on = [azurerm_resource_group.this]
}
