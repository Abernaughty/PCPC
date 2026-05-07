# Architecture Comparison

> **Phase 1 (current).** Two of three paths are live: Path A (Vercel BFF)
> and Path B (APIM + Functions). Path C (ACA Container) ships in Phase 2;
> a third column will be added to every table here when it lands.

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
- ADR-009 *(Phase 2)*: Functions Consumption vs Container Apps

---

## Headline architecture

```
                          pcpc.maber.io
                       (Vercel · SvelteKit)
                                │
                  ┌─────────────┴─────────────┐
          ?backend=vercel              ?backend=azure          (?backend=aca, Phase 2)
                  │                            │                            │
        SvelteKit BFF                  APIM (Consumption)          ACA + KEDA (planned)
        (+server.ts on                         │                            │
         Vercel serverless)            Azure Functions v4         Azure Functions v4
                  │                    (Node.js 22)               (containerized)
                  │                            │                            │
                  └────────────────────────────┴────────────────────────────┘
                                               │
                                  Cosmos DB (Scrydex schema)
                                  Redis (optional)
```

A single SvelteKit frontend serves all three paths. The active path is
selected by the `?backend=` URL parameter and surfaced in the corner badge.
All paths share the same Cosmos DB account and the same TypeScript types
via `@pcpc/shared`.

## Data flow (Path A and Path B; Phase 2 adds Path C as a parallel branch)

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
                └── ?backend=azure  ──▶ APIM (api.pcpc.maber.io, Consumption)
                                               │
                                               ▼
                                       Azure Functions v4 (Node 22)
                                               │
                                               ▼
                                       Cosmos DB (Scrydex schema)
                                               ▲
                                               │ (cache miss)
                                               ▼
                                       Scrydex API
```

The Scrydex upstream is the same for both paths — when neither Cosmos nor
Redis has the data, both paths fetch from `api.scrydex.com` and write back
through the same cache hierarchy. That hierarchy (Redis → Cosmos → upstream)
is described in [ADR-003](./adr/ADR-003-caching-architecture-design.md).

---

## Side-by-side comparison

### Request flow

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions |
|---|---|---|
| User-facing URL | `pcpc.maber.io` | `pcpc.maber.io` (toggle to `?backend=azure`) |
| Frontend → API hop | Same Vercel deployment, no separate gateway | Browser → APIM → Functions → Cosmos |
| Network hops added by the gateway | 0 | 1 (APIM → Functions) |
| Cold-start surface | Vercel serverless (~50–150ms) | APIM cold (~80–150ms) + Functions cold (~500–1500ms on Consumption) |
| Where business logic runs | SvelteKit `+server.ts` in same process as page rendering | Azure Functions v4 (separate process, separate runtime) |
| Direct backend access without the gateway | N/A — same process | Functions HTTP trigger is `function`-auth (key required); APIM holds the key |

### Operational characteristics

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions |
|---|---|---|
| IaC scope | None (Vercel project settings only) | 9 Terraform modules (`infra/modules/`) + APIM-as-code (`apim/`) |
| CI/CD | Vercel auto-deploy on push to `main`; PR previews | Azure DevOps multi-stage pipeline; ACR-backed CI containers |
| Deployment time | ~30–90s | ~3–8min (Terraform plan/apply + Functions deploy + APIM sync) |
| Observability | Vercel logs + browser dev tools | Application Insights + Log Analytics + APIM Analytics |
| Secret management | Vercel env vars | Azure Key Vault → Function App app-settings |
| Identity model | Vercel deployment owner | Azure managed identity |
| Custom domain (Phase 1) | `pcpc.maber.io` (Vercel + Cloudflare) | Per-env: `dev-api.pcpc.maber.io`, `staging-api.pcpc.maber.io`, `api.pcpc.maber.io` (APIM hostname binding + Azure-managed cert; CNAMEs in Cloudflare) |
| TLS cert | Vercel-managed | Azure-managed (free) |

### Scaling and cost

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions |
|---|---|---|
| Scaling model | Per-request serverless (Vercel) | APIM Consumption: per-call, no min instances; Functions Consumption: per-execution |
| Scale-to-zero | Yes | Yes |
| Concurrency limit per instance | Vercel default (high) | Functions Consumption: 200 concurrent per instance |
| Estimated monthly cost (recruiter-traffic levels) | $0 (Vercel free tier) | ~$2–8 (APIM Consumption + Functions Consumption + Cosmos serverless) |

### Security posture

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions |
|---|---|---|
| TLS termination | Vercel edge | APIM gateway |
| Authn/authz | App-level (none required for read endpoints) | APIM subscription model available; currently `subscription_required = false` for the demo |
| Secret access | Vercel env vars at build/runtime | Key Vault references in app-settings; Functions read at runtime |
| Rate limiting | None (Vercel edge limits only) | Available via APIM policy; not currently configured |
| CORS | SvelteKit handles same-origin natively | Configured at APIM to accept `pcpc.maber.io` (Phase 1B) |
| Audit | Vercel deployment log | App Insights request log + APIM Analytics |

### Schema and data

| Aspect | Path A — Vercel BFF | Path B — APIM + Functions |
|---|---|---|
| Backend schema (Phase 1) | Scrydex | PokeData *(legacy; migrates to Scrydex in Phase 2)* |
| Frontend-facing shape | Scrydex (canonical) | Scrydex via `pokedata-to-scrydex` adapter |
| Type sharing | `@pcpc/shared` (Scrydex types) | `@pcpc/shared` (Scrydex types) |
| Per-variant pricing supported | Yes | No *(empty `variants[]` until Phase 2)* |
| Cosmos DB | Same account, same Scrydex containers | Same account; will use Scrydex containers post-migration |

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

---

## Phase 1 known limitations (resolved in Phase 2)

These are surfaced explicitly because the portfolio rewards honesty about
in-progress work more than it rewards hiding it.

- **Path B serves PokeData-shape data.** The Functions code has not yet
  been migrated to the Scrydex schema. A frontend adapter
  (`frontend/src/lib/backends/adapters/pokedata-to-scrydex.ts`) bridges
  the request/response shape so the toggle works end-to-end, but the
  adapter cannot synthesize per-variant pricing that PokeData never had.
  Path B card detail therefore renders as "no pricing available" until
  Phase 2 migrates the Functions to Scrydex.
- **Set metadata on Path B is sparse.** Series, total, printedTotal,
  isOnlineOnly, logo, and symbol come back undefined on Path B because
  PokeData does not expose them. Path A returns full metadata.
- **Custom domains land in Phase 1B.** Phase 1A ships the toggle pointed
  at the dev APIM's `*.azure-api.net` hostname. Phase 1B provisions the
  per-environment custom domains (`dev-api`, `staging-api`, `api`) with
  Azure-managed certs and adds the validation + CNAME records in
  Cloudflare manually.

The toggle's healthcheck-driven graceful degradation guarantees the user
experience never regresses below "Path A works." A reader who never
engages the toggle gets a normal Scrydex-backed experience identical to
the pre-Phase-1 deployment.

---

## How to try it

1. Open [pcpc.maber.io](https://pcpc.maber.io) *(wired in Phase 1B)*.
2. Notice the badge in the bottom-right corner. It shows the active backend
   and the latency of its last healthcheck.
3. Click the badge. Pick a different path from the popover. The page
   reloads and the same UI is now talking to the other backend.
4. The latency badge updates with the new backend's response time.
5. To pin a path via URL, append `?backend=vercel` or `?backend=azure`.
6. To return to default behavior, remove the parameter (or pick Vercel).

The toggle is opt-in. A visitor who never opens the popover sees Path A
behavior throughout — fast, normal, unbroken.

---

## What changes in Phase 2

This document gets a third column (Path C — ACA Container) and ADR-009
gets published. The headline diagram gains a third descending arrow, the
data-flow diagram gains a third parallel branch, and the comparison tables
above gain rows for KEDA scaling characteristics, container image
provenance, and the cold-start delta between Functions Consumption and
ACA min-replicas-1 deployments.

Once Path C is live, the Phase 1 known-limitations section above
collapses to a single line: "schema migrated; Path B and Path C now serve
canonical Scrydex data."
