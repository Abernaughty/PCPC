# PCPC CI/CD Pipelines

This directory contains everything CI/CD for PCPC:

- **`ado/`** - Active Azure DevOps pipelines (PR validation, multi-stage CD, CI images)
- **`scripts/`** - Reusable deployment and validation scripts
- **`legacy/`** - Deprecated pipeline files (see [legacy/README.md](legacy/README.md))

## Architecture

The project uses three Azure DevOps pipelines:

- **PR Validation** (`ado/azure-pipelines-pr.yml`) - Fast, deploy-nothing feedback on pull requests
- **Multi-Stage CD** (`ado/azure-pipelines.yml`) - Build-once-deploy-many: Dev → Staging → Prod with approval gates
- **CI Images** (`ado/azure-pipelines-ci-images.yml`) - Manually-run builder for the CI toolchain container images

The frontend (SvelteKit, `app/`) is built and deployed by **Vercel**, not by these
pipelines — PR validation for it comes from Vercel preview builds.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   PR Validation Pipeline                     │
│              (pipelines/ado/azure-pipelines-pr.yml)          │
├─────────────────────────────────────────────────────────────┤
│  Fast feedback on pull requests — no deployments             │
│  ├─ Backend validation (lint, tsc, test, build, audit)      │
│  ├─ Infrastructure validation (fmt, validate, lint, Checkov)│
│  ├─ APIM validation (OpenAPI lint, policy XML check)        │
│  └─ Summary (runs only if all validation stages pass)       │
│  Frontend (SvelteKit) validated by Vercel preview builds    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                Multi-Stage CD Pipeline                       │
│                (pipelines/ado/azure-pipelines.yml)           │
├─────────────────────────────────────────────────────────────┤
│  Build Stage (two parallel jobs)                             │
│  ├─ Build backend bundle + snapshot APIM configs            │
│  │  → release.json manifest, checksums, unified drop/       │
│  └─ Build + push ACA container image (Trivy-scanned)        │
│                                                              │
│  Deploy_Dev → Deploy_Staging → Deploy_Prod                   │
│  (dev auto-deploys; staging and prod are approval-gated     │
│   via the pcpc-staging / pcpc-prod Environments)            │
│  Each stage is one invocation of templates/deploy-stage.yml:│
│  ├─ Deploy infrastructure (Terraform)                       │
│  ├─ Deploy backend (Azure Functions, Path B)                │
│  ├─ Deploy APIM (APIs & policies)                           │
│  ├─ Deploy container app (ACA, Path C)                      │
│  └─ Run smoke tests                                         │
└─────────────────────────────────────────────────────────────┘
```

Pipeline jobs run inside pinned CI container images pulled from ACR — see the
"Container Registries" section of [ado/README.md](ado/README.md).

## Documentation

- **[ado/README.md](ado/README.md)** - Complete pipeline documentation
- **[legacy/README.md](legacy/README.md)** - Information about deprecated files

## Reusable Scripts

### `scripts/` (environment-agnostic)

- **`setup-backend.sh`** - Terraform backend validation
- **`validate-deployment.sh`** - Infrastructure validation

### `ado/scripts/` (pipeline-specific)

- **`health-check-functions.sh`** - Post-deploy Function App health checks
- **`health-check-apim.sh`** - Post-deploy APIM gateway health checks
- **`update-ci-image-digests.sh`** - Regenerates the pinned image digests in `ado/variables/ci-images.yml`
- **`lib/apim.sh`** - Shared APIM helper functions

## Legacy Pipelines

The pre-migration pipelines (infrastructure-only, frontend-only Static Web App,
service-connection tests, and their templates) were deprecated in October 2025
and moved to `pipelines/legacy/`. See [legacy/README.md](legacy/README.md) for
details and migration rationale.

## References

- [Azure DevOps Pipelines Documentation](https://learn.microsoft.com/en-us/azure/devops/pipelines/)
- [PCPC Architecture Documentation](../docs/architecture.md)
- [PCPC Deployment Guide](../docs/deployment-guide.md)
