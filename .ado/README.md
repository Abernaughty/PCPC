# PCPC CI/CD Pipelines

This directory contains Azure DevOps pipeline definitions for the PCPC (Pokemon Card Price Checker) project, implementing enterprise-grade CI/CD practices.

## Pipeline Architecture

### PR Validation Pipeline (`azure-pipelines-pr.yml`)

**Purpose:** Provide fast feedback on pull requests without deploying anything.

**Triggers:** Pull requests to `main` or `develop` branches

**Stages:**
1. **Frontend Validation**
   - ESLint code linting
   - Jest unit tests (17 tests)
   - Production build verification
   - Security audit (npm audit)
   - Code coverage reporting

2. **Backend Validation**
   - ESLint code linting
   - TypeScript compilation check
   - Jest unit tests (9 tests)
   - Production build verification
   - Security audit (npm audit)
   - Code coverage reporting

3. **Infrastructure Validation**
   - Terraform format verification
   - Terraform module validation
   - TFLint static analysis
   - Checkov security scanning
   - Dev environment validation

4. **APIM Validation**
   - OpenAPI specification validation (Spectral)
   - Policy XML well-formedness checks
   - API operations verification
   - APIM structure validation

5. **Summary** (~1 second)
   - Aggregated validation results
   - Pass/fail status for all stages

**Key Features:**
- ✅ No deployments - validation only
- ✅ Fast feedback loop
- ✅ Comprehensive code quality checks
- ✅ Security scanning (non-blocking)
- ✅ Test coverage reporting
- ✅ Infrastructure validation

## Pipeline Templates

Reusable templates are located in the `templates/` directory:

### Validation Templates

- **`validate-frontend.yml`** - Frontend code validation and testing
- **`validate-backend.yml`** - Backend code validation and testing  
- **`validate-infrastructure.yml`** - Terraform validation and security scanning
- **`validate-apim.yml`** - API Management configuration validation

## Usage

### PR Validation Pipeline

**Automatic Trigger:** Pipeline runs automatically when you create or update a pull request.

**Manual Run:** Not recommended - this pipeline is designed for PR validation only.

**Requirements:**
- Azure DevOps project with repository connection
- Node.js 22.x available on build agents
- Terraform 1.13.3 installer task available
- No service connections required (validation only)

### Setting Up the PR Pipeline

1. **Create Pipeline in Azure DevOps:**
   - Go to Pipelines → New pipeline
   - Select your repository
   - Choose "Existing Azure Pipelines YAML file"
   - Select `.ado/azure-pipelines-pr.yml`
   - Save (do not run)

2. **Configure PR Triggers:**
   - The pipeline is already configured to trigger on PRs
   - No manual configuration needed
   - Pipeline will run automatically on PR creation/update

3. **Review Results:**
   - Check the pipeline run in Azure DevOps
   - Review test results and code coverage
   - Address any validation failures before merging

## Test Results and Coverage

The PR pipeline publishes:

- **Test Results:** JUnit XML format, displayed in Azure DevOps
- **Code Coverage:** Cobertura format with HTML reports
- **Coverage Location:** 
  - Frontend: `coverage/frontend/`
  - Backend: `coverage/backend/`

## Security Scanning

The pipeline includes multiple security checks:

1. **npm audit** (frontend & backend)
   - Checks for known vulnerabilities in dependencies
   - Runs at "high" severity level
   - Non-blocking (warnings only)

2. **Checkov** (infrastructure)
   - Static analysis for Terraform code
   - Checks for security misconfigurations
   - Non-blocking (warnings only)

3. **TFLint** (infrastructure)
   - Terraform linting and best practices
   - Cloud provider-specific checks
   - Non-blocking (warnings only)

## Best Practices

### Pull Request Workflow

1. Create feature branch from `main`
2. Make your changes
3. Run tests locally: `npm test`
4. Create pull request
5. Pipeline runs automatically
6. Review pipeline results
7. Address any failures
8. Request code review
9. Merge when approved and pipeline passes

### Troubleshooting

**Pipeline fails on frontend tests:**
- Check test output in Azure DevOps
- Run `npm test` locally to reproduce
- Verify all dependencies are installed

**Pipeline fails on backend tests:**
- Check test output in Azure DevOps
- Run `npm test` locally to reproduce
- Ensure TypeScript compiles: `npx tsc --noEmit`

**Pipeline fails on Terraform validation:**
- Check Terraform format: `terraform fmt -check -recursive`
- Validate locally: `terraform validate`
- Run TFLint: `tflint`

**Pipeline fails on APIM validation:**
- Verify OpenAPI spec exists: `apim/specs/pcpc-api-v1.yaml`
- Check XML syntax in policy files
- Validate with Spectral locally: `spectral lint apim/specs/pcpc-api-v1.yaml`

## Performance Optimization

The PR pipeline is optimized for speed:

- Parallel stage execution where possible
- Cached dependencies (npm ci)
- Minimal infrastructure validation (no backend init)
- Non-blocking security scans
- Fast failure on critical errors

## Next Steps

After PR validation is working, implement:

1. **Multi-Stage CD Pipeline** - Build and deploy to Dev → Staging → Prod
2. **Environment-Specific Variables** - Per-environment Terraform variables
3. **APIOps Migration** - Modern API Management deployment
4. **Advanced Testing** - API tests, E2E tests, smoke tests

## Support

For issues or questions:
- Review pipeline logs in Azure DevOps
- Check this README for troubleshooting tips
- Consult the main project documentation in `/docs`

---

**Version:** 1.0.0  
**Last Updated:** October 5, 2025  
**Status:** ✅ PR Validation Pipeline Complete
