# Architecture Comparison

> **Phase 2.2 (current).** All three paths are described here. Path A
> (Vercel BFF) and Path B (APIM + Functions, Scrydex-native post-Phase-2.1)
> are live. Path C (ACA Container) ships in Phase 2.2 — the infra and
> pipeline land first, then the frontend toggle wires `?backend=aca`.

This document is the marquee artifact of the PCPC portfolio. The plan
(see [`PORTFOLIO_PLAN.md`](./PORTFOLIO_PLAN.md)) is to ship one product
multiple ways from one repo so the architectural comparison is
*operational*, not just *described*. This doc is where the tradeoffs are
written down.

The decision narrative behind the comparison lives in the ADRs:

- [ADR-007 — API Architecture Spectrum](./adr/ADR-007-api-architecture-spectrum.md):
  why three paths exist at all
- [ADR-008 — APIM vs SvelteKit BFF as Gateway](./adr/ADR-008-apim-vs-bff-gateway.md):
  the gateway-shaped tradeoff between Path A and Path B
- [ADR-009 — Functions Consumption vs Container Apps](./adr/ADR-009-functions-consumption-vs-container-apps.md):
  the runtime-shaped tradeoff between Path B and Path C

---

## Headline architecture

```
                              pcpc.maber.io
                           (Vercel · SvelteKit)
                                    │
                ┌───────────────────┼───────────────────┐
        ?backend=vercel       ?backend=azure       ?backend=aca
                │                   │                   │
         SvelteKit BFF       APIM (Consumption)   ACA Ingress
        (+server.ts on               │                   │
         Vercel serverless)  Azure Functions v4   Azure Functions v4
                │            (Node.js 22, ZIP)   (Node.js 22, container)
                │                   │                   │
                └───────────────────┴───────────────────┘
                                    │
                       Cosmos DB (Scrydex schema)
                       Redis (optional)
```

A single SvelteKit frontend serves all three paths. The active path is
selected by the `?backend=` URL parameter and surfaced in the corner badge.
All paths share the same Cosmos DB account and the same TypeScript types
via `@pcpc/shared`.

## Data flow (all three paths converge on the same Cosmos + Scrydex upstream)

```
Browser ──▶ pcpc.maber.io (Vercel)
                │
                ├── ?backend=vercel ──▶ SvelteKit +server.ts
                │                              │
                │                              ▼
                │                        Cosmos DB (Scrydex schema)
                │                              ▲
                │                              │ (cache miss)
                │                              ▼
                │                        Scrydex API
                │
                ├── ?backend=azure  ──▶ APIM (dev-api.pcpc.maber.io, Consumption)
                │                              │
                │                              ▼
                │                       Azure Functions v4 (Node 22, ZIP)
                │                              │
                │                              ▼
                │                       Cosmos DB (Scrydex schema)
                │                              ▲
                │                              │ (cache miss)
                │                              ▼
                │                       Scrydex API
                │
                └── ?backend=aca    ──▶ ACA Ingress (FQDN)
                                               │
                                               ▼
                                       Azure Functions v4 (Node 22, container)
                                               │
                                               ▼
                                       Cosmos DB (Scrydex schema)
                                               ▲
                                               │ (cache miss)
                                               ▼
                                       Scrydex API
```

The Scrydex upstream is the same for all three paths — when neither Cosmos
nor Redis has the data, every path fetches from `api.scrydex.com` and
writes back through the same cache hierarchy. That hierarchy (Redis →
Cosmos → upstream) is described in
[ADR-003](./adr/ADR-003-caching-architecture-design.md).

Path B and Path C run the *same application code* — the difference is the
runtime envelope (Functions host on Consumption vs containerized
Functions on Azure Container Apps) and the network ingress (APIM vs ACA
ingress). The Functions source under
[`backend/functions/src/`](../backend/functions/src/) is unchanged
between them. See
[ADR-009](./adr/ADR-009-functions-consumption-vs-container-apps.md) for
the full runtime tradeoff.

---

## Side-by-side comparison

### Request flow

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions | Path C — ACA Container |
|---|---|---|---|
| User-facing URL | `pcpc.maber.io` | `pcpc.maber.io` (toggle to `?backend=azure`) | `pcpc.maber.io` (toggle to `?backend=aca`) |
| Frontend → API hop | Same Vercel deployment, no separate gateway | Browser → APIM → Functions → Cosmos | Browser → ACA ingress → Functions container → Cosmos |
| Network hops added by the gateway | 0 | 1 (APIM → Functions) | 0 (ACA ingress is L7 routing in the same node) |
| Cold-start surface | Vercel serverless (~50–150ms) | APIM cold (~80–150ms) + Functions cold (~500–1500ms on Consumption) | ACA ingress (~10–30ms) + Functions container cold (~0ms at min_replicas=1; ~1–3s at min=0) |
| Where business logic runs | SvelteKit `+server.ts` in same process as page rendering | Azure Functions v4 (separate process, separate runtime) | Azure Functions v4 in container (byte-identical to Path B's code) |
| Direct backend access without the gateway | N/A — same process | Functions HTTP trigger is `function`-auth (key required); APIM holds the key | ACA ingress is the only path; anonymous public ingress |

### Operational characteristics

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions | Path C — ACA Container |
|---|---|---|---|
| IaC scope | None (Vercel project settings only) | 9 Terraform modules (`infra/modules/`) + APIM-as-code (`apim/`) | New `container-app` module (`infra/modules/container-app/`) reusing existing log-analytics, cosmos, app-insights, storage outputs |
| CI/CD | Vercel auto-deploy on push to `main`; PR previews | Azure DevOps multi-stage pipeline; Functions ZIP deploy with content-hash skip | Azure DevOps stage parallel to Path B's; Docker build → Trivy scan → ACR push → `az containerapp update` |
| Deployment time | ~30–90s | ~3–8min (Terraform plan/apply + Functions deploy + APIM sync) | ~5–10min (Terraform plan/apply + image build + CVE scan + ACR push + revision activation) |
| Observability | Vercel logs + browser dev tools | Application Insights + Log Analytics + APIM Analytics | Same App Insights + Log Analytics workspace as Path B; ACA-native revision/replica logs additionally |
| Secret management | Vercel env vars | Azure Key Vault → Function App app-settings | ACA `secret` blocks (managed identity-resolved at runtime); same Key Vault as Path B |
| Identity model | Vercel deployment owner | Azure managed identity (SystemAssigned) | Azure user-assigned managed identity (UAMI) — first UAMI in the repo, used for ACR pull |
| Custom domain (current) | `pcpc.maber.io` (Vercel + Cloudflare) | Deferred per [ADR-012](./adr/ADR-012-apim-managed-cert-suspension.md); using `*.azure-api.net` until Azure-managed cert creation resumes Jun 2026 | Deferred (mirrors Path B); using ACA-issued `*.azurecontainerapps.io` until the managed-cert window opens |
| TLS cert | Vercel-managed | Currently `*.azure-api.net` default; future Azure-managed (free) per ADR-012 | Currently ACA-issued; future Azure-managed per same window |

### Scaling and cost

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions | Path C — ACA Container |
|---|---|---|---|
| Scaling model | Per-request serverless (Vercel) | APIM Consumption: per-call, no min instances; Functions Consumption: per-execution | ACA scale rule (HTTP concurrency by default); KEDA-ready for Cosmos change feed / queue depth / custom scalers |
| Scale-to-zero | Yes | Yes | Configurable; **min_replicas=1** in PCPC to keep healthcheck under 2s probe timeout (min=0 supported but trades cold-start for cost) |
| Concurrency limit per instance | Vercel default (high) | Functions Consumption: 200 concurrent per instance | Tunable via scale rule (default 10 HTTP requests/replica before scale-out) |
| Estimated monthly cost (recruiter-traffic levels) | $0 (Vercel free tier) | ~$2–8 (APIM Consumption + Functions Consumption + Cosmos serverless) | ~$5–15 at min_replicas=1 (continuous vCPU + memory accrual on 0.5 vCPU / 1 GiB); ~$0–3 at min_replicas=0 |

### Security posture

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions | Path C — ACA Container |
|---|---|---|---|
| TLS termination | Vercel edge | APIM gateway | ACA ingress (managed) |
| Authn/authz | App-level (none required for read endpoints) | APIM subscription model available; currently `subscription_required = false` for the demo | Anonymous public ingress; app-level (none required for read endpoints) |
| Secret access | Vercel env vars at build/runtime | Key Vault references in app-settings; Functions read at runtime | ACA `secret` blocks resolved via managed identity at revision-start time |
| Rate limiting | None (Vercel edge limits only) | Available via APIM policy; not currently configured | Available via ACA ingress rules; not currently configured |
| CORS | SvelteKit handles same-origin natively | Configured at APIM via the regex policy (see [ADR-013](./adr/ADR-013-cors-regex-policy.md)) — Functions code emits no CORS headers; APIM is the only allowlist gate | Configured at the ACA ingress `cors` block; same allowlist as APIM (mirrors [ADR-013](./adr/ADR-013-cors-regex-policy.md) at a different gateway). Keeps Functions code envelope-agnostic — Path B and Path C ship byte-identical code; only the gateway differs. |
| Audit | Vercel deployment log | App Insights request log + APIM Analytics | App Insights request log + ACA revision/replica logs; image SHA pinned per revision for supply-chain attestation |
| Image / runtime provenance | N/A | ZIP deploy; runtime opacity inside the Functions host | Digest-pinned image (`pcpc/functions@sha256:…`) scanned for HIGH+ CVEs (Trivy) in CI before push; revision-pinned in Terraform |

### Schema and data

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions | Path C — ACA Container |
|---|---|---|---|
| Backend schema | Scrydex (canonical) | Scrydex (canonical, Phase 2.1) | Scrydex (canonical — same code as Path B) |
| Frontend-facing shape | Scrydex envelopes from [`@pcpc/shared`](../backend/shared) | Scrydex envelopes from [`@pcpc/shared`](../backend/shared) | Scrydex envelopes from [`@pcpc/shared`](../backend/shared) |
| Type sharing | `@pcpc/shared` (types-only, interfaces erase) | `@pcpc/shared` (npm `file:../shared`; ZIP deploy excludes it via `--omit=dev`) | `@pcpc/shared` (npm `file:../shared`; container build copies `shared/` into context, runtime image excludes it via `--omit=dev`) |
| Per-variant pricing supported | Yes | Yes (post-Phase-2.1 Scrydex cutover) | Yes (identical code) |
| Cosmos DB | Same account, same Scrydex containers | Same account, same Scrydex containers | Same account, same Scrydex containers |

### Runtime model (the marquee row for Phase 2.2)

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions | Path C — ACA Container |
|---|---|---|---|
| Runtime envelope | Vercel serverless (Node.js) | Functions host on Consumption plan (managed by Azure) | Functions host inside an OCI container on ACA |
| Deploy artifact | Build output uploaded to Vercel | ZIP attached to Function App | Digest-pinned OCI image in ACR (`pcpc/functions@sha256:…`) |
| Image immutability | N/A | Mutable host; runtime patched by Microsoft | Immutable image; base image upgrades are explicit, scanned, and rollable |
| Scaling primitive | Vercel request router | Functions host autoscale (opaque) | ACA scale rules (HTTP concurrency; KEDA-ready) |
| Portability | Vercel-specific | Functions host-specific (Azure lock-in) | OCI image (same artifact runs on AKS, ECS, GKE, local Docker) |
| Supply-chain attestability | Build provenance (Vercel) | Lower (ZIP + managed runtime) | High (image SHA + base image SHA + CVE scan results in CI logs) |
| FedRAMP / ATO posture | N/A (not the target audience) | Moderate (managed Azure service, but runtime is opaque) | Strong (explicit image lineage, digest pinning, CVE attestation, no managed-runtime opacity) |
| What the code knows about its runtime | Vercel adapter (SvelteKit) | Pure Functions code; no Vercel awareness | Pure Functions code; no ACA awareness (the container is environment-agnostic) |

Path B and Path C ship **byte-identical application code** and serve
**byte-identical responses** to the frontend. The differences in this
table are entirely about the runtime envelope and the operational
properties that flow from it. The full decision rule for choosing
between Consumption and ACA is in
[ADR-009](./adr/ADR-009-functions-consumption-vs-container-apps.md).

---

## What each path is best for demonstrating

### Path A — Vercel BFF (modern edge / startup vocabulary)

- SvelteKit 2 + Svelte 5 runes, Tailwind CSS v4
- `+server.ts` BFF pattern with no separate gateway
- Vercel adapter, edge runtime familiarity
- "One process, one deploy, one bill" simplicity
- Lightweight personal-app architecture done well

### Path B — APIM + Functions (enterprise / regulated vocabulary)

- Azure API Management with declarative policies and a developer portal
- Azure Functions v4 on Node.js 22 with idiomatic separation of concerns
- 9-module Terraform composition (resource group, key vault, cosmos, function app, storage, app insights, log analytics, APIM, static web app legacy module)
- Azure DevOps multi-stage pipelines with ACR-backed CI containers
- Application Insights + Log Analytics for end-to-end observability
- Managed identity, Key Vault references, audit log integration
- Defense/regulated-industry-friendly deployment patterns

### Path C — ACA Container (container fluency / supply-chain vocabulary)

- Same Functions code as Path B, packaged as an OCI image
- Multi-stage Dockerfile against `mcr.microsoft.com/azure-functions/node:4-node22`
- Digest-pinned image with HIGH+ CVE scanning (Trivy) blocking in CI
- Azure Container Apps with KEDA-ready scaling (HTTP rule today, event-source-driven scalers available)
- User-assigned managed identity for ACR pull (no admin user on the registry)
- Image revision history in ACR; ACA revision rollouts are atomic and rollable
- FedRAMP / ATO-friendly: explicit image lineage, runtime not opaque
- Demonstrates the *next* architectural step (container portability) without paying the AKS cost (see [ADR-010, planned](./adr/ADR-010-path-to-aks.md))

---

## Current known limitations

These are surfaced explicitly because the portfolio rewards honesty about
in-progress work more than it rewards hiding it.

- **Custom domains are deferred** per
  [ADR-012](./adr/ADR-012-apim-managed-cert-suspension.md). Until Azure
  resumes managed-cert creation (window: Aug 2025 → Jun 2026), Path B uses
  the dev APIM's `*.azure-api.net` hostname and Path C uses the ACA-issued
  `*.azurecontainerapps.io` ingress hostname. Restoration runbook is in
  the ADR.
- **APIM-in-front-of-ACA is intentionally *not* used.** Path C is designed
  to demonstrate "skip the gateway, see what the runtime alone gives you"
  — routing Path C through APIM would blur the architectural comparison.
  Path C therefore needs its own gateway-layer configuration for
  cross-cutting concerns that APIM provides on Path B:
  - **CORS** — implemented as an ACA ingress `cors` rule with the same
    allowlist as the APIM regex policy ([ADR-013](./adr/ADR-013-cors-regex-policy.md)),
    sourced from the same `APIM_CORS_ORIGINS` variable group entry. The
    Functions code itself emits no CORS headers in either envelope; the
    gateway is the single allowlist gate (APIM on Path B, ACA ingress on
    Path C). This keeps the application code byte-identical across the
    two paths — only the runtime envelope differs.
  - **Rate limiting and observability** — same App Insights connection
    string covers both paths' telemetry; rate limiting is not configured
    on either path today.

The toggle's healthcheck-driven graceful degradation guarantees the user
experience never regresses below "Path A works." A reader who never
engages the toggle gets a normal Scrydex-backed experience identical to
the pre-portfolio deployment.

---

## How to try it

1. Open [pcpc.maber.io](https://pcpc.maber.io).
2. Notice the badge in the bottom-right corner. It shows the active backend
   and the latency of its last healthcheck.
3. Click the badge. Pick a different path from the popover. The page
   reloads and the same UI is now talking to the other backend.
4. The latency badge updates with the new backend's response time.
5. To pin a path via URL, append `?backend=vercel`, `?backend=azure`, or
   `?backend=aca` (the last is live once Phase 2.2 PR-3 merges).
6. To return to default behavior, remove the parameter (or pick Vercel).

The toggle is opt-in. A visitor who never opens the popover sees Path A
behavior throughout — fast, normal, unbroken.

---

## What's next

With Phase 2.2 shipping the ACA path, the three-column comparison is
complete and the marquee artifact is operational. Phase 3 covers
distribution — portfolio site deploy, LinkedIn post with the headline
diagram, the planned
[ADR-010 — Path to AKS](./adr/ADR-010-path-to-aks.md) as the
speculative "what would change if this needed Kubernetes" document, and
optional polish items like KEDA event-driven scale rules on Path C (e.g.
scaling on Cosmos change feed instead of HTTP concurrency).
