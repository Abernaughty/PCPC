# ADR-009: Functions Consumption vs Container Apps

## Status

Accepted

Date: 2026-05-12

## Context

After Phase 2.1, Path B (APIM → Azure Functions v4 on a Consumption plan) is
Scrydex-native end-to-end. The Functions code is stable, the schema is
canonical, and the deployment pipeline is mature. Path B alone already
satisfies the enterprise/regulated-industry audience the portfolio plan
([`PORTFOLIO_PLAN.md`](../PORTFOLIO_PLAN.md)) targets with Azure depth.

Phase 2.2 adds a **third path** by taking the *same* Functions code,
packaging it as an OCI image, and running it on **Azure Container Apps**
with the Functions custom-container base image. Path C is not a rewrite
and not a separate codebase — it is a different runtime envelope around
identical application code, deployed to the same Cosmos DB and observed
through the same Application Insights workspace.

The question this ADR answers is **why both runtimes exist in the same
project, and when each one is the right call.** As with
[ADR-008](./ADR-008-apim-vs-bff-gateway.md), the answer is not "one is
better"; the answer is a decision rule that a senior+ engineer would
write down. The portfolio's job is to show that decision rule explicitly.

This ADR is intentionally narrower than [ADR-007](./ADR-007-api-architecture-spectrum.md).
ADR-007 explains why three deployment paths exist at all. This ADR
explains the runtime-shaped tradeoff between two of them.

## Decision

**Keep both runtimes. Run Functions on Consumption when the workload
matches Consumption's grain (event-driven, bursty, scale-to-zero
acceptable, vendor lock-in tolerable). Run Functions in a container on
ACA when the workload needs portable image immutability, richer scaling
triggers, or a deployment story that an auditor will sign.** Both
runtimes execute byte-identical application code and serve byte-identical
responses to the frontend.

The decision rule, written for future selves and for portfolio readers:

| Choose Functions Consumption when… | Choose Functions on ACA when… |
|---|---|
| Workload is request/response with low or unpredictable RPS | Workload benefits from richer scaling triggers (HTTP, queue depth, Cosmos change feed, custom KEDA scalers) |
| Cold start of ~500–1500ms is acceptable at the cold tail | Cold start must be predictable (min replicas ≥ 1 keeps it ~0ms; configurable per env) |
| Cost at idle must be exactly $0 | Cost at idle is acceptable at ~$5–15/mo per replica-environment for guaranteed warmth |
| Runtime lock-in to Azure Functions host is tolerable | Image must be portable (same OCI image runs on AKS, ECS, GKE, local Docker) |
| Deploy artifact is a ZIP attached to a managed host | Deploy artifact is a digest-pinned image scanned and stored in a registry |
| Operator team accepts "publish and forget" runtime opacity | Auditor needs to attest *exactly* what's running (image SHA, base image provenance, CVE scan results) |
| KEDA primitives are not needed | KEDA primitives (event-source-driven autoscale) are part of the design |

## Consequences

### Positive

- **Same code, two runtimes, observable difference.** The portfolio
  artifact is no longer "we describe a tradeoff" but "we ran the same
  code two ways and the latency badge tells you which one you're on."
  This is the most legible possible demonstration of runtime fluency.
- **Container immutability is real, not aspirational.** Every Path C
  deploy is a digest-pinned image (`pcpc/functions@sha256:…`), scanned
  for CVEs in CI before push, and rolled to ACA as an atomic revision.
  Path B's ZIP-and-deploy model is operationally lighter but offers no
  comparable supply-chain story.
- **KEDA is the natural next step.** ACA's scale rules expose Cosmos
  change feed, Service Bus queue depth, Event Hubs, and custom HTTP
  metrics as autoscale triggers. The first revision of Path C uses the
  default HTTP scale rule for simplicity, but the door is open to
  meaningful demonstrations of event-driven autoscale in Phase 3 without
  re-architecting.
- **Observability parity, free.** Both runtimes set the same
  `APPLICATIONINSIGHTS_CONNECTION_STRING` and the same `cloud_RoleName`
  convention, so Path B and Path C traces land in the same Log Analytics
  workspace, queryable side by side. The portfolio can demonstrate
  end-to-end traces across runtimes without bolting on anything new.
- **Auditor-friendly artifact lineage.** Image build → CVE scan → ACR
  push → revision pin in Terraform → ACA revision rollout is a chain a
  FedRAMP/ATO assessor can follow. Path B's "deploy a ZIP via az
  functionapp deployment" is harder to attest.

### Negative

- **Two pipelines for the same code.** Path B has its
  `deploy-functions.yml` template; Path C adds a parallel `deploy-aca.yml`
  with its own image build, CVE scan, push, and revision update steps.
  Maintaining both costs operational attention that a real product would
  amortize over more meaningful divergence.
- **Higher idle cost.** Functions Consumption is exactly $0 at idle.
  ACA at min_replicas=1 is ~$5–15/mo per replica-environment. The
  portfolio justifies this because warm-start makes the live demo feel
  snappy, but for a real product without a recruiter-demo constraint,
  min_replicas=0 (or Consumption) would often be the right call.
- **Health-probe timing coupling.** ACA's cold-start at min_replicas=0
  exceeds the frontend's 2-second `probeHealth` timeout, which would
  cause the toggle to falsely mark Path C unhealthy after every idle
  period. The portfolio resolves this by defaulting to min_replicas=1.
  A real workload with bursty traffic and tolerant clients could ship
  min=0 cleanly; the constraint is the *demo*, not the runtime.
- **Larger deployment artifact.** A Functions ZIP is megabytes; a
  Functions container image is hundreds of megabytes (base image +
  Node + node_modules). Pull time at cold start is non-trivial. The
  base image (`mcr.microsoft.com/azure-functions/node:4-node22`) is
  cached on the ACA node, but the first pull after a node hop is
  visible in cold-start latency.
- **Two scale models to reason about.** Functions Consumption scales
  by request rate, opaquely. ACA scales by an explicit rule (HTTP
  concurrency by default), which is more legible *and* more rope. A
  misconfigured `max_replicas` could exhaust Cosmos RU/s in a way the
  Functions host would have throttled gracefully.

## Alternatives Considered

### Option 1: Functions on Consumption only (skip Path C entirely)

- **Pros**: Lower operational surface; lower cost; Path B already
  demonstrates the enterprise Azure story end-to-end.
- **Cons**: Forecloses the container/KEDA/image-immutability narrative
  entirely; weakens the portfolio's FedRAMP/ATO posture talking point;
  the three-path comparison collapses to two and the architectural
  *spectrum* (the framing of [ADR-007](./ADR-007-api-architecture-spectrum.md))
  becomes a binary.
- **Reason for rejection**: The portfolio's job is to demonstrate range.
  Path C is what differentiates the project from "yet another Azure
  Functions example."

### Option 2: Functions on a dedicated App Service plan (Premium or Elastic Premium)

- **Pros**: Always-warm without containerization; richer feature surface
  than Consumption (VNet integration, larger instances, pre-warmed
  instances).
- **Cons**: No portable image; same Functions host lock-in as
  Consumption; substantially higher cost (~$150+/mo for the smallest
  Premium plan); loses the entire container/immutability/KEDA story.
- **Reason for rejection**: All the cost of "stay warm" with none of
  the portfolio value Path C is designed to deliver. If the only goal
  were "Path B but always warm," Premium would be reasonable. The goal
  is broader.

### Option 3: Functions on AKS (kubectl Functions runtime + KEDA)

- **Pros**: Most expressive scaling model; native Kubernetes operational
  surface; strongest cloud-portability story.
- **Cons**: AKS node-pool operational cost (~$70+/mo before any
  workload); the entire Kubernetes operational surface (RBAC, CNI,
  upgrades, etcd, ingress controllers) added to a portfolio project for
  a workload that does not need it.
- **Reason for rejection**: PORTFOLIO_PLAN.md:64 explicitly scopes AKS
  out. [ADR-010](./ADR-010-path-to-aks.md) *(planned, Phase 3)*
  documents the path-to-AKS thinking without paying the AKS cost.

### Option 4: App Service for Containers (instead of ACA)

- **Pros**: Container hosting under the same App Service umbrella as
  Functions Consumption/Premium; lower operational complexity than ACA;
  shares some IaC patterns with the existing function-app module.
- **Cons**: No KEDA; less interesting scaling story; no scale-to-zero
  on the consumption-tier equivalent; weaker FedRAMP/ATO narrative
  because the runtime envelope is still App Service rather than a
  generic container runtime.
- **Reason for rejection**: ACA is the more interesting demonstration.
  The point of Path C is to escape the App Service runtime, not to
  swap App Service flavors.

## Implementation Notes

### Shared application code

The Functions source under [`backend/functions/src/`](../../backend/functions/src/)
is *unchanged* by Phase 2.2. The Dockerfile at
[`backend/functions/Dockerfile`](../../backend/functions/Dockerfile) is a
multi-stage build whose first stage runs `npm ci && npm run build` and
whose second stage copies the `dist/` output onto
`mcr.microsoft.com/azure-functions/node:4-node22`. Build context is
`backend/` (not `backend/functions/`) so the `@pcpc/shared` workspace
package — referenced as `"@pcpc/shared": "file:../shared"` in
[`backend/functions/package.json`](../../backend/functions/package.json) —
resolves correctly. `npm ci --omit=dev` at the runtime stage strips
`@pcpc/shared` cleanly because it is types-only.

### Infrastructure boundary

A new Terraform module at [`infra/modules/container-app/`](../../infra/modules/)
composes:

- `azurerm_container_app_environment` consuming the existing
  `module.log_analytics` outputs (no new workspace)
- A `UserAssignedIdentity` granted `AcrPull` on the shared ACR
- `azurerm_container_app` with HTTP ingress (`target_port = 80`,
  `external_enabled = true`), `min_replicas = 1` (default), and a
  secret-backed `env` block carrying the same Scrydex/Cosmos
  credentials Path B already consumes

The module is wired into [`infra/envs/dev/main.tf`](../../infra/envs/dev/main.tf)
alongside the function-app module. The two runtimes share Cosmos,
Application Insights, Key Vault, and the storage account — they differ
only in *how* the code runs.

### Pipeline boundary

A new Azure DevOps template at
[`pipelines/ado/templates/deploy-aca.yml`](../../pipelines/ado/templates/deploy-aca.yml)
runs in the `Deploy_Dev` stage in parallel with `Deploy_Functions`.
The companion template
[`pipelines/ado/templates/build-and-push-image.yml`](../../pipelines/ado/templates/build-and-push-image.yml)
builds the image, scans for HIGH+ CVEs with Trivy (blocking), and
pushes to the shared `maberdevcontainerregistry` ACR under the
`pcpc/functions` repository path. ACA pulls via the user-assigned
managed identity, not the ADO service connection (different identities
for different purposes).

### CORS handling (gateway-layer parity with Path B)

Path B's CORS allowlist lives entirely in the APIM regex policy
([ADR-013](./ADR-013-cors-regex-policy.md)); the Functions code under
[`backend/functions/src/`](../../backend/functions/src/) emits no
`Access-Control-Allow-*` headers and the APIM policy is the only
allowlist gate. Path C cannot inherit that gate because it deliberately
bypasses APIM (direct ACA ingress is the architectural point of the
path — see [ADR-007](./ADR-007-api-architecture-spectrum.md)).

The decision is to **keep CORS at the gateway layer for Path C too**,
configured on the ACA ingress (`cors` block on
`azurerm_container_app.ingress`) with the same allowlist the APIM regex
policy uses. Both paths source the allowlist from the same
`APIM_CORS_ORIGINS` ADO variable group entry, so adding or removing a
domain updates both gateways atomically.

The alternative — emit CORS headers from Functions code — was rejected
because it would (a) require the same code to behave differently depending
on whether it's running behind APIM or behind ACA ingress (APIM strips
and re-adds CORS, which would conflict with app-emitted headers), and
(b) move policy concerns out of the gateway, weakening the
"gateway is the allowlist" model. Keeping CORS gateway-layer in both
envelopes preserves the comparison doc's claim that Path B and Path C
ship byte-identical application code.

### Container Registry sharing

PCPC reuses the existing `maberdevcontainerregistry-ccedhvhwfndwetdp`
ACR rather than provisioning a per-environment registry. The CI-tooling
images (`pcpc-ci-terraform-azure`, `pcpc-ci-node22`, `pcpc-ci-node-azure`)
already live in this ACR; Path C adds the `pcpc/functions` repository
path for the application image. No new ACR module is added; the
container-app module accepts the ACR resource ID and login server as
inputs so it remains agnostic to where the registry is provisioned.

### Frontend integration

Path C registers as a `BackendDefinition` at
[`frontend/src/lib/backends/path-c-aca.ts`](../../frontend/src/lib/backends/),
mirroring [`path-b-azure.ts`](../../frontend/src/lib/backends/path-b-azure.ts).
The 2-second healthcheck timeout at
[`frontend/src/lib/backends/health.ts`](../../frontend/src/lib/backends/health.ts)
is unchanged; the `min_replicas = 1` decision exists precisely so this
timeout does not falsely degrade Path C. The base URL is configured via
the `PUBLIC_ACA_API_BASE_URL` env var (per-scope on Vercel).

### Cost envelope

At portfolio traffic levels with `min_replicas = 1` and the default
0.5 vCPU / 1 GiB memory:

- Path B (Functions Consumption): ~$0/mo at idle, scales to ~$1–3/mo
  under recruiter traffic
- Path C (ACA min=1): ~$5–15/mo at idle (vCPU + memory accruing
  continuously), marginal cost per request negligible

This delta is the price of the architectural demonstration and is
flagged honestly in [`docs/architecture-comparison.md`](../architecture-comparison.md).

## Related Decisions

- [ADR-007: API Architecture Spectrum](./ADR-007-api-architecture-spectrum.md)
- [ADR-008: APIM vs SvelteKit BFF as Gateway](./ADR-008-apim-vs-bff-gateway.md)
- ADR-010: Path to AKS *(planned, Phase 3)*
- [ADR-006: API Integration Strategy](./ADR-006-api-integration-strategy.md)
