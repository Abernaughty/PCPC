# PCPC Multi-Stage Pipeline Setup Guide

This guide walks you through setting up the complete CI/CD pipeline infrastructure in Azure DevOps, from initial configuration to end-to-end testing.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure DevOps Configuration](#azure-devops-configuration)
3. [Service Connections Setup](#service-connections-setup)
4. [Variable Groups Configuration](#variable-groups-configuration)
5. [Environment Setup](#environment-setup)
6. [Pipeline Configuration](#pipeline-configuration)
7. [Testing the Pipeline](#testing-the-pipeline)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:

- ✅ Azure DevOps organization and project created
- ✅ Azure subscription with appropriate permissions
- ✅ Service principals created for each environment (dev, staging, prod)
- ✅ Azure Key Vaults created and populated with secrets
- ✅ Repository pushed to GitHub (https://github.com/Abernaughty/PCPC.git)

**Note**: This guide covers setup for **GitHub repositories**. Azure Pipelines integrates seamlessly with GitHub through OAuth authentication.

## Azure DevOps Configuration

### 1. Project Settings

1. Navigate to your Azure DevOps project
2. Go to **Project Settings** (bottom left)
3. Verify the following settings:
   - **General** → Project name: `PCPC`
   - **Repositories** → Default branch: `main`
   - **Pipelines** → Settings → Disable creation of classic pipelines

### 2. Repository Connection (GitHub)

Since you're using a GitHub repository, you'll need to set up the GitHub service connection:

1. Go to **Project Settings** → **Service connections**
2. Click **New service connection** → **GitHub**
3. Select **Grant authorization** (recommended) or **Personal access token**
4. If using Grant authorization:
   - Click **Authorize** button
   - Sign in to GitHub if prompted
   - Authorize Azure Pipelines to access your repositories
5. Name the connection: `github-pcpc`
6. Check **Grant access permission to all pipelines**
7. Click **Save**

**Important**: This connection allows Azure Pipelines to:

- Read your repository code
- Report build status to pull requests
- Trigger builds on commits and PRs

**Verification**: After setup, you should see your GitHub repositories when creating new pipelines.

## Service Connections Setup

Create three Azure Resource Manager service connections (one per environment):

### Dev Environment Service Connection

1. Go to **Project Settings** → **Service connections**
2. Click **New service connection** → **Azure Resource Manager**
3. Select **Service principal (manual)**
4. Fill in the details:
   - **Service connection name**: `az-pcpc-dev`
   - **Subscription ID**: Your Azure subscription ID
   - **Subscription Name**: Your subscription name
   - **Service Principal Id**: Client ID from dev service principal
   - **Service Principal Key**: Client secret from dev service principal
   - **Tenant ID**: Your Azure AD tenant ID
5. Click **Verify** to test the connection
6. Check **Grant access permission to all pipelines**
7. Click **Verify and save**

### Staging Environment Service Connection

Repeat the above steps with these values:

- **Service connection name**: `az-pcpc-staging`
- **Service Principal Id**: Client ID from staging service principal
- **Service Principal Key**: Client secret from staging service principal

### Production Environment Service Connection

Repeat the above steps with these values:

- **Service connection name**: `az-pcpc-prod`
- **Service Principal Id**: Client ID from prod service principal
- **Service Principal Key**: Client secret from prod service principal

## Variable Groups Configuration

Create six variable groups (two per environment: secrets + config):

### Dev Environment Variable Groups

#### 1. vg-pcpc-dev-secrets (Linked to Key Vault)

1. Go to **Pipelines** → **Library** → **+ Variable group**
2. Name: `vg-pcpc-dev-secrets`
3. Enable **Link secrets from an Azure key vault as variables**
4. Select:
   - **Azure subscription**: `az-pcpc-dev`
   - **Key vault name**: `pcpc-kv-dev`
5. Click **Authorize** if prompted
6. Click **+ Add** and select these secrets:
   - `POKEMON-TCG-API-KEY`
   - `POKEDATA-API-KEY`
   - `ARM-CLIENT-ID`
   - `ARM-CLIENT-SECRET`
7. Check **Allow access to all pipelines**
8. Click **Save**

#### 2. vg-pcpc-dev (Configuration Variables)

1. Create another variable group named `vg-pcpc-dev`
2. Add these variables (click **+ Add** for each):

**Terraform Backend Configuration:**

```
TF_BACKEND_RESOURCE_GROUP = pcpc-terraform-state-rg
TF_BACKEND_STORAGE_ACCOUNT = pcpctfstatedacc29c2
TF_BACKEND_CONTAINER = tfstate
TF_BACKEND_KEY = dev.terraform.tfstate
```

**Azure Resource Configuration:**

```
AZURE_SUBSCRIPTION_ID = <your-subscription-id>
AZURE_TENANT_ID = <your-tenant-id>
RESOURCE_GROUP_NAME = pcpc-rg-dev
LOCATION = eastus
```

**Application Configuration:**

```
COSMOS_DB_NAME = pcpc-cosmos-dev
COSMOS_DATABASE_NAME = PokeData
STORAGE_ACCOUNT_NAME = pcpcstdev
FUNCTION_APP_NAME = pcpc-func-dev
STATIC_WEB_APP_NAME = pcpc-swa-dev
APIM_NAME = pcpc-apim-dev
```

**Feature Flags:**

```
ENABLE_REDIS_CACHE = false
ENABLE_API_MANAGEMENT = true
ENABLE_APPLICATION_INSIGHTS = true
```

3. Check **Allow access to all pipelines**
4. Click **Save**

### Staging Environment Variable Groups

Repeat the above process for staging:

- Variable group names: `vg-pcpc-staging-secrets` and `vg-pcpc-staging`
- Key vault: `pcpc-kv-staging`
- Resource names: Replace `dev` with `staging` (e.g., `pcpc-rg-staging`)

### Production Environment Variable Groups

Repeat the above process for production:

- Variable group names: `vg-pcpc-prod-secrets` and `vg-pcpc-prod`
- Key vault: `pcpc-kv-prod`
- Resource names: Replace `dev` with `prod` (e.g., `pcpc-rg-prod`)

## Environment Setup

Create three environments with approval gates:

### Dev Environment

1. Go to **Pipelines** → **Environments**
2. Click **New environment**
3. Name: `pcpc-dev`
4. Description: `Development environment - auto-deploy`
5. Resource: None (leave empty)
6. Click **Create**
7. **No approval gates needed** (auto-deploy)

### Staging Environment

1. Create new environment named `pcpc-staging`
2. Description: `Staging environment - requires approval`
3. After creation, click on the environment
4. Click **⋮** (three dots) → **Approvals and checks**
5. Click **+** → **Approvals**
6. Add approvers:
   - `devops@maber.io`
   - `mike@maber.io`
7. Set **Minimum number of approvers**: 1
8. Check **Allow approvers to approve their own runs**
9. Set **Timeout**: 30 days
10. Click **Create**

### Production Environment

1. Create new environment named `pcpc-prod`
2. Description: `Production environment - requires approval`
3. Configure approvals same as staging:
   - Approvers: `devops@maber.io`, `mike@maber.io`
   - Minimum approvers: 1
   - Timeout: 30 days

## Pipeline Configuration

### 1. Create PR Validation Pipeline

1. Go to **Pipelines** → **Pipelines**
2. Click **New pipeline**
3. Select **GitHub** as your repository source
4. Select your repository: **Abernaughty/PCPC**
   - If this is your first time, you'll be prompted to authorize Azure Pipelines
   - Click **Approve & Install** to grant access
5. Select **Existing Azure Pipelines YAML file**
6. Branch: `main`
7. Path: `/.ado/azure-pipelines-pr.yml`
8. Click **Continue**
9. Review the YAML, then click **Save** (don't run yet)
10. Click **⋮** → **Rename/move**
11. Name: `PCPC-PR-Validation`
12. Click **Save**

**GitHub Integration**: This pipeline will automatically:

- Trigger on pull requests to `main`
- Report status back to GitHub
- Block PR merging if validation fails (once branch protection is configured)

### 2. Configure Branch Protection Rules (GitHub)

Since you're using GitHub, branch policies are configured in GitHub (not Azure DevOps):

1. Go to your GitHub repository: https://github.com/Abernaughty/PCPC
2. Click **Settings** → **Branches**
3. Under **Branch protection rules**, click **Add rule**
4. Configure the rule:
   - **Branch name pattern**: `main`
   - Check **Require a pull request before merging**
   - Check **Require status checks to pass before merging**
   - **Important**: The status check name will appear after the first pipeline run. Look for it in the search box - it will be something like `{Organization}.PCPC-PR-Validation` or similar
   - Check **Require branches to be up to date before merging**
   - Optional: Check **Require approvals** and set to 1 (for solo dev, you can approve your own PRs)
   - Click **Create** or **Save changes**

**How it works**:

- When you create a PR, GitHub triggers the Azure Pipeline
- The pipeline status is reported back to GitHub
- GitHub blocks merging until the pipeline passes
- This ensures all code is validated before reaching main

**Note**: The exact status check name won't appear in the list until the pipeline has run at least once. After creating a test PR and seeing the pipeline run, check the PR's "Checks" tab to see the exact name, then add it to branch protection.

### 3. Create Multi-Stage CD Pipeline

1. Go to **Pipelines** → **Pipelines**
2. Click **New pipeline**
3. Select **GitHub** as your repository source
4. Select your repository: **Abernaughty/PCPC**
5. Select **Existing Azure Pipelines YAML file**
6. Branch: `main`
7. Path: `/.ado/azure-pipelines.yml`
8. Click **Continue**
9. Review the YAML, then click **Save** (don't run yet)
10. Click **⋮** → **Rename/move**
11. Name: `PCPC-Multi-Stage-CD`
12. Click **Save**

**GitHub Integration**: This pipeline will automatically:

- Trigger on commits to `main` branch
- Trigger when PRs are merged
- Report deployment status to GitHub

### 4. Configure Pipeline Permissions

For both pipelines:

1. Click on the pipeline
2. Click **⋮** → **Security**
3. Verify these permissions:
   - **Project Collection Build Service**: Allow all
   - **[Project] Build Service**: Allow all
4. Go to **Project Settings** → **Service connections**
5. For each service connection (`az-pcpc-dev`, `az-pcpc-staging`, `az-pcpc-prod`):
   - Click on the connection
   - Click **⋮** → **Security**
   - Add **[Project] Build Service** with **User** role

## Testing the Pipeline

### Phase 1: Test PR Validation Pipeline

1. Create a new branch:

   ```bash
   git checkout -b test/pipeline-validation
   ```

2. Make a small change (e.g., update README.md)

3. Commit and push:

   ```bash
   git add .
   git commit -m "test: Validate PR pipeline"
   git push origin test/pipeline-validation
   ```

4. Create a Pull Request in Azure DevOps:

   - Go to **Repos** → **Pull requests**
   - Click **New pull request**
   - Source: `test/pipeline-validation`
   - Target: `main`
   - Click **Create**

5. Verify PR validation runs automatically:

   - Check **Checks** tab in PR
   - Should see `PCPC-PR-Validation` running
   - Wait for completion (~5-10 minutes)
   - All checks should pass ✅

6. Complete the PR (merge to main)

### Phase 2: Test Multi-Stage CD Pipeline

1. After merging PR, the CD pipeline should trigger automatically

2. Monitor the pipeline:

   - Go to **Pipelines** → **Pipelines**
   - Click on `PCPC-Multi-Stage-CD`
   - Click on the running build

3. Verify Build Stage:

   - Should complete in ~5 minutes
   - Check artifact is published
   - Download artifact and verify structure:
     ```
     drop/
       release.json
       checksums.txt
       swa/
       functions.zip
       apim/
     ```

4. Verify Dev Deployment:

   - Should auto-deploy after build
   - Monitor each job:
     - Deploy Infrastructure (~10 minutes)
     - Deploy Functions (~5 minutes)
     - Deploy Frontend (~3 minutes)
     - Smoke Tests (~2 minutes)
   - All jobs should succeed ✅

5. Approve Staging Deployment:

   - Pipeline will pause at `Deploy_Staging` stage
   - Click **Review** button
   - Review deployment details
   - Click **Approve**
   - Add comment: "Approved for staging deployment"
   - Click **Approve** again

6. Verify Staging Deployment:

   - Monitor deployment progress
   - Verify all jobs complete successfully
   - Check smoke tests pass

7. Approve Production Deployment:

   - Pipeline will pause at `Deploy_Prod` stage
   - Click **Review** button
   - Review deployment details carefully
   - Click **Approve**
   - Add comment: "Approved for production deployment"
   - Click **Approve** again

8. Verify Production Deployment:
   - Monitor deployment progress
   - Verify all jobs complete successfully
   - Check final deployment summary

### Phase 3: Verify Deployed Applications

#### Dev Environment

```bash
# Function App
curl https://pcpc-func-dev.azurewebsites.net/api/health

# Static Web App
curl https://pcpc-swa-dev.azurestaticapps.net
```

#### Staging Environment

```bash
# Function App
curl https://pcpc-func-staging.azurewebsites.net/api/health

# Static Web App
curl https://pcpc-swa-staging.azurestaticapps.net
```

#### Production Environment

```bash
# Function App
curl https://pcpc-func-prod.azurewebsites.net/api/health

# Static Web App
curl https://pcpc-swa-prod.azurestaticapps.net
```

## Troubleshooting

### Pipeline Fails at Build Stage

**Symptom**: Build stage fails with npm or compilation errors

**Solutions**:

1. Check Node.js version matches (22.x)
2. Verify all dependencies in package.json
3. Run build locally to reproduce:
   ```bash
   cd app/frontend && npm install && npm run build
   cd app/backend && npm install && npm run build
   ```

### Pipeline Fails at Infrastructure Deployment

**Symptom**: Terraform fails with authentication or permission errors

**Solutions**:

1. Verify service principal has Contributor role on subscription
2. Check service connection is authorized
3. Verify Terraform backend storage account exists
4. Check variable group values are correct

### Pipeline Fails at Function App Deployment

**Symptom**: Function deployment fails or times out

**Solutions**:

1. Verify Function App exists in Azure
2. Check service principal has permissions
3. Verify functions.zip artifact is valid
4. Check Function App configuration in Azure Portal

### Pipeline Fails at Static Web App Deployment

**Symptom**: SWA deployment fails with token or permission errors

**Solutions**:

1. Verify Static Web App exists in Azure
2. Check deployment token is valid
3. Verify swa/ directory in artifact
4. Check staticwebapp.config.json is present

### Smoke Tests Fail

**Symptom**: Deployment succeeds but smoke tests fail

**Solutions**:

1. Check deployed URLs are accessible
2. Verify health endpoints return 200 OK
3. Check Application Insights for errors
4. Review smoke test script output for specific failures

### Approval Gates Not Working

**Symptom**: Pipeline doesn't pause for approval

**Solutions**:

1. Verify environment is configured with approvals
2. Check approvers are added correctly
3. Verify pipeline uses `deployment` job type for staging/prod
4. Check environment name matches exactly (case-sensitive)

## Next Steps

After successful pipeline setup:

1. **Configure Monitoring**:

   - Set up Azure Monitor dashboards
   - Configure alert rules
   - Review Application Insights data

2. **Optimize Pipeline**:

   - Add path-based triggers for selective deployment
   - Implement parallel deployments where possible
   - Add performance benchmarks

3. **Enhance Testing**:

   - Add API contract tests
   - Implement E2E tests with Playwright
   - Add load testing for production

4. **Documentation**:
   - Document deployment procedures
   - Create runbooks for common operations
   - Update architecture diagrams

## Support

For issues or questions:

- **Email**: devops@maber.io
- **Documentation**: See `/docs` directory
- **Azure DevOps**: Create work item in project

---

**Last Updated**: October 5, 2025  
**Version**: 1.0.0  
**Maintained By**: DevOps Team
