# PCPC Pipeline Setup Guide

## Overview

This guide walks you through the complete setup process for the PCPC Azure DevOps infrastructure deployment pipeline. Follow these steps in order to ensure a successful configuration.

## Prerequisites

- Azure subscription with Owner or Contributor access
- Azure DevOps organization: `maber-devops`
- Azure DevOps project: `PCPC`
- Azure CLI installed and configured
- Bash shell (Git Bash on Windows, native on Linux/Mac)

## Setup Checklist

- [ ] Phase 1: Create Terraform State Storage
- [ ] Phase 2: Create Service Principal
- [ ] Phase 3: Configure Azure DevOps Service Connection
- [ ] Phase 4: Create Variable Group
- [ ] Phase 5: Create Environment with Approvals
- [ ] Phase 6: Test Pipeline
- [ ] Phase 7: Verify Deployment

---

## Phase 1: Create Terraform State Storage

### Step 1.1: Set Variables

```bash
# Set your Azure subscription
az account set --subscription "<your-subscription-id>"

# Define variables
RESOURCE_GROUP="pcpc-terraform-state-rg"
STORAGE_ACCOUNT="pcpctfstate$(openssl rand -hex 4)"
CONTAINER_NAME="tfstate"
LOCATION="eastus"

# Save storage account name for later
echo "Storage Account Name: $STORAGE_ACCOUNT"
echo $STORAGE_ACCOUNT > storage-account-name.txt
```

### Step 1.2: Create Resource Group

```bash
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Verify creation
az group show --name $RESOURCE_GROUP
```

### Step 1.3: Create Storage Account

```bash
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --encryption-services blob \
  --https-only true \
  --min-tls-version TLS1_2 \
  --allow-blob-public-access false

# Verify creation
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP
```

### Step 1.4: Create Blob Container

```bash
az storage container create \
  --name $CONTAINER_NAME \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login

# Verify creation
az storage container show \
  --name $CONTAINER_NAME \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login
```

### Step 1.5: Enable Versioning and Soft Delete

```bash
# Enable blob versioning
az storage account blob-service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --enable-versioning true

# Enable soft delete (7 days retention)
az storage account blob-service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --enable-delete-retention true \
  --delete-retention-days 7

# Verify settings
az storage account blob-service-properties show \
  --account-name $STORAGE_ACCOUNT
```

**✓ Phase 1 Complete**: Terraform state storage is ready

---

## Phase 2: Create Service Principal

### Step 2.1: Create Service Principal

```bash
# Set variables
SP_NAME="pcpc-terraform-dev-sp"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Create service principal
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name $SP_NAME \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID)

# Extract credentials
APP_ID=$(echo $SP_OUTPUT | jq -r '.appId')
PASSWORD=$(echo $SP_OUTPUT | jq -r '.password')
TENANT_ID=$(echo $SP_OUTPUT | jq -r '.tenant')

# Display credentials (SAVE THESE SECURELY!)
echo "=========================================="
echo "Service Principal Credentials"
echo "=========================================="
echo "Application (Client) ID: $APP_ID"
echo "Client Secret: $PASSWORD"
echo "Tenant ID: $TENANT_ID"
echo "Subscription ID: $SUBSCRIPTION_ID"
echo "=========================================="
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo "⚠️  The client secret cannot be retrieved later!"
echo ""

# Save to file (SECURE THIS FILE!)
cat > sp-credentials.txt <<EOF
ARM_CLIENT_ID=$APP_ID
ARM_CLIENT_SECRET=$PASSWORD
ARM_TENANT_ID=$TENANT_ID
ARM_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
EOF

echo "Credentials saved to sp-credentials.txt"
```

### Step 2.2: Grant Storage Access

```bash
# Get service principal object ID
SP_OBJECT_ID=$(az ad sp list --display-name $SP_NAME --query [0].id -o tsv)

# Grant Storage Blob Data Contributor role
az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT

# Verify role assignment
az role assignment list \
  --assignee $SP_OBJECT_ID \
  --output table
```

### Step 2.3: Test Service Principal

```bash
# Test authentication
az login --service-principal \
  --username $APP_ID \
  --password $PASSWORD \
  --tenant $TENANT_ID

# Test access to storage
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP

# Log back in as yourself
az login
```

**✓ Phase 2 Complete**: Service principal created and configured

---

## Phase 3: Configure Azure DevOps Service Connection

### Step 3.1: Navigate to Service Connections

1. Open browser to: `https://dev.azure.com/maber-devops/PCPC`
2. Click **Project Settings** (bottom left)
3. Under **Pipelines**, click **Service connections**
4. Click **New service connection**

### Step 3.2: Create Azure Resource Manager Connection

1. Select **Azure Resource Manager**
2. Click **Next**
3. Select **Service principal (manual)**
4. Click **Next**

### Step 3.3: Fill in Connection Details

Fill in the form with your saved credentials:

- **Subscription Id**: `<your-subscription-id>`
- **Subscription Name**: `<your-subscription-name>`
- **Service Principal Id**: `<APP_ID from Phase 2>`
- **Service Principal Key**: `<PASSWORD from Phase 2>`
- **Tenant ID**: `<TENANT_ID from Phase 2>`

### Step 3.4: Configure Connection Settings

- **Service connection name**: `pcpc-dev-terraform`
- **Description**: `Service connection for PCPC dev environment Terraform deployments`
- **Security**: Check "Grant access permission to all pipelines"

### Step 3.5: Verify and Save

1. Click **Verify** to test the connection
2. Wait for verification to complete (should show green checkmark)
3. Click **Verify and save**

**✓ Phase 3 Complete**: Service connection configured

---

## Phase 4: Create Variable Group

### Step 4.1: Navigate to Library

1. In Azure DevOps, click **Pipelines** → **Library**
2. Click **+ Variable group**

### Step 4.2: Configure Variable Group

**Variable group name**: `pcpc-terraform-dev`

**Description**: `Terraform variables for PCPC dev environment`

### Step 4.3: Add Variables

Add the following variables (use credentials from Phase 2):

| Variable Name              | Value                     | Secret? |
| -------------------------- | ------------------------- | ------- |
| `ARM_CLIENT_ID`            | `<APP_ID>`                | ✓ Yes   |
| `ARM_CLIENT_SECRET`        | `<PASSWORD>`              | ✓ Yes   |
| `ARM_SUBSCRIPTION_ID`      | `<SUBSCRIPTION_ID>`       | No      |
| `ARM_TENANT_ID`            | `<TENANT_ID>`             | No      |
| `TF_STATE_RESOURCE_GROUP`  | `pcpc-terraform-state-rg` | No      |
| `TF_STATE_STORAGE_ACCOUNT` | `<STORAGE_ACCOUNT>`       | No      |
| `TF_STATE_CONTAINER`       | `tfstate`                 | No      |
| `TF_VAR_environment`       | `dev`                     | No      |
| `TF_VAR_location`          | `eastus`                  | No      |

**To mark a variable as secret**:

1. Click the lock icon next to the variable value
2. The value will be hidden with asterisks

### Step 4.4: Configure Permissions

1. Under **Pipeline permissions**, click **+**
2. Select **PCPC** pipeline (or grant access to all pipelines)
3. Click **Save**

**✓ Phase 4 Complete**: Variable group created

---

## Phase 5: Create Environment with Approvals

### Step 5.1: Navigate to Environments

1. In Azure DevOps, click **Pipelines** → **Environments**
2. Click **New environment**

### Step 5.2: Create Environment

- **Name**: `pcpc-dev`
- **Description**: `PCPC development environment`
- **Resource**: Select **None** (we'll add resources later)
- Click **Create**

### Step 5.3: Add Approval Check

1. Click on the `pcpc-dev` environment
2. Click the **⋮** (three dots) in the top right
3. Select **Approvals and checks**
4. Click **+** → **Approvals**

### Step 5.4: Configure Approvals

**Approvers**:

- Add `devops@maber.io`
- Add `mike@maber.io`

**Advanced**:

- **Timeout**: 30 days
- **Minimum number of approvers**: 1
- **Allow approvers to approve their own runs**: Checked
- **Instructions to approvers**:

  ```
  Review the Terraform plan output before approving deployment.

  Check:
  - Resources to be created/modified/destroyed
  - Configuration changes
  - Cost implications

  Approve only if changes are expected and correct.
  ```

Click **Create**

**✓ Phase 5 Complete**: Environment with approvals configured

---

## Phase 6: Test Pipeline

### Step 6.1: Commit Pipeline Files

```bash
# Ensure you're in the PCPC repository
cd /workspace

# Check pipeline files exist
ls -la pipelines/

# Stage and commit
git add pipelines/
git commit -m "Add Azure DevOps infrastructure deployment pipeline"
git push origin main
```

### Step 6.2: Create Pipeline in Azure DevOps

1. Navigate to **Pipelines** → **Pipelines**
2. Click **New pipeline**
3. Select **Azure Repos Git** (or **GitHub** if using GitHub)
4. Select **PCPC** repository
5. Select **Existing Azure Pipelines YAML file**
6. Path: `/pipelines/azure-pipelines.yml`
7. Click **Continue**
8. Review the pipeline YAML
9. Click **Run**

### Step 6.3: Monitor Pipeline Execution

1. **Validate Stage**: Should complete automatically

   - Check format, validation, and lint steps
   - All should pass with green checkmarks

2. **Plan Stage**: Should complete automatically

   - Review Terraform plan output
   - Check resources to be created
   - Download plan artifact if needed

3. **Apply Stage**: Requires approval
   - Review the plan one more time
   - Click **Review** → **Approve**
   - Monitor apply progress
   - Check for successful completion

### Step 6.4: Verify Pipeline Success

Check that all stages completed successfully:

- ✓ Validate
- ✓ Plan
- ✓ Apply

**✓ Phase 6 Complete**: Pipeline executed successfully

---

## Phase 7: Verify Deployment

### Step 7.1: Check Azure Resources

```bash
# List resources in dev resource group
az resource list \
  --resource-group pcpc-rg-dev \
  --output table

# Expected resources:
# - Log Analytics Workspace (pcpc-log-dev)
# - Application Insights (pcpc-appi-dev)
# - Cosmos DB Account (pcpc-cosmos-dev)
# - Storage Account (pcpcstdev...)
# - Function App (pcpc-func-dev)
# - Static Web App (pcpc-swa-dev)
```

### Step 7.2: Run Validation Script

```bash
# Run deployment validation
./pipelines/scripts/validate-deployment.sh dev
```

### Step 7.3: Check Terraform State

```bash
# List state files
az storage blob list \
  --account-name $STORAGE_ACCOUNT \
  --container-name tfstate \
  --auth-mode login \
  --output table

# Should see: pcpc.dev.tfstate
```

### Step 7.4: Review Pipeline Artifacts

1. Go to the completed pipeline run
2. Click **Artifacts** (top right)
3. Download and review:
   - `tfplan-output-dev`: Terraform plan details
   - `terraform-outputs-dev`: Deployment outputs

**✓ Phase 7 Complete**: Deployment verified

---

## Post-Setup Tasks

### Configure Email Notifications

1. Navigate to **Project Settings** → **Notifications**
2. Click **New subscription**
3. Configure notifications for:
   - Build completed
   - Build failed
   - Release deployment approval pending
4. Add recipients: `devops@maber.io`, `mike@maber.io`

### Set Up Branch Policies

1. Navigate to **Repos** → **Branches**
2. Click **⋮** next to `main` → **Branch policies**
3. Configure:
   - Require a minimum number of reviewers: 1
   - Check for linked work items: Optional
   - Check for comment resolution: Required
   - Build validation: Add PCPC pipeline

### Document Credentials

Store the following securely (e.g., Azure Key Vault, password manager):

- Service principal credentials
- Storage account name
- Subscription ID
- Tenant ID

### Clean Up Temporary Files

```bash
# Remove credential files from local machine
rm -f sp-credentials.txt
rm -f storage-account-name.txt

# Ensure they're not committed to git
git status
```

---

## Troubleshooting

### Issue: Service Principal Creation Fails

**Error**: "Insufficient privileges to complete the operation"

**Solution**: You need Owner or User Access Administrator role on the subscription

### Issue: Storage Account Name Already Taken

**Error**: "The storage account named 'pcpctfstate...' is already taken"

**Solution**: Run the command again to generate a new random suffix

### Issue: Pipeline Can't Access Variable Group

**Error**: "Variable group 'pcpc-terraform-dev' could not be found"

**Solution**:

1. Check variable group name matches exactly
2. Verify pipeline has permission to access variable group
3. Check variable group is in the correct project

### Issue: Terraform State Lock

**Error**: "Error acquiring the state lock"

**Solution**:

```bash
# Break the lease
az storage blob lease break \
  --account-name $STORAGE_ACCOUNT \
  --container-name tfstate \
  --blob-name pcpc.dev.tfstate
```

---

## Next Steps

1. **Add Staging Environment**: Repeat setup for staging
2. **Add Production Environment**: Repeat setup for production with stricter approvals
3. **Configure Monitoring**: Set up Azure Monitor alerts
4. **Document Runbooks**: Create operational procedures
5. **Train Team**: Share pipeline documentation with team

---

## Support

For issues or questions:

- Email: devops@maber.io
- Documentation: See `pipelines/README.md`
- Azure DevOps: https://dev.azure.com/maber-devops/PCPC

---

## Appendix: Quick Reference

### Storage Account Details

```bash
Resource Group: pcpc-terraform-state-rg
Storage Account: pcpctfstate<random>
Container: tfstate
Location: eastus
```

### Service Principal Details

```bash
Name: pcpc-terraform-dev-sp
Role: Contributor
Scope: Subscription
Additional Role: Storage Blob Data Contributor
```

### Azure DevOps Configuration

```bash
Organization: maber-devops
Project: PCPC
Service Connection: pcpc-dev-terraform
Variable Group: pcpc-terraform-dev
Environment: pcpc-dev
```

### Pipeline Files

```bash
Main Pipeline: pipelines/azure-pipelines.yml
Templates: pipelines/templates/*.yml
Scripts: pipelines/scripts/*.sh
Documentation: pipelines/README.md
```
