# Resource Group Module

This module creates an Azure Resource Group with optional management locks and standardized tagging.

## Features

- Creates Azure Resource Group with consistent naming and tagging
- Optional management locks (CanNotDelete or ReadOnly)
- Lifecycle management with prevent_destroy option
- Standardized tags for environment, project, and management tracking

## Usage

```hcl
module "resource_group" {
  source = "./modules/resource-group"

  name         = "rg-pcpc-dev"
  location     = "East US 2"
  environment  = "dev"
  project_name = "PCPC"

  tags = {
    "CostCenter" = "Engineering"
    "Owner"      = "DevOps Team"
  }

  # Optional: Add management lock
  lock_level = "CanNotDelete"
  lock_notes = "Production resource group - prevent accidental deletion"

  # Optional: Prevent Terraform destroy
  prevent_destroy = true
}
```

## Requirements

| Name      | Version   |
| --------- | --------- |
| terraform | >= 1.13.0 |
| azurerm   | ~> 3.60   |

## Providers

| Name    | Version |
| ------- | ------- |
| azurerm | ~> 3.60 |

## Inputs

| Name            | Description                                                                 | Type          | Default                  | Required |
| --------------- | --------------------------------------------------------------------------- | ------------- | ------------------------ | :------: |
| name            | The name of the resource group                                              | `string`      | n/a                      |   yes    |
| location        | The Azure region where the resource group will be created                   | `string`      | n/a                      |   yes    |
| environment     | The environment name (e.g., dev, staging, prod)                             | `string`      | n/a                      |   yes    |
| project_name    | The name of the project                                                     | `string`      | `"PCPC"`                 |    no    |
| tags            | A map of tags to assign to the resource group                               | `map(string)` | `{}`                     |    no    |
| prevent_destroy | Whether to prevent destruction of the resource group                        | `bool`        | `false`                  |    no    |
| lock_level      | The level of lock to apply to the resource group (CanNotDelete or ReadOnly) | `string`      | `null`                   |    no    |
| lock_notes      | Notes for the management lock                                               | `string`      | `"Managed by Terraform"` |    no    |

## Outputs

| Name     | Description                                |
| -------- | ------------------------------------------ |
| id       | The ID of the resource group               |
| name     | The name of the resource group             |
| location | The location of the resource group         |
| tags     | The tags assigned to the resource group    |
| lock_id  | The ID of the management lock (if created) |

## Examples

### Basic Resource Group

```hcl
module "basic_rg" {
  source = "./modules/resource-group"

  name        = "rg-pcpc-dev"
  location    = "East US 2"
  environment = "dev"
}
```

### Production Resource Group with Lock

```hcl
module "prod_rg" {
  source = "./modules/resource-group"

  name        = "rg-pcpc-prod"
  location    = "East US 2"
  environment = "prod"

  lock_level      = "CanNotDelete"
  prevent_destroy = true

  tags = {
    "CostCenter" = "Production"
    "Criticality" = "High"
  }
}
```
