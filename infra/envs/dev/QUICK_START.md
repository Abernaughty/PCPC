# Quick Start - Fix Terraform State Issue

## Immediate Steps to Fix Your Pipeline

### 1. Authenticate with Azure (Required First!)

```bash
az login
az account set --subscription 555b4cfa-ad2e-4c71-9433-620a59cf7616
```

### 2. Run the Import Script

```bash
cd infra/envs/dev
./import-existing-resources.sh
```

This will:

- ✅ Initialize Terraform with remote backend
- ✅ Import the existing `pcpc-rg-dev` resource group
- ✅ Show you any other resources that need importing

### 3. Verify Everything Works

```bash
terraform plan
```

Expected result: Should show minimal or no changes if imports were successful.

### 4. Push Changes to Trigger Pipeline

```bash
git add infra/envs/dev/main.tf
git commit -m "Configure remote backend for Terraform state"
git push
```

Your pipeline should now work! 🎉

## What Was Fixed

1. **Backend Configuration**: Uncommented and corrected the remote backend in `main.tf`
2. **Import Script**: Created automated script to import existing resources
3. **Documentation**: Created comprehensive migration guide

## If You Need More Details

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for complete documentation.

## Common Issues

**"Not logged in to Azure CLI"**
→ Run `az login`

**"Resource already exists"**
→ The import script handles this automatically

**"State lock error"**
→ Wait a few minutes or run `terraform force-unlock <LOCK_ID>`
