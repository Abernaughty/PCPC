# PCPC CI/CD Pipelines

## ⚠️ MIGRATION NOTICE

**The CI/CD architecture has been modernized and moved to the `.ado/` directory.**

This directory now contains:

- **`scripts/`** - Reusable deployment and validation scripts (still in use)
- **`legacy/`** - Deprecated pipeline files (see [legacy/README.md](legacy/README.md))

## New CI/CD Architecture

The PCPC project now uses an enterprise-grade CI/CD architecture with:

- **Two-Pipeline Strategy**: PR validation + Multi-stage CD
- **Unified Artifact**: Build-once-deploy-many pattern
- **Multi-Environment**: Dev → Staging → Prod with approval gates
- **Path-Based Deployment**: Only deploy components that changed

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   PR Validation Pipeline                     │
│              (.ado/azure-pipelines-pr.yml)                   │
├─────────────────────────────────────────────────────────────┤
│  Fast feedback on pull requests (5-10 minutes)              │
│  ├─ Frontend validation (lint, test, build)                 │
│  ├─ Backend validation (lint, test, compile)                │
│  ├─ Infrastructure validation (fmt, validate, lint)         │
│  ├─ APIM validation (OpenAPI lint, policy check)            │
│  └─ Security scan (npm audit)                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                Multi-Stage CD Pipeline                       │
│                (.ado/azure-pipelines.yml)                    │
├─────────────────────────────────────────────────────────────┤
│  Build Stage                                                 │
│  ├─ Build frontend (Svelte → dist/)                         │
│  ├─ Build backend (TypeScript → functions.zip)              │
│  ├─ Snapshot APIM configs                                   │
│  ├─ Generate release.json manifest                          │
│  └─ Publish unified drop/ artifact                          │
│                                                              │
│  Deploy_Dev Stage (auto-deploy)                             │
│  ├─ Deploy infrastructure (Terraform)                       │
│  ├─ Deploy frontend (Static Web App)                        │
│  ├─ Deploy backend (Azure Functions)                        │
│  ├─ Deploy APIM (API Management)                            │
│  └─ Run smoke tests                                         │
│                                                              │
│  Deploy_Staging Stage (approval gate)                       │
│  ├─ Deploy infrastructure                                   │
│  ├─ Deploy applications                                     │
│  ├─ Run smoke tests                                         │
│  └─ Run API contract tests                                  │
│                                                              │
│  Deploy_Prod Stage (approval gate)                          │
│  ├─ Deploy infrastructure                                   │
│  ├─ Deploy applications                                     │
│  ├─ Run smoke tests                                         │
│  ├─ Run API contract tests                                  │
│  └─ Run E2E tests                                           │
└─────────────────────────────────────────────────────────────┘
```

## Documentation

For complete CI/CD documentation, see:

- **`.ado/README.md`** - Complete pipeline documentation (coming soon)
- **`.ado/SETUP_GUIDE.md`** - Azure DevOps setup instructions (coming soon)
- **`pipelines/legacy/README.md`** - Information about deprecated files

## Current Status

**Phase 0 Complete** (Oct 5, 2025):

- ✅ CI/CD architecture planning complete
- ✅ PR validation pipeline merged to main
- ✅ Azure DevOps foundation setup complete
- ✅ Legacy pipelines moved to `pipelines/legacy/`

**Next Phase** (Phase 1 - Foundation Setup):

- Create unified build template
- Create deployment templates
- Create staging/prod infrastructure configs
- Create smoke tests and health checks

## Reusable Scripts

The `scripts/` directory contains reusable scripts used by both legacy and new pipelines:

### Deployment Scripts

- **`setup-backend.sh`** - Terraform backend validation
- **`validate-deployment.sh`** - Infrastructure validation

### Verification Scripts

- **`verify-frontend-deployment.sh`** - Frontend smoke tests (5 comprehensive checks)

These scripts are environment-agnostic and can be used in any pipeline.

## Migration Timeline

| Phase                             | Status         | Completion Date |
| --------------------------------- | -------------- | --------------- |
| Phase 0: Planning & Documentation | ✅ Complete    | Oct 5, 2025     |
| Phase 1: Foundation Setup         | 🔄 In Progress | Oct 6-9, 2025   |
| Phase 2: Pipeline Integration     | ⏳ Planned     | Oct 10-13, 2025 |
| Phase 3: Production & APIM        | ⏳ Planned     | Oct 14-17, 2025 |
| Phase 4: PR Pipeline Config       | ⏳ Planned     | Oct 18, 2025    |

## Legacy Pipelines

The following pipelines have been deprecated and moved to `pipelines/legacy/`:

- `azure-pipelines.yml` - Infrastructure-only pipeline
- `frontend-pipeline.yml` - Frontend-only pipeline
- `test-service-connections.yml` - Service connection testing
- All pipeline templates

See [legacy/README.md](legacy/README.md) for details on deprecated files and migration rationale.

## Support

For questions about the new CI/CD architecture:

- See: `.ado/README.md` for complete documentation (coming soon)
- Contact: devops@maber.io
- GitHub Issues: Tag with `cicd` label

## References

- [Azure DevOps Pipelines Documentation](https://docs.microsoft.com/en-us/azure/devops/pipelines/)
- [PCPC Architecture Documentation](../docs/architecture.md)
- [PCPC Deployment Guide](../docs/deployment-guide.md)
