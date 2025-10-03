# Terraform State Migration Guide

This guide walks you through migrating from local Terraform state to remote Azure Storage backend and importing existing resources.

## Problem

You encountered this error because:

1. Terraform was using local state (not persisted in Azure)
2. The resource group `pcpc-rg-dev` already exists in Azure
3. Terraform doesn't know about it (not in state file)

## Solution Overview

We've configured the remote backend and created an import script. Here's how to complete the migration:

## Prerequisites

- Azure CLI installed
- Terraform installed (v1.0.0+)
- Access to Azure subscription: `555b4cfa-ad2e-4c71-9433-620a59cf7616`
- Permissions to manage resources in the subscription

## Step-by-Step Instructions

### Step 1: Authenticate with Azure CLI

```bash
# Login to Azure
az login

# Set the correct subscription
az account set --subscription 555b4cfa-ad2e-4c71-9433-620a59cf7616

# Verify you're using the correct subscription
az account show
```

### Step 2: Run the Import Script

The script will:

- Initialize Terraform with the remote backend
- Import the existing resource group
- Identify other resources that need importing

```bash
cd infra/envs/dev
./import-existing-resources.sh
```

### Step 3: Import Additional Resources (if needed)

If the script identifies other existing resources, import them using the commands it provides. For example:

```bash
# Example: Import Cosmos DB (if it exists)
terraform import module.cosmos_db.azurerm_cosmosdb_account.this \
  /subscriptions/555b4cfa-ad2e-4c71-9433-620a59cf7616/resourceGroups/pcpc-rg-dev/providers/Microsoft.DocumentDB/databaseAccounts/pcpc-cosmos-dev

# Example: Import Storage Account (if it exists)
terraform import module.storage_account.azurerm_storage_account.this \
  /subscriptions/555b4cfa-ad2e-4c71-9433-620a59cf7616/resourceGroups/pcpc-rg-dev/providers/Microsoft.Storage/storageAccounts/pcpcstdev123456
```

### Step 4: Verify with Terraform Plan

```bash
terraform plan
```

This should show:

- No changes if all resources are imported correctly
- Only new resources to create if some don't exist yet
- Configuration changes if existing resources differ from your Terraform config

### Step 5: Apply Changes (if needed)

```bash
terraform apply
```

## For Pipeline Deployment

Once local state is migrated, your Azure DevOps pipeline will work correctly because:

1. **Backend is now configured** in `main.tf`:

   ```hcl
   backend "azurerm" {
     resource_group_name  = "pcpc-terraform-state-rg"
     storage_account_name = "pcpctfstatedacc29c2"
     container_name       = "tfstate"
     key                  = "dev.terraform.tfstate"
   }
   ```

2. **Pipeline uses the same backend**: The pipeline templates already reference these backend settings via variables.

3. **State is shared**: Both local runs and pipeline runs will use the same state file in Azure Storage.

## Verify Pipeline Variables

Ensure your Azure DevOps variable group `pcpc-terraform-dev` has:

```yaml
TF_STATE_RESOURCE_GROUP: pcpc-terraform-state-rg
TF_STATE_STORAGE_ACCOUNT: pcpctfstatedacc29c2
TF_STATE_CONTAINER: tfstate
```

## Troubleshooting

### Error: "tenant ID was not specified"

**Solution**: Run `az login` to authenticate.

### Error: "Backend initialization required"

**Solution**: Run `terraform init -reconfigure` with backend config parameters.

### Error: "Resource already exists"

**Solution**: Import the resource using `terraform import` command.

### Error: "State lock"

**Solution**: If state is locked, you may need to force unlock:

```bash
terraform force-unlock <LOCK_ID>
```

## What Changed

### Files Modified

1. **infra/envs/dev/main.tf**

   - Uncommented and corrected the backend configuration
   - Changed resource group name from `terraform-state-rg` to `pcpc-terraform-state-rg`

2. **infra/envs/dev/import-existing-resources.sh** (NEW)

   - Automated script to initialize backend and import resources

3. **infra/envs/dev/MIGRATION_GUIDE.md** (NEW)
   - This guide

### Backend Configuration

```hcl
backend "azurerm" {
  resource_group_name  = "pcpc-terraform-state-rg"
  storage_account_name = "pcpctfstatedacc29c2"
  container_name       = "tfstate"
  key                  = "dev.terraform.tfstate"
}
```

## Next Steps After Migration

1. **Test locally**: Run `terraform plan` and `terraform apply` to verify everything works
2. **Test pipeline**: Push changes and verify the pipeline runs successfully
3. **Document**: Update team documentation about the remote backend
4. **Clean up**: Remove any local `.terraform` directories and `terraform.tfstate` files from version control

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Terraform and Azure CLI logs
3. Verify Azure permissions
4. Check that backend storage account is accessible

## Important Notes

- **State file location**: The state is now stored in Azure Storage at:

  - Resource Group: `pcpc-terraform-state-rg`
  - Storage Account: `pcpctfstatedacc29c2`
  - Container: `tfstate`
  - Blob: `dev.terraform.tfstate`

- **Concurrent access**: Azure Storage backend supports state locking, preventing concurrent modifications

- **Security**: Ensure proper RBAC permissions on the storage account to control who can modify state

- **Backup**: Azure Storage provides versioning and backup capabilities for the state file
