# Legacy Pipeline Files

This directory contains deprecated pipeline files that have been superseded by the new unified CI/CD architecture in the `.ado/` directory.

## Deprecation Date

**October 5, 2025** - Files moved to legacy as part of CI/CD architecture modernization

## Why These Files Were Deprecated

The PCPC project has migrated to a modern enterprise CI/CD architecture with:

- **Two-Pipeline Strategy**: Separate PR validation and multi-stage CD pipelines
- **Unified Artifact**: Build-once-deploy-many pattern with single artifact promotion
- **Multi-Environment**: Dev → Staging → Prod with approval gates
- **Path-Based Deployment**: Only deploy components that changed

The legacy pipelines had several limitations:

1. **Separate Pipelines**: Infrastructure and frontend had separate pipelines, making coordination difficult
2. **No Backend Pipeline**: Backend deployment was not automated
3. **Single Environment**: Only Dev environment supported
4. **No Artifact Promotion**: Each environment would rebuild from source
5. **Limited Testing**: No comprehensive smoke tests or API contract tests

## Legacy Files

### Main Pipelines

- **`azure-pipelines.yml`** - Infrastructure-only pipeline (Terraform deployment)

  - Replaced by: `.ado/azure-pipelines.yml` (unified multi-stage CD pipeline)
  - Limitations: Only deployed infrastructure, no application deployment

- **`frontend-pipeline.yml`** - Frontend-only pipeline (Static Web App deployment)
  - Replaced by: `.ado/azure-pipelines.yml` (unified multi-stage CD pipeline)
  - Limitations: Only deployed frontend, no backend or APIM deployment

### Templates

- **`templates/frontend-build.yml`** - Frontend build template

  - Replaced by: `.ado/templates/build.yml` (unified build for frontend + backend)
  - Limitations: Only built frontend, separate from backend build

- **`templates/frontend-deploy.yml`** - Frontend deployment template

  - Replaced by: `.ado/templates/deploy-swa.yml` (multi-environment SWA deployment)
  - Limitations: Single environment, no artifact reuse

- **`templates/terraform-validate.yml`** - Terraform validation template

  - Migrated to: `.ado/templates/` (reused in new pipeline)
  - Status: Template still useful, moved to new location

- **`templates/terraform-plan.yml`** - Terraform plan template

  - Migrated to: `.ado/templates/` (reused in new pipeline)
  - Status: Template still useful, moved to new location

- **`templates/terraform-apply.yml`** - Terraform apply template
  - Replaced by: `.ado/templates/deploy-infra.yml` (multi-environment infrastructure deployment)
  - Limitations: Single environment, no multi-env support

### Documentation

- **`SETUP_GUIDE.md`** - Infrastructure pipeline setup guide

  - Replaced by: `.ado/docs/CD_PIPELINE_GUIDE.md`
  - Status: Archived for reference

- **`FRONTEND_SETUP_GUIDE.md`** - Frontend pipeline setup guide

  - Replaced by: `.ado/docs/CD_PIPELINE_GUIDE.md`
  - Status: Archived for reference

- **`TERRAFORM_INIT_FIX.md`** - Terraform initialization troubleshooting
  - Status: Archived for reference, issues resolved in new pipeline

## New CI/CD Architecture

For current CI/CD documentation, see:

- **`.ado/README.md`** - Complete pipeline documentation
- **`.ado/SETUP_GUIDE.md`** - Azure DevOps setup instructions
- **`.ado/docs/CD_PIPELINE_GUIDE.md`** - Multi-stage CD pipeline guide

## Migration Timeline

- **Phase 0** (Oct 5, 2025): Planning complete, legacy files moved
- **Phase 1-3** (Oct 6-15, 2025): New pipeline implementation
- **Phase 4** (Oct 16, 2025): PR pipeline configuration
- **Phase 5** (Oct 17-18, 2025): Final migration and cleanup

## Retention Policy

These files will be retained for **2 sprints** (4 weeks) after new pipeline is validated in production, then deleted.

**Deletion Date:** Approximately November 5, 2025

## Rollback Procedure

If you need to temporarily rollback to legacy pipelines:

1. Copy desired files from `pipelines/legacy/` back to `pipelines/`
2. Reconfigure Azure DevOps to use legacy pipeline YAML
3. Document reason for rollback
4. Create issue to track resolution of new pipeline issues

## Questions or Issues

For questions about the new CI/CD architecture or migration:

- See: `.ado/README.md` for complete documentation
- Contact: devops@maber.io
- GitHub Issues: Tag with `cicd` label
