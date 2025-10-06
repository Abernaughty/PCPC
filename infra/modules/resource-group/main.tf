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

  lifecycle {
    ignore_changes = [
      tags["CreatedDate"]
    ]
  }

  # Note: prevent_destroy must be a literal value, not a variable
  # Uncomment and add to lifecycle block above if you want to prevent accidental deletion
  # lifecycle {
  #   prevent_destroy = true
  #   ignore_changes = [
  #     tags["CreatedDate"]
  #   ]
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
