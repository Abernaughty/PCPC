# PCPC Azure DevOps Pipeline

## Overview

This directory contains the Azure DevOps pipeline configuration for deploying PCPC infrastructure using Terraform. The pipeline implements Infrastructure as Code (IaC) best practices with automated validation, planning, and deployment stages.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Azure DevOps Pipeline                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Stage 1: Validate                                           │
│  ├─ Terraform Format Check                                   │
│  ├─ Terraform Validate                                       │
│  └─ Terraform Lint (tflint)                                  │
│                                                               │
│  Stage 2: Plan                                               │
│  ├─ Terraform Init (with backend)                            │
│  ├─ Terraform Plan                                           │
│  ├─ Publish Plan Artifact                                    │
│  └─ Display Plan Summary                                     │
│                                                               │
│  Stage 3: Apply                                              │
│  ├─ Download Plan Artifact                                   │
│  ├─ Terraform Init (with backend)                            │
│  ├─ Terraform Apply                                          │
│  ├─ Display Outputs                                          │
│  └─ Post-Deployment Validation                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
pipelines/
├── azure-pipelines.yml              # Main pipeline definition
├── templates/
│   ├── terraform-validate.yml       # Validation stage template
│   ├── terraform-plan.yml           # Plan stage template
│   └── terraform-apply.yml          # Apply stage template
├── scripts/
│   ├── setup-backend.sh             # Backend validation script
│   └── validate-deployment.sh       # Post-deployment validation
└── README.md                        # This file
```

## Prerequisites

### 1. Azure Infrastructure

Before running the pipeline, you must create the following Azure resources:

#### Terraform State Storage Account

```bash
# Set variables
RESOURCE_GROUP="pcpc-terraform-state-rg"
STORAGE_ACCOUNT="pcpctfstate$(openssl rand -hex 4)"
CONTAINER_NAME="tfstate"
LOCATION="eastus"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --encryption-services blob \
  --https-only true \
  --min-tls-version TLS1_2

# Create container
az storage container create \
  --name $CONTAINER_NAME \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login

# Enable versioning
az storage account blob-service-properties update \
  --account-name $STORAGE_ACCOUNT \
  --enable-versioning true
```

#### Service Principal for Dev Environment

```bash
# Create service principal
SP_NAME="pcpc-terraform-dev-sp"
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name $SP_NAME \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID

# Grant storage access
SP_OBJECT_ID=$(az ad sp list --display-name $SP_NAME --query [0].id -o tsv)

az role assignment create \
  --assignee $SP_OBJECT_ID \
  --role "Storage Blob Data Contributor" \
  --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT
```

### 2. Azure DevOps Configuration

#### Create Service Connection

1. Navigate to: **Azure DevOps** → **PCPC Project** → **Project Settings** → **Service connections**
2. Click **New service connection** → **Azure Resource Manager**
3. Select **Service principal (manual)**
4. Fill in details:
   - Service connection name: `pcpc-dev-terraform`
   - Subscription ID: `<your-subscription-id>`
   - Service Principal Id: `<appId from SP creation>`
   - Service Principal Key: `<password from SP creation>`
   - Tenant ID: `<tenant from SP creation>`
5. Verify connection and save

#### Create Variable Group

1. Navigate to: **Pipelines** → **Library** → **+ Variable group**
2. Name: `pcpc-terraform-dev`
3. Add variables:
   - `ARM_CLIENT_ID`: `<appId>` (Secret)
   - `ARM_CLIENT_SECRET`: `<password>` (Secret)
   - `ARM_SUBSCRIPTION_ID`: `<subscription-id>`
   - `ARM_TENANT_ID`: `<tenant-id>`
   - `TF_STATE_RESOURCE_GROUP`: `pcpc-terraform-state-rg`
   - `TF_STATE_STORAGE_ACCOUNT`: `<storage-account-name>`
   - `TF_STATE_CONTAINER`: `tfstate`
   - `TF_VAR_environment`: `dev`
   - `TF_VAR_location`: `eastus`
4. Save variable group

#### Create Environment

1. Navigate to: **Pipelines** → **Environments** → **New environment**
2. Name: `pcpc-dev`
3. Add approval check:
   - Approvers: `devops@maber.io`, `mike@maber.io`
   - Timeout: 30 days
   - Instructions: "Review Terraform plan before approving"

## Pipeline Configuration

### Main Pipeline (`azure-pipelines.yml`)

The main pipeline orchestrates three stages:

1. **Validate**: Checks Terraform syntax, formatting, and best practices
2. **Plan**: Generates execution plan and publishes artifacts
3. **Apply**: Applies infrastructure changes with approval gates

### Triggers

- **Branch Trigger**: Runs on commits to `main` branch
- **Path Trigger**: Only runs when changes are made to:
  - `infra/**`
  - `pipelines/**`
- **Pull Request**: Runs validation on PRs to `main`

### Variables

- `terraformVersion`: `1.13.3`
- `workingDirectory`: `$(System.DefaultWorkingDirectory)/infra/envs/dev`
- Variable group: `pcpc-terraform-dev`

## Usage

### Running the Pipeline

1. **Commit Changes**: Push changes to `main` branch or create a PR
2. **Monitor Pipeline**: Navigate to **Pipelines** → **PCPC Infrastructure**
3. **Review Plan**: Check plan output in the Plan stage
4. **Approve Deployment**: Approve in the `pcpc-dev` environment (if required)
5. **Verify Deployment**: Check Apply stage outputs and validation

### Manual Pipeline Run

1. Navigate to **Pipelines** → **PCPC Infrastructure**
2. Click **Run pipeline**
3. Select branch: `main`
4. Click **Run**

### Viewing Terraform Outputs

After successful deployment:

1. Navigate to the completed pipeline run
2. Go to **Apply** stage → **Display Terraform Outputs** step
3. View JSON output with resource details

Alternatively, download the `terraform-outputs-dev` artifact.

## Helper Scripts

### Backend Validation (`scripts/setup-backend.sh`)

Validates Terraform backend configuration:

```bash
# Run locally
export TF_STATE_RESOURCE_GROUP="pcpc-terraform-state-rg"
export TF_STATE_STORAGE_ACCOUNT="pcpctfstate1a2b3c4d"
export TF_STATE_CONTAINER="tfstate"

./pipelines/scripts/setup-backend.sh
```

### Deployment Validation (`scripts/validate-deployment.sh`)

Validates deployed infrastructure:

```bash
# Run locally
./pipelines/scripts/validate-deployment.sh dev
```

## Troubleshooting

### Common Issues

#### 1. State Lock Errors

**Symptom**: "Error acquiring the state lock"

**Solution**:

```bash
# Check for existing lease
az storage blob lease break \
  --account-name $STORAGE_ACCOUNT \
  --container-name tfstate \
  --blob-name pcpc.dev.tfstate
```

#### 2. Authentication Failures

**Symptom**: "Error: building AzureRM Client: obtain subscription"

**Solution**:

- Verify service principal credentials in variable group
- Check service principal has Contributor role
- Ensure service connection is working

#### 3. Plan Artifact Not Found

**Symptom**: "Artifact 'tfplan-dev' not found"

**Solution**:

- Check Plan stage completed successfully
- Verify artifact was published
- Ensure Apply stage depends on Plan stage

#### 4. Backend Initialization Fails

**Symptom**: "Error: Failed to get existing workspaces"

**Solution**:

- Verify storage account exists
- Check service principal has Storage Blob Data Contributor role
- Validate backend configuration variables

### Debug Mode

Enable debug logging:

```bash
# Set system debug variable in pipeline
variables:
  - name: system.debug
    value: true
```

## Security Best Practices

1. **Service Principal**: Use dedicated service principal per environment
2. **Secrets**: Store all credentials in Azure Key Vault or variable groups
3. **State File**: Enable blob versioning and soft delete
4. **Approval Gates**: Require manual approval for production deployments
5. **Audit Logging**: Enable Azure Monitor for pipeline activity

## Notifications

Email notifications are configured for:

- Pipeline failures
- Deployment completions
- Approval requests

Recipients:

- devops@maber.io
- mike@maber.io

## Next Steps

### Adding Staging Environment

1. Create staging service principal
2. Create `pcpc-terraform-staging` variable group
3. Create `pcpc-staging` environment
4. Update `azure-pipelines.yml` to add staging stages

### Adding Production Environment

1. Create production service principal
2. Create `pcpc-terraform-prod` variable group
3. Create `pcpc-prod` environment with multiple approvers
4. Update `azure-pipelines.yml` to add production stages
5. Add change advisory board (CAB) approval process

## Support

For issues or questions:

- Create an issue in the PCPC repository
- Contact: devops@maber.io
- Documentation: See `docs/deployment-guide.md`

## References

- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure DevOps Pipelines](https://docs.microsoft.com/en-us/azure/devops/pipelines/)
- [Terraform Backend Configuration](https://www.terraform.io/docs/language/settings/backends/azurerm.html)
- [PCPC Architecture Documentation](../docs/architecture.md)
