# PCPC Documentation Review Plan

## Objectives
- Ensure all project documentation is complete, accurate, and aligned with the current PCPC architecture and delivery model.
- Showcase PCPC as a DevOps-first initiative by surfacing automation, observability, and operational excellence throughout the docs set.
- Capture gaps in security, DevOps, and development practices (documentation or implementation) so they can be triaged and remediated.

## Stakeholders & Collaboration
- **Infra / Terraform owners** – validate environment coverage, resource naming, drift, and IaC runbooks.
- **Backend & Frontend leads** – confirm service behavior, local setup, feature flags, and runtime configuration guidance.
- **Platform / Pipelines team** – own Azure DevOps templates, CI/CD workflows, quality gates, and release governance.
- **Security & Operations reps** – review secrets handling, access control, alerting, incident/rollback procedures.
- **Shared workspace** – create a project board or spreadsheet (e.g., `docs/doc-review-tracker.xlsx`) to log findings, owners, severities, due dates, and status.

## Process Overview
1. **Inventory & Triage** – capture current documentation assets, categorize by audience, note obvious staleness.
2. **Baseline Reality Check** – summarize the live architecture (Terraform modules, Azure resources, application services, pipelines) as a comparison source of truth.
3. **Review Waves** – prioritize high-impact docs first, then secondary references, then archival material; validate instructions against repositories and (where needed) Azure.
4. **Gap Logging** – record deviations from best practices or discovered implementation drift in a shared tracker with remediation guidance.
5. **Update & Publish** – apply documentation revisions, add diagrams/quickstarts where missing, and align terminology across the suite.
6. **Sustainability** – define ownership, review cadence, and verification steps tied to release and infrastructure changes.

## Current Architecture & Delivery Snapshot
- **Infrastructure as Code**: Terraform modules under `infra/modules/**` provision Resource Groups, Azure API Management, Function Apps, Static Web Apps, Cosmos DB, Application Insights, Log Analytics, Storage Accounts, and Key Vault. Environment overlays in `infra/envs/{dev,staging,prod}` and `apim/environments/**` coordinate per-environment parameters.
- **Application Services**: 
  - Backend Azure Functions (`app/backend`) with orchestrators (e.g., `SetMappingOrchestrator`) interacting with Cosmos DB and APIM policies.
  - Frontend Static Web App (`app/frontend`) built with Rollup (Svelte), consuming runtime configuration from `src/config/runtimeConfig.ts`.
  - API Management definitions under `apim/terraform` and Swagger in `apim/specs/pcpc-api-v1.yaml`.
- **Pipelines & Automation**:
  - Azure DevOps entrypoint `.ado/azure-pipelines.yml` orchestrates template-based stages for validate, build, deploy, and smoke tests.
  - Reusable templates in `.ado/templates/*.yml` cover infrastructure (Terraform plan/apply), backend/frontend deploys, and health checks (`.ado/scripts/health-check-*.sh`).
  - Supplemental scripts in `pipelines/scripts/*.sh` support environment config generation, deployments, and verification.
- **Observability & Operations**: Health scripts, Log Analytics, and Application Insights modules are provisioned; `docs/monitoring.md` and `docs/runbooks/README.md` should reflect alerting paths and SLOs.
- **Security & Compliance**: Key Vault usage and naming rules (`docs/azure-key-vault-naming-transformation.md`), secrets seeding templates (`.ado/templates/seed-key-vault.yml`), and policy enforcement via APIM policies/terraform modules.

## Inventory Snapshot (Initial)

### Core Documentation (`docs/`)
| Path | Primary Focus / Audience | Last Commit |
| --- | --- | --- |
| docs/README.md | Top-level overview & navigation | 2025-10-04 |
| docs/architecture.md | System architecture reference | 2025-10-04 |
| docs/deployment-guide.md | End-to-end deployment playbook | 2025-10-23 |
| docs/development-guide.md | Developer onboarding & workflow | 2025-10-04 |
| docs/monitoring.md | Observability strategy | 2025-10-04 |
| docs/security.md | Security posture & controls | 2025-10-04 |
| docs/runbooks/README.md | Operational runbooks index | 2025-10-04 |
| docs/azure-key-vault-naming-transformation.md | Secret management conventions | 2025-10-06 |
| docs/set-mapping-pipeline-integration.md | Data pipeline flow | 2025-10-26 |
| docs/troubleshooting.md | Common issues & remedies | 2025-10-04 |

> Note: Additional ADRs, issue templates, and specialized guides remain to be assessed; include them in subsequent review passes.

### Pipelines & Automation (`pipelines/`, `.ado/`)
| Path | Focus | Last Commit |
| --- | --- | --- |
| .ado/README.md | Azure DevOps pipeline overview | 2025-10-05 |
| .ado/azure-pipelines.yml | Consolidated build/release entrypoint | 2025-10-22 |
| .ado/templates/deploy-infra.yml | Infra release template | 2025-10-23 |
| .ado/templates/deploy-functions.yml | Function App deployment | 2025-10-26 |
| .ado/templates/smoke-tests.yml | Post-deploy validation | 2025-10-10 |
| pipelines/README.md | Repo pipeline documentation | 2025-10-05 |
| pipelines/scripts/validate-deployment.sh | Release verification script | 2025-10-21 |
| pipelines/scripts/trigger-set-mapping-sync.sh | Ops automation | 2025-10-26 |
| pipelines/legacy/SETUP_GUIDE.md | Outdated onboarding reference | 2025-10-05 |

> Ensure modern templates under `.ado/templates/` and any living docs in Azure DevOps project wiki are included in the review scope.

### Environment & Tooling Support (`.devcontainer/`)
| Path | Focus | Last Commit |
| --- | --- | --- |
| .devcontainer/README.md | Dev container usage | 2025-10-04 |
| .devcontainer/devcontainer.json | Codespace configuration | 2025-10-11 |
| .devcontainer/setup.sh | Dev-container bootstrap | 2025-10-24 |
| .devcontainer/docs/ACR-BUILD-GUIDE.md | Container build optimization | 2025-10-01 |
| .devcontainer/docs/local-emulators.md | Local emulation guidance | 2025-09-22 |

### Knowledge Base & Memory Bank (`memory-bank/`)
| Path | Current Status | Last Commit |
| --- | --- | --- |
| memory-bank/activeContext.md | Stale high-level context (needs refresh) | 2025-10-07 |
| memory-bank/progress.md | Historical milestone log | 2025-10-06 |
| memory-bank/systemPatterns.md | Architecture/system patterns | 2025-10-06 |
| memory-bank/techContext.md | Tech stack summary | 2025-10-04 |
| memory-bank/projectBrief.md | Elevator pitch | 2025-10-04 |
| memory-bank/pcpc-migration-plan.md | Migration narrative | 2025-10-04 |

> Backup copies under `memory-bank/memory-bank-backup/**` are older snapshots; evaluate whether to archive or reconcile them with the refreshed memory bank.

### Additional Assets
- **Terraform Modules & Env Files** (`infra/**`, `apim/**`): capture module READMEs or inline documentation needs.
- **Scripts & Runbooks** (`pipelines/scripts`, `.ado/scripts`, `app/backend/scripts`): confirm usage is explained in Ops docs.
- **API Specs** (`apim/specs/pcpc-api-v1.yaml`): ensure referenced by API documentation and kept in sync with APIM.

## Baseline Reality Check Tasks
- Derive current architecture diagram from Terraform modules (`infra/modules/**`, `infra/envs/**`, `apim/**`) and Azure resource inventory.
- Enumerate application services (Function App, Static Web App, Cosmos DB, Key Vault, APIM) with environment-specific configurations.
- Map CI/CD flow from commit to production using `.ado/azure-pipelines.yml`, template dependencies, and scripts; note approvals, gates, and quality checks.
- Capture operational tooling: monitoring dashboards, health scripts, alert routes, and SLO/SLI definitions.

## Review Waves & Focus Areas
- **Wave 1 – High Impact / External-Facing**: `docs/README.md`, `docs/deployment-guide.md`, `docs/development-guide.md`, `docs/security.md`, `.ado/README.md`, `.ado/azure-pipelines.yml`, `pipelines/README.md`.
- **Wave 2 – Operational Excellence**: `docs/monitoring.md`, `docs/runbooks/README.md`, `.ado/templates/*.yml`, `pipelines/scripts/*.sh`, `docs/set-mapping-pipeline-integration.md`.
- **Wave 3 – Reference & Historical**: Memory bank entries, ADRs, legacy pipeline docs, `.devcontainer/docs/**`, specialized troubleshooting/performance guides.
- For each wave: validate accuracy against code/scripts, confirm Azure resource alignment, note missing diagrams/quickstarts, and flag best-practice gaps.

## Gap Logging Framework
- Capture findings in a shared tracker with columns: `Document / Asset`, `Issue Summary`, `Practice Area (Security | DevOps | Development)`, `Severity`, `Recommended Fix`, `Owner`, `Target Date`, `Status`.
- Include implementation gaps (e.g., missing alerting, manual steps) even if documentation matches current state, so the team can schedule remediation work.
- Tag items requiring Azure validation (e.g., Key Vault secret parity, APIM policy drift) and assign resource owners for confirmation.

## Maintenance & Follow-Through
- Assign primary maintainers per document cluster and define a quarterly review cadence or tie reviews to release milestones.
- Require doc updates within pull requests that materially change infrastructure, pipelines, or operational procedures (definition of done).
- Add changelog entries or doc versioning where major process shifts occur; summarize updates in `memory-bank/changelog.md`.
- After remediation, embed verification steps (e.g., `terraform plan`, pipeline dry runs, health-check scripts) into docs to keep guidance actionable.
- Schedule a wrap-up review to confirm all blockers resolved, document the DevOps showcase narrative, and present findings to stakeholders.

## Immediate Next Steps
1. Circulate this plan for stakeholder sign-off and designate the shared tracking workspace.
2. Kick off Wave 1 reviews with paired SMEs (Infra + Platform + Security).
3. Begin Azure environment validation (resource inventory vs. Terraform state) in parallel to support documentation corrections.
