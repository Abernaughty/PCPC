# PCPC CI/CD Pipelines

This directory contains Azure DevOps pipeline definitions for the PCPC (Pokemon Card Price Checker) project.

There are three pipelines:

| Pipeline | File | Trigger |
| --- | --- | --- |
| PR Validation | `azure-pipelines-pr.yml` | Pull requests to `main` / `develop` |
| Multi-Stage CD | `azure-pipelines.yml` | Pushes to `main` touching `app/`, `backend/`, `infra/`, `apim/`, or `pipelines/ado/` |
| CI Images | `azure-pipelines-ci-images.yml` | Manual only |

The frontend (SvelteKit, `app/`) is deployed by **Vercel**; PR validation for it
comes from Vercel preview builds, not these pipelines.

## Pipeline Architecture

### PR Validation Pipeline (`azure-pipelines-pr.yml`)

**Purpose:** Provide fast feedback on pull requests without deploying anything.

**Triggers:** Pull requests to `main` or `develop` (doc-only changes excluded)

**Stages:**

1. **Backend Validation** (`templates/validate-backend.yml`)
   - pnpm workspace install (`--frozen-lockfile`)
   - ESLint (non-blocking — no lint script yet)
   - TypeScript compilation check (`tsc --noEmit`)
   - Jest unit tests with coverage
   - Production build + build-output verification
   - Security audit (`pnpm audit --prod`, non-blocking)

2. **Infrastructure Validation** (`templates/validate-infrastructure.yml`)
   - Terraform format check (non-blocking)
   - Terraform module + all-environment validation
   - TFLint static analysis (non-blocking)
   - Checkov security scanning (non-blocking)

3. **APIM Validation** (`templates/validate-apim.yml`)
   - OpenAPI specification lint (Spectral, non-blocking)
   - Policy XML well-formedness checks (non-blocking)
   - APIM structure and API operations verification

4. **Summary**
   - Runs only when all three validation stages succeed; if any stage fails,
     the summary is skipped and the failed stage marks the PR red, so it can
     never print a false "passed"

**Key Features:**

- ✅ No deployments - validation only
- ✅ Jobs run in pinned CI container images (see Container Registries below)
- ✅ Test coverage reporting (backend)
- ✅ Security scanning (non-blocking; see tracked tech debt below)

### Multi-Stage CD Pipeline (`azure-pipelines.yml`)

**Purpose:** Build once, deploy the same artifact to Dev → Staging → Prod.

**Build stage** — two parallel jobs:

- **Build Unified Artifact** (`templates/build.yml`): bundles the backend
  Functions app (`pnpm deploy --prod`), snapshots APIM config, generates a
  `release.json` manifest and SHA-256 checksums, and publishes the unified
  `drop/` artifact
- **Build + Push ACA Image** (`templates/build-and-push-image.yml`): builds the
  Path C container image, Trivy-scans it (HIGH/CRITICAL CVEs are blocking), and
  pushes it to the project ACR; all three deploy stages consume the same
  SHA-tagged image reference

**Deploy stages** — `Deploy_Dev` (automatic) → `Deploy_Staging` (approval gate)
→ `Deploy_Prod` (approval gate). Each is one invocation of
`templates/deploy-stage.yml` with these jobs:

1. Deploy infrastructure (Terraform) — runs as a `deployment:` job against the
   `pcpc-<env>` Environment for gated stages, so the approval check gates the
   whole stage
2. Deploy backend (Azure Functions, Path B) — verifies artifact checksums
   before deploying
3. Deploy APIM APIs & policies
4. Deploy container app (ACA, Path C)
5. Smoke tests (health checks against Functions and APIM)

Environment variable groups (`vg-pcpc-<env>-config/secrets`) are scoped to
their own stage — they are deliberately not loaded at pipeline scope, so prod
secrets are never in scope for un-gated dev jobs.

### CI Images Pipeline (`azure-pipelines-ci-images.yml`)

**Purpose:** Build the CI toolchain container images
(`pcpc-ci-terraform-azure`, `pcpc-ci-node22`, `pcpc-ci-node-azure`) and push
them to the shared ACR. Run manually when the image Dockerfiles under
`.ci/images/` change, then regenerate the pinned digests with
`scripts/update-ci-image-digests.sh`.

## Pipeline Templates

Reusable templates are located in the `templates/` directory:

### Validation Templates (PR pipeline)

- **`validate-backend.yml`** - Backend code validation and testing
- **`validate-infrastructure.yml`** - Terraform validation and security scanning
- **`validate-apim.yml`** - API Management configuration validation

### Build & Deploy Templates (CD pipeline)

- **`build.yml`** - Unified artifact build (Functions bundle + APIM config + manifest)
- **`build-and-push-image.yml`** - ACA container image build, Trivy scan, ACR push
- **`deploy-stage.yml`** - Parameterized per-environment stage (used 3×: dev/staging/prod)
- **`deploy-infra.yml`** - Terraform deployment steps
- **`deploy-functions.yml`** - Azure Functions deployment steps
- **`deploy-apim.yml`** - APIM APIs & policies deployment steps
- **`deploy-aca.yml`** - Container App revision rollout steps
- **`smoke-tests.yml`** - Post-deploy health checks
- **`steps/bundle-functions.yml`** - Shared backend bundle recipe (used by `build.yml` and the image build)
- **`build-ci-images.yml`** - CI toolchain image builds (CI images pipeline)

### Variables

- **`variables/ci-images.yml`** - Pinned CI image digests + ACR service connection (regenerate with `scripts/update-ci-image-digests.sh`; do not hand-edit)
- **`variables/versions.yml`** - Versions for tools that pipeline *scripts* invoke directly (currently pnpm; Node/Terraform versions are baked into the CI images)

### Scripts

- **`scripts/health-check-functions.sh`** / **`scripts/health-check-apim.sh`** - Smoke-test health checks
- **`scripts/update-ci-image-digests.sh`** - Regenerates `variables/ci-images.yml`
- **`scripts/lib/apim.sh`** - Shared APIM helpers

## Requirements

- Azure DevOps project with repository connection
- **`pcpc-acr-service-connection`** - Docker registry service connection to the
  shared ACR; all pipelines (including PR validation) pull their CI container
  images through it
- **`az-pcpc-dev` / `az-pcpc-staging` / `az-pcpc-prod`** - ARM service
  connections used by the CD pipeline
- **`pcpc-staging` / `pcpc-prod` Environments** with approval checks configured
  (gates the staging/prod stages)
- **`vg-pcpc-<env>-config` / `vg-pcpc-<env>-secrets`** variable groups per environment

Node.js, Terraform, TFLint, Checkov, and Spectral are provided by the CI
container images — nothing needs to be installed on build agents.

## Test Results and Coverage

The PR pipeline publishes:

- **Test Results:** JUnit XML format, displayed in Azure DevOps
- **Code Coverage:** Cobertura format with HTML reports (backend, `coverage/backend/`)

The CD pipeline publishes smoke-test results per environment.

## Security Scanning

The pipelines include multiple security checks:

1. **pnpm audit** (backend, PR pipeline) - known vulnerabilities in production
   dependencies; non-blocking
2. **Checkov** (infrastructure, PR pipeline) - static analysis for Terraform
   misconfigurations; non-blocking
3. **TFLint** (infrastructure, PR pipeline) - Terraform linting and
   provider-specific checks; non-blocking
4. **Trivy** (CD pipeline) - container image CVE scan; HIGH/CRITICAL findings
   are **blocking**

## Container Registries

PCPC deliberately uses **two** container registries with different lifecycles:

| Registry | Holds | Built / pushed by | Referenced by |
| --- | --- | --- | --- |
| `maberdevcontainerregistry` (shared) | CI toolchain images: `pcpc-ci-terraform-azure`, `pcpc-ci-node22`, `pcpc-ci-node-azure` | `azure-pipelines-ci-images.yml` | `variables/ci-images.yml` (by digest) |
| `pcpcacr*` (project-owned, in `pcpc-rg-shared`, Terraform-provisioned with a random suffix) | Application images: `pcpc/functions` (Path C ACA image) | `templates/build-and-push-image.yml` | `templates/deploy-aca.yml` (discovered at runtime) |

**Rationale:** CI toolchain images are cross-project developer/CI tooling (the
shared registry also backs the devcontainer) with their own cadence, so they
live outside the project's infrastructure. Application images are project
artifacts colocated with the infra that consumes them and scoped to project
RBAC, so they live in the Terraform-managed `pcpcacr*` registry and can be torn
down/rebuilt with the project. Keeping them separate avoids coupling CI tooling
to app-infra lifecycle.

CI-image digests in `variables/ci-images.yml` are regenerated with
`scripts/update-ci-image-digests.sh` (do not hand-edit).

## Non-Blocking Checks (Tracked Tech Debt)

The following checks are intentionally **non-blocking** today (`continueOnError`
or `|| echo` soft-fail) to avoid blocking PRs while the codebase stabilizes.
The intent is to promote them to blocking incrementally:

| Check | Template | Status |
| --- | --- | --- |
| ESLint (backend) | `validate-backend.yml` | non-blocking (no lint script yet) |
| `pnpm audit` | `validate-backend.yml` | non-blocking |
| `terraform fmt -check` | `validate-infrastructure.yml` | non-blocking |
| TFLint (modules + envs) | `validate-infrastructure.yml` | non-blocking |
| Checkov | `validate-infrastructure.yml` | non-blocking |
| Spectral OpenAPI lint | `validate-apim.yml` | non-blocking |
| Policy XML well-formedness | `validate-apim.yml` | non-blocking |

For contrast, these **are** blocking: TypeScript compile, Jest tests, backend
build, Trivy HIGH/CRITICAL CVE scan, artifact checksum verification, and the
post-deploy smoke tests.

## Best Practices

### Pull Request Workflow

1. Create feature branch from `main`
2. Make your changes
3. Run tests locally: `pnpm test`
4. Create pull request
5. Pipeline runs automatically (plus Vercel preview build for frontend changes)
6. Review pipeline results
7. Address any failures
8. Request code review
9. Merge when approved and pipeline passes

### Troubleshooting

**Pipeline fails on backend tests:**

- Check test output in Azure DevOps
- Run `pnpm test` locally to reproduce
- Ensure TypeScript compiles: `pnpm --filter pcpc-backend exec tsc --noEmit`

**Pipeline fails on Terraform validation:**

- Check Terraform format: `terraform fmt -check -recursive`
- Validate locally: `terraform validate`
- Run TFLint: `tflint`

**Pipeline fails on APIM validation:**

- Verify OpenAPI spec exists: `apim/specs/pcpc-api-v1.yaml`
- Check XML syntax in policy files
- Validate with Spectral locally: `spectral lint apim/specs/pcpc-api-v1.yaml`

**Pipeline fails pulling CI images:**

- Verify `pcpc-acr-service-connection` is healthy
- Check the pinned digests in `variables/ci-images.yml` still exist in ACR
  (re-run the CI images pipeline + `scripts/update-ci-image-digests.sh` if not)

## Performance Optimization

The PR pipeline is optimized for speed:

- Parallel stage execution where possible
- Pre-baked CI container images (no per-run tool installs)
- pnpm with frozen lockfile installs
- Minimal infrastructure validation (no backend init)
- Non-blocking security scans
- Fast failure on critical errors

## Support

For issues or questions:

- Review pipeline logs in Azure DevOps
- Check this README for troubleshooting tips
- Consult the main project documentation in `/docs`
