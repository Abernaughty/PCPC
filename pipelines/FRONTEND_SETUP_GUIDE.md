# Frontend Pipeline Setup Guide

Complete guide for setting up the PCPC Frontend deployment pipeline in Azure DevOps.

## Overview

The frontend pipeline builds and deploys the Svelte application to Azure Static Web Apps with comprehensive testing and verification.

## Pipeline Architecture

```
Frontend Pipeline
├── Stage 1: Build & Test
│   ├── Install Node.js 22.x
│   ├── Install dependencies (npm ci)
│   ├── Run unit tests (Jest)
│   ├── Publish test results
│   ├── Publish code coverage
│   ├── Build production bundle (Rollup)
│   ├── Verify build output
│   └── Publish build artifacts
│
└── Stage 2: Deploy
    ├── Download build artifacts
    ├── Deploy to Static Web App
    ├── Wait for propagation (30s)
    ├── Run smoke tests
    └── Display deployment summary
```

## Prerequisites

### 1. Azure Resources (Already Created by Infrastructure Pipeline)

- ✅ Azure Static Web App: `pcpc-swa-dev`
- ✅ Resource Group: `pcpc-rg-dev`
- ✅ Application Insights: `pcpc-appi-dev`

### 2. Azure DevOps Setup Required

You need to configure the following in Azure DevOps:

#### A. Service Connection

#### B. Variable Group

#### C. Environment

#### D. Pipeline

---

## Step-by-Step Setup

### Step 1: Get Static Web App Deployment Token

1. **Open Azure Portal**

   - Navigate to: https://portal.azure.com

2. **Find Your Static Web App**

   ```
   Resource Groups → pcpc-rg-dev → pcpc-swa-dev
   ```

3. **Get Deployment Token**
   - Click on "Manage deployment token" in the left menu
   - Click "Reset deployment token" (if needed)
   - Copy the token (you'll need this for the variable group)
   - **IMPORTANT**: Save this token securely - you can't view it again!

### Step 2: Create Service Connection (Optional)

The pipeline uses a deployment token instead of a service connection, but you can create one for consistency:

1. **Navigate to Project Settings**

   ```
   Azure DevOps → PCPC Project → Project Settings → Service connections
   ```

2. **Create New Service Connection**
   - Click "New service connection"
   - Select "Azure Resource Manager"
   - Choose "Service principal (automatic)"
   - Scope: Subscription
   - Resource Group: `pcpc-rg-dev`
   - Service connection name: `pcpc-dev-static-web-app`
   - Grant access to all pipelines: ✓

### Step 3: Create Variable Group

1. **Navigate to Library**

   ```
   Azure DevOps → PCPC Project → Pipelines → Library
   ```

2. **Create Variable Group**

   - Click "+ Variable group"
   - Name: `pcpc-frontend-dev`
   - Description: "Frontend deployment variables for dev environment"

3. **Add Variables**

   | Variable Name                                | Value                                         | Secret? | Description                     |
   | -------------------------------------------- | --------------------------------------------- | ------- | ------------------------------- |
   | `AZURE_STATIC_WEB_APPS_API_TOKEN`            | `<your-deployment-token>`                     | ✓ Yes   | Deployment token from Step 1    |
   | `VITE_API_BASE_URL`                          | `https://pcpc-func-dev.azurewebsites.net/api` | No      | Backend API URL                 |
   | `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | `<from-terraform-output>`                     | ✓ Yes   | Application Insights connection |
   | `VITE_APPLICATIONINSIGHTS_ROLE_NAME`         | `pcpc-frontend`                               | No      | Service name for tracing        |
   | `VITE_ENVIRONMENT`                           | `development`                                 | No      | Environment identifier          |

4. **Get Application Insights Connection String**

   ```bash
   # From Azure Portal
   Resource Groups → pcpc-rg-dev → pcpc-appi-dev → Properties

   # Or from Terraform output
   cd infra/envs/dev
   terraform output application_insights_connection_string
   ```

5. **Save Variable Group**
   - Click "Save"
   - Grant pipeline access: Click "Pipeline permissions" → "+" → Select "frontend-pipeline"

### Step 4: Create Environment

1. **Navigate to Environments**

   ```
   Azure DevOps → PCPC Project → Pipelines → Environments
   ```

2. **Create Environment**

   - Click "New environment"
   - Name: `pcpc-dev`
   - Description: "PCPC Development Environment"
   - Resource: None (we'll add approvals later)
   - Click "Create"

3. **Configure Approvals (Optional)**
   - Click on `pcpc-dev` environment
   - Click "..." → "Approvals and checks"
   - Click "+" → "Approvals"
   - Add approvers: `devops@maber.io`, `mike@maber.io`
   - Minimum approvers: 1
   - Click "Create"

### Step 5: Create Pipeline

1. **Navigate to Pipelines**

   ```
   Azure DevOps → PCPC Project → Pipelines → Pipelines
   ```

2. **Create New Pipeline**

   - Click "New pipeline"
   - Select "Azure Repos Git"
   - Select repository: `PCPC`
   - Select "Existing Azure Pipelines YAML file"
   - Path: `/pipelines/frontend-pipeline.yml`
   - Click "Continue"

3. **Review Pipeline**

   - Review the YAML configuration
   - Click "Run" to test (or "Save" to save without running)

4. **Rename Pipeline (Optional)**
   - Click "..." → "Rename/move"
   - Name: `PCPC Frontend Deployment`
   - Folder: `\` (root)
   - Click "Save"

---

## Pipeline Configuration

### Triggers

The pipeline automatically runs when:

```yaml
# Main branch commits affecting frontend
trigger:
  branches: [main]
  paths:
    - app/frontend/**
    - pipelines/frontend-pipeline.yml
    - pipelines/templates/frontend-*.yml

# Pull requests to main
pr:
  branches: [main]
  paths: [app/frontend/**]
```

### Variables Used

| Variable                                     | Source         | Purpose                   |
| -------------------------------------------- | -------------- | ------------------------- |
| `nodeVersion`                                | Pipeline       | Node.js version (22.x)    |
| `workingDirectory`                           | Pipeline       | Frontend source path      |
| `staticWebAppName`                           | Pipeline       | Static Web App name       |
| `AZURE_STATIC_WEB_APPS_API_TOKEN`            | Variable Group | Deployment authentication |
| `VITE_API_BASE_URL`                          | Variable Group | Backend API endpoint      |
| `VITE_APPLICATIONINSIGHTS_CONNECTION_STRING` | Variable Group | Monitoring connection     |
| `VITE_APPLICATIONINSIGHTS_ROLE_NAME`         | Variable Group | Service identifier        |
| `VITE_ENVIRONMENT`                           | Variable Group | Environment name          |

---

## Testing Strategy

### Unit Tests (Jest)

**What's Tested:**

- Svelte component rendering
- Component interactions
- Store behavior
- Service layer logic
- Utility functions

**Command:**

```bash
npm test -- --selectProjects=frontend --ci --coverage
```

**Results:**

- Published to Azure DevOps test results
- Coverage reports available in pipeline
- Pipeline fails if tests fail

### Build Validation

**What's Validated:**

- Rollup build succeeds
- No compilation errors
- All imports resolve
- Environment variables inject
- Bundle files created

**Verification:**

```bash
# Checks for:
- public/build/ directory exists
- public/build/bundle.js exists
- File sizes are reasonable
```

### Smoke Tests (Post-Deployment)

**What's Tested:**

- Site accessibility (HTTP 200)
- HTML content validity
- JavaScript bundle loads
- CSS files accessible
- Response headers correct

**Script:**

```bash
pipelines/scripts/verify-frontend-deployment.sh pcpc-swa-dev
```

---

## First Run Checklist

Before running the pipeline for the first time:

- [ ] Static Web App deployment token obtained
- [ ] Variable group `pcpc-frontend-dev` created with all variables
- [ ] Environment `pcpc-dev` created
- [ ] Service connection `pcpc-dev-static-web-app` created (optional)
- [ ] Pipeline created from `frontend-pipeline.yml`
- [ ] Variable group granted pipeline access
- [ ] Backend API is deployed (for API_BASE_URL)
- [ ] Application Insights connection string obtained

---

## Running the Pipeline

### Manual Run

1. **Navigate to Pipeline**

   ```
   Pipelines → PCPC Frontend Deployment → Run pipeline
   ```

2. **Select Branch**

   - Branch/tag: `main`
   - Click "Run"

3. **Monitor Progress**
   - Watch build stage (unit tests, build)
   - Review test results
   - Watch deploy stage
   - Check smoke test results

### Automatic Run

Pipeline runs automatically when:

- Code is pushed to `main` branch
- Changes affect `app/frontend/**` files
- Pull request is created to `main`

---

## Troubleshooting

### Build Stage Issues

#### Tests Failing

```bash
# Run tests locally first
cd app/frontend
npm test -- --selectProjects=frontend

# Check test output
npm test -- --selectProjects=frontend --verbose
```

#### Build Failing

```bash
# Run build locally
cd app/frontend
npm run build

# Check for errors
npm run build -- --verbose
```

#### Missing Dependencies

```bash
# Verify package.json
cd app/frontend
npm ci

# Check for missing packages
npm ls
```

### Deploy Stage Issues

#### Deployment Token Invalid

- Regenerate token in Azure Portal
- Update variable group with new token
- Re-run pipeline

#### Static Web App Not Found

```bash
# Verify Static Web App exists
az staticwebapp list --resource-group pcpc-rg-dev

# Check name matches pipeline
# Should be: pcpc-swa-dev
```

#### Smoke Tests Failing

```bash
# Test manually
curl -I https://pcpc-swa-dev.azurestaticapps.net

# Check deployment status in Azure Portal
# Resource Groups → pcpc-rg-dev → pcpc-swa-dev → Deployments
```

### Variable Issues

#### Environment Variables Not Injected

- Verify variable group name: `pcpc-frontend-dev`
- Check variable names start with `VITE_`
- Ensure pipeline has access to variable group
- Re-run pipeline after variable changes

#### API URL Not Working

```bash
# Test backend API
curl https://pcpc-func-dev.azurewebsites.net/api/health

# Verify VITE_API_BASE_URL in variable group
# Should be: https://pcpc-func-dev.azurewebsites.net/api
```

---

## Pipeline Outputs

### Test Results

View in Azure DevOps:

```
Pipeline Run → Tests tab
```

Shows:

- Total tests run
- Pass/fail status
- Test duration
- Historical trends

### Code Coverage

View in Azure DevOps:

```
Pipeline Run → Code Coverage tab
```

Shows:

- Line coverage %
- Branch coverage %
- Coverage by file
- Historical trends

### Build Artifacts

Download from:

```
Pipeline Run → Artifacts → frontend-build
```

Contains:

- `public/` directory with built application
- `build/` subdirectory with bundle files
- All static assets

### Deployment URL

After successful deployment:

```
https://pcpc-swa-dev.azurestaticapps.net
```

---

## Next Steps

After successful frontend deployment:

1. **Verify Deployment**

   - Visit: https://pcpc-swa-dev.azurestaticapps.net
   - Test application functionality
   - Check browser console for errors

2. **Configure Custom Domain (Optional)**

   - Azure Portal → Static Web App → Custom domains
   - Add your domain
   - Update DNS records

3. **Set Up Backend Pipeline**

   - Deploy Azure Functions
   - Configure API endpoints
   - Test frontend-backend integration

4. **Enable Monitoring**
   - Verify Application Insights data
   - Create custom dashboards
   - Set up alerts

---

## Additional Resources

- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Azure DevOps Pipelines Documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/)
- [Svelte Documentation](https://svelte.dev/docs)
- [Jest Testing Documentation](https://jestjs.io/docs/getting-started)

---

## Support

For issues or questions:

- Check troubleshooting section above
- Review pipeline logs in Azure DevOps
- Check Azure Portal for resource status
- Contact DevOps team: devops@maber.io
