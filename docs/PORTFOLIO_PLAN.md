# PCPC Portfolio Plan: Tale of Three Architectures

**Owner:** Michael Abernathy
**Status:** Phase 0 done · Phase 1A done · Phase 1B mostly done (1 fix outstanding on PR #139, see issue #140) · Phase 2 not started
**Last Updated:** 2026-05-07
**Target Completion:** ~1 week (2 weeks conservative)

## Phase progress (live, supersedes the per-phase status tables below)

- **Phase 0:** ✅ done. Consolidation merged. Tags: `phase-0/pre-consolidation`, `phase-0/legacy-spa-archive`.
- **Phase 1A:** ✅ done via PR #131. BackendToggle UI, abstraction layer (`frontend/src/lib/backends/`), pokedata→scrydex adapter, ADR-007 (API Architecture Spectrum), ADR-008 (APIM vs BFF), `docs/architecture-comparison.md`, README live-demo section.
- **Phase 1B:** ✅ done via PRs #132–#138 (+ #139/#141/#142/#143/#144 closing out the apply-time fix path). Custom domains deferred per ADR-012; CORS regex policy live per ADR-013.
- **Phase 2.1:** ✅ done via PRs #145, #146 (2026-05-12). Backend cut over from PokeData to Scrydex. `@pcpc/shared` canonical types, `ScrydexApiService.ts`, smoke tests re-promoted to blocking. Tags: `phase-2/pre-scrydex-cutover`, `phase-2/post-scrydex-cutover`.
- **Phase 2.2:** in progress. Containerize Functions + ACA path. PR-1 (this work): ADR-009 + 3-column comparison doc. PR-2: Dockerfile + container-app Terraform module + ADO pipeline stage (dev only). PR-3: frontend toggle + Vercel env var.
- **Phase 3:** not started.

## ADRs accepted across Phases 1 and 2

- [ADR-007](./adr/ADR-007-api-architecture-spectrum.md) — API Architecture Spectrum
- [ADR-008](./adr/ADR-008-apim-vs-bff-gateway.md) — APIM vs SvelteKit BFF as Gateway
- [ADR-009](./adr/ADR-009-functions-consumption-vs-container-apps.md) — Functions Consumption vs Container Apps
- [ADR-011](./adr/ADR-011-deployment-topology-and-testing-model.md) — Deployment Topology and Testing Model
- [ADR-012](./adr/ADR-012-apim-managed-cert-suspension.md) — APIM Managed Cert Suspension (defer custom domains)
- [ADR-013](./adr/ADR-013-cors-regex-policy.md) — CORS Regex-Based Origin Allowlist Policy

---

## TL;DR

PCPC (Pokémon Card Price Checker) will be deployed three ways from a single consolidated repository to demonstrate architectural range across modern-edge, enterprise-cloud, and managed-container patterns. A SvelteKit frontend at `pcpc.maber.io` provides a runtime backend toggle so recruiters can experience all three live. Three to four ADRs document the architectural reasoning. A profile-level README and portfolio site frame the whole thing as one cohesive story.

The goal is not to build more software. The goal is to make existing engineering legible to recruiters across enterprise, mid-market, and modern-tech audiences.

---

## Problem Statement

Two repos currently exist and demonstrate substantial engineering work:

- **`Abernaughty/PCPC`** — Enterprise Azure (APIM Consumption + Functions v4 + Cosmos + Redis), 9-module Terraform, ADO pipelines with ACR-backed CI containers, dedicated test suite, memory-bank documentation. Currently uses Svelte 4 SPA (likely retired during this work).
- **`Abernaughty/maber-web`** — Turborepo monorepo (pnpm + Turbo) containing four unrelated SvelteKit apps deployed to Vercel, with shared `@maber/ui`/`@maber/utils`/`@maber/config` packages, GitHub Actions CI. The `apps/pcpc/` directory contains the modern SvelteKit frontend for PCPC.

Three problems with the current state:

1. **Discoverability.** A recruiter landing on either repo cannot infer the existence or relevance of the other. The combined story is invisible.
2. **Narrative.** The two implementations represent a deliberate architectural comparison, but no document presents them that way. The work reads as "two unrelated projects" instead of "one engineer who can articulate tradeoffs across architectural styles."
3. **Repo coherence.** PCPC's frontend and backend live in separate repositories, with the frontend sharing a monorepo with three unrelated personal apps. This split makes the architectural comparison harder to tell and complicates schema/type sharing across the three deployment paths.

A fourth aspect is *opportunity*: with marginal effort (containerizing the existing Functions code), a third architectural path — Azure Container Apps — can be added. This produces a three-point comparison that demonstrates the architectural *spectrum*, not just two endpoints.

The plan addresses all four by consolidating into the `PCPC` repo, framing the comparison narrative explicitly, and adding the third path.

---

## Goals

1. **Recruiter-ready in 30 seconds.** Anyone landing on `github.com/Abernaughty` can understand the portfolio's scope and judge fit within half a minute.
2. **Live three-path demo.** A single deployed app where recruiters can toggle between architectures and see real responses from each.
3. **Architectural judgment as the hero artifact.** ADRs and a comparison document that demonstrate senior+ thinking, not just senior+ engineering.
4. **Audience-agnostic appeal.** Defense/enterprise recruiters see APIM, Terraform, ADO, IaC depth. Modern/startup recruiters see SvelteKit, edge runtime, modern monorepo within the project. Both audiences see container fluency.
5. **One repo, one story.** All PCPC code, infrastructure, pipelines, and documentation in `Abernaughty/PCPC`. No bouncing between repos.
6. **No regressions.** At every phase checkpoint, the portfolio is *better* than before. There is no "broken middle state" while work is in flight.

## Non-Goals

- Building AKS or Kubernetes-based infrastructure. (Documented as a future path, not implemented.)
- Adding new product features to PCPC. The product is a vehicle for architectural demonstration, not a thing to grow.
- Achieving production-grade SLAs. This is a portfolio, not a customer-facing service.
- Maintaining feature parity across all three paths if it slows shipping. Path A is the canonical product experience; Path B and C are architectural demonstrations of the same API surface.
- Migrating the other `maber-web` apps (landing, blackjack, portfolio) — they remain in `maber-web` and are out of scope for this plan.
- Adding a parallel GitHub Actions CI pipeline for the frontend. Vercel's PR preview build already runs install, typecheck, and build on every push; a duplicated GitHub Actions workflow would not add signal. Revisitable in Phase 3 if a multi-CI talking point becomes valuable.

---

## Repository Structure

After Phase 0 consolidation, `Abernaughty/PCPC` becomes the canonical home for all PCPC work, structured as an internal pnpm workspace:

```
PCPC/
├── frontend/                    # SvelteKit 2 + Svelte 5 app (migrated from maber-web/apps/pcpc)
│   ├── src/
│   ├── package.json             # depends on @pcpc/shared
│   └── vercel.json
├── backend/
│   ├── functions/               # Azure Functions v4 (was app/backend)
│   │   ├── src/
│   │   ├── Dockerfile           # Added in Phase 2 for ACA path
│   │   └── package.json         # depends on @pcpc/shared
│   └── shared/                  # @pcpc/shared workspace package — types, schemas
│       └── package.json
├── infra/
│   ├── modules/                 # Terraform modules (existing 9 + new container-app in Phase 2)
│   ├── envs/                    # dev / staging / prod
│   └── README.md
├── apim/                        # APIM as code
├── db/                          # Cosmos DB schema management
├── pipelines/
│   └── ado/                     # Azure DevOps pipelines (was .ado/)
├── docs/
│   ├── PORTFOLIO_PLAN.md        # this document
│   ├── architecture-comparison.md  # the marquee artifact
│   ├── architecture-diagram.svg    # rendered headline diagram
│   └── adr/
│       ├── README.md            # ADR format and index
│       ├── 0001-api-architecture-spectrum.md
│       ├── 0002-functions-vs-container-apps.md
│       ├── 0003-apim-vs-bff-gateway.md
│       └── 0004-path-to-aks.md  # optional, Phase 3
├── tests/
├── tools/
├── memory-bank/                 # Existing project memory documentation
├── .devcontainer/
├── pnpm-workspace.yaml          # New: defines frontend, backend/functions, backend/shared workspaces
├── package.json                 # New: workspace root, scripts that span frontend + backend
├── turbo.json                   # Optional: Turbo for cross-workspace task orchestration
└── README.md                    # Refreshed to be recruiter-first, tells the three-path story
```

### Notes on the Structure

- **Internal workspace, not external monorepo.** PCPC becomes its own pnpm workspace so frontend and backend can share a single `@pcpc/shared` package containing canonical types (Card, Set, Variant, etc.). This makes Phase 2's schema migration trivially atomic — change types in one place, both consumers update.
- **`maber-web` stays as-is for non-PCPC apps.** The landing, blackjack, and portfolio apps remain in `maber-web`. Only `apps/pcpc/` migrates to the PCPC repo. The `@maber/*` shared packages stay in `maber-web` for the apps that still use them.
- **Git history is preserved.** The frontend migration uses `git filter-repo` + `git merge --allow-unrelated-histories` to bring `apps/pcpc/` history into the PCPC repo with provenance intact.
- **CI/CD by purpose.** ADO pipelines (`pipelines/ado/`) handle infrastructure and Azure-side deployments (Functions, APIM, ACA in Phase 2). Frontend CI is handled by Vercel's automatic PR preview builds — no separate workflow needed in this repo.

---

## Target Architecture

### How it works (in plain English)

A user visits `pcpc.maber.io`. That URL hits the **Vercel-hosted SvelteKit frontend**. The frontend reads a `?backend=` URL query parameter (defaulting to `vercel`) and uses that to decide which API to call:

- `?backend=vercel` — calls **Path A**: the SvelteKit app's own `+server.ts` API routes (the "BFF"). This runs inside the same Vercel deployment as the frontend itself; no extra infrastructure.
- `?backend=azure` — calls **Path B**: `api.pcpc.maber.io`, which is APIM (Consumption tier) routing to Azure Functions v4.
- `?backend=aca` — calls **Path C**: `aca.pcpc.maber.io`, which is Azure Container Apps ingress routing to a Docker image of the *same* Functions code as Path B.

All three paths read from the **same Cosmos DB account** with the same Scrydex schema. The SvelteKit frontend itself is the single user-facing entry point regardless of which backend is selected — there is only one URL recruiters need to know.

A small UI control (corner badge with one-click switcher) lets a visitor flip between paths without manually editing the URL. A healthcheck on each backend determines whether its toggle option is enabled, so a broken or undeployed path degrades gracefully (the toggle simply hides it) rather than producing errors.

### Diagram

The headline architecture diagram lives at `docs/architecture-diagram.svg` and is embedded in `docs/architecture-comparison.md` and the main README. It shows:

- One frontend box at top representing the Vercel-hosted SvelteKit app
- Three labeled arrows (`?backend=vercel`, `?backend=azure`, `?backend=aca`) descending to three backend boxes
- All three backend boxes converging on a single Cosmos DB box at the bottom

A separate, more detailed **data-flow diagram** in `architecture-comparison.md` shows how Scrydex (the upstream pricing API) feeds into Cosmos DB on cache misses. That detail is intentionally omitted from the headline diagram so the three-path comparison stays the focus.

### Path A: SvelteKit BFF on Vercel

- **Source:** `frontend/` (in PCPC repo)
- **Stack:** SvelteKit 2.16, Svelte 5 runes, Tailwind CSS v4, Vercel adapter
- **Runtime location:** Same Vercel deployment as the frontend itself. The `+server.ts` files live in the same app and run on Vercel's serverless functions.
- **Data path:** Browser → SvelteKit `+server.ts` routes → Cosmos DB / Redis / Scrydex API (on cold cache)
- **Shared types:** Imports from `@pcpc/shared`
- **CI/CD:** Vercel automatic deployment on push to `main`; preview deployments on PRs serve as CI
- **Best for demonstrating:** Modern frontend SSR, edge runtime, BFF pattern, lightweight personal-app architecture

### Path B: APIM + Functions on Azure

- **Source:** `backend/functions/` (in PCPC repo)
- **Stack:** Azure API Management (Consumption tier) → Azure Functions v4 (Node.js 22) → Cosmos DB / Redis
- **Runtime location:** Azure subscription, separate from Vercel
- **Data path:** Browser → APIM (rate limiting, caching, policies) → Functions HTTP trigger → Cosmos DB / Redis / Scrydex API (on cold cache)
- **Shared types:** Imports from `@pcpc/shared`
- **IaC:** 9 Terraform modules in `infra/modules/`
- **CI/CD:** Azure DevOps pipelines with ACR-backed container images for tooling
- **Best for demonstrating:** Enterprise IaC, API gateway expertise, ADO pipeline design, breadth of Azure services, defense/regulated patterns

### Path C: Containerized Functions on Azure Container Apps

- **Source:** Same `backend/functions/` code, packaged as a Docker image
- **Stack:** Azure Functions v4 in container → Azure Container Apps with KEDA autoscaling
- **Runtime location:** Azure subscription, separate from Vercel and from Path B's Functions plan
- **Data path:** Browser → ACA ingress → Functions container → Cosmos DB / Redis / Scrydex API (on cold cache)
- **Shared types:** Imports from `@pcpc/shared`
- **IaC:** New Terraform module `infra/modules/container-app/`, new ACR repository for the application image
- **CI/CD:** New ADO pipeline stage building and deploying the Functions container; reuses existing Terraform plan/apply patterns
- **Best for demonstrating:** Container runtime fluency, KEDA autoscaling, image immutability, FedRAMP/ATO-friendly deployment patterns

### Shared Data Layer

A single Cosmos DB account using the **Scrydex schema** is shared across all three paths. This is the canonical state of the world.

The current divergence (PCPC repo Functions reference PokeData; maber-web/apps/pcpc has migrated to Scrydex) is resolved in Phase 2 by migrating the Functions code to Scrydex before containerization. The `@pcpc/shared` package becomes the single source of truth for the schema, ensuring frontend and backend stay in lockstep going forward.

### Backend Toggle UX

The Vercel-hosted SvelteKit app reads a `?backend=` query parameter (default `vercel`). The UI surfaces a small badge in the corner showing the active backend, response time, and a one-click switcher. Each path has a `/api/health` (or equivalent) endpoint; the toggle UI only enables paths whose healthcheck passes within 2 seconds, so a broken or undeployed path degrades gracefully.

---

## Hero Artifacts

These documents are the *primary* deliverables of this plan. The code already exists. The judgment is what's missing.

### Profile-level

- **`Abernaughty/Abernaughty/README.md`** — GitHub profile README. The "front door" for any recruiter clicking through to the GitHub profile. Frames PCPC as the centerpiece, summarizes the three-path story, lists relevant skills, and links to the live demo.
- **`maber-web/apps/portfolio/`** — A Vercel-deployed portfolio page (`maber.io` or `portfolio.maber.io`) that mirrors the profile README in long form, with embedded architecture diagrams. *Note: the portfolio site itself stays in `maber-web` because it's the web app, not part of the PCPC project.*

### Project-level

- **`PCPC/README.md`** — The main repo README. Recruiter-first ordering: Architecture summary → Live Demo → Three-Path Story → Skills → Quick Start. Becomes the primary landing page for the project.
- **`PCPC/frontend/README.md`** — Frontend-specific quickstart and dev notes.
- **`PCPC/backend/functions/README.md`** — Functions-specific quickstart.
- **`PCPC/infra/README.md`** — Existing IaC documentation, lightly refreshed.

### Decision documents

All ADRs live in **`PCPC/docs/adr/`** and are linked from the main README.

- **ADR-0001: API Architecture Spectrum.** Why three paths exist. The decision tree of when to use which. Becomes the LinkedIn-shareable headline document.
- **ADR-0002: Functions Consumption vs Container Apps.** Cost, cold-start, portability, and operational tradeoffs with real numbers from the deployments.
- **ADR-0003: APIM vs BFF Gateway.** When you need APIM's policy engine vs when SvelteKit's `+server.ts` files are sufficient.
- **ADR-0004 (optional, Phase 3): Path to AKS.** What would change if this needed Kubernetes. Demonstrates the *next* step without building it.

### Comparison artifact

- **`PCPC/docs/architecture-comparison.md`** — The marquee document. Side-by-side table of all three architectures across: request flow, cold start, p50/p99 latency, cost per million requests, deployment time, scaling characteristics, operational surface area, security posture. Includes the headline architecture diagram and a separate data-flow diagram showing how Scrydex feeds Cosmos DB.

---

## Phasing

Each phase ends in a state where the portfolio is strictly better than the start of the phase. Each phase can be the final phase if circumstances change.

Time estimates are given as **hands-on hours** (your actual focused keyboard time) plus a **target calendar pace**. The target is one week to ship all four phases, with two weeks as a conservative buffer for things that take wall-clock time to settle (DNS, Azure resource provisioning, sleep-on-it review of ADRs before publishing). The hands-on hour ranges are generous to allow for the parts that don't compress with AI assistance — debugging, verification, decision-making.

### Phase 0 — Consolidation & Portfolio Surface

**Goal:** Bring all PCPC work into one repo. Make the existing engineering findable. No new infrastructure.

**Scope:**

*Pre-migration audit (~1 hr, gates the migration):*
- Inventory PCPC frontend's imports from `@maber/ui`, `@maber/utils`, `@maber/config`
- Decide per-package: inline into `frontend/src/lib/` (minimal usage) vs copy to `frontend/packages/` as `@pcpc/*` (heavy usage)

*Repo consolidation (~2–4 hrs):*
- Use `git filter-repo` to extract `apps/pcpc/` history from `maber-web` into a temporary repo, renaming the path to `frontend/`
- Merge the filtered history into `PCPC` using `git merge --allow-unrelated-histories` on a feature branch
- Restructure `PCPC/app/backend/` → `PCPC/backend/functions/`
- Create `PCPC/backend/shared/` workspace package (`@pcpc/shared`) with placeholder type exports
- Add `pnpm-workspace.yaml` and root `package.json` defining the workspaces
- Move `.ado/` → `pipelines/ado/` for clarity
- Update import paths in frontend per the audit
- Verify both apps still build and tests still pass
- Tag the pre-consolidation state in both repos for rollback safety
- Update `maber-web` to remove `apps/pcpc/` (keep `landing`, `blackjack`, `portfolio`)

*Portfolio surface (~1–3 hrs):*
- Create `Abernaughty/Abernaughty` profile repo with `README.md`
- Refresh `PCPC/README.md` to be recruiter-first (Architecture → Live Demo → Skills → Quick Start)
- Refresh `maber-web/README.md` to reflect that it's the personal-apps monorepo (not the PCPC home)
- Add a "this app's source has moved" note to `maber-web` README pointing at `Abernaughty/PCPC`
- Initialize `PCPC/docs/adr/` with a README explaining the ADR format
- Save the rendered headline architecture diagram as `PCPC/docs/architecture-diagram.svg`
- Stub out `apps/portfolio/` in `maber-web` (don't deploy yet)

**Definition of done:**
- All PCPC code (frontend + backend + infra + pipelines + docs) lives in `Abernaughty/PCPC`
- `pnpm install && pnpm build` works at the PCPC repo root
- Frontend still deploys to Vercel from its new location (`frontend/`)
- Existing ADO pipelines still run successfully against the new paths
- Git history from both source repos is preserved
- A recruiter clicking `github.com/Abernaughty` sees the profile README and can link to PCPC and the (planned) live demo within 30 seconds
- ADR directory exists with a template

**Hands-on time:** 4–8 hours
**Target calendar pace:** 1–2 days
**Cost impact:** $0
**Reversibility:** High during the work (feature branch, tagged states); low after merge to main (you don't want to undo). Rollback strategy: keep tagged commits on both source repos for 30 days post-merge.

### Phase 1 — Two-Path Live Toggle

**Goal:** Ship the live backend toggle for Paths A and B.

**Scope:**
- Add backend-toggle component to `PCPC/frontend/`
- Provision a custom domain for the existing APIM endpoint (`api.pcpc.maber.io`)
- Configure CORS on APIM to accept requests from `pcpc.maber.io`
- Add a backend abstraction layer in the SvelteKit app so `?backend=vercel|azure` swaps the data fetcher
- Implement healthcheck-driven graceful degradation (toggle UI hides Path B if its `/health` doesn't respond)
- Write ADR-0001 and ADR-0003
- Write `docs/architecture-comparison.md` (two-column version; Path C added in Phase 2)
- Update README with live demo links

**Definition of done:**
- Visiting `pcpc.maber.io` and toggling backends produces real responses from both Vercel and Azure
- ADR-0001 and ADR-0003 exist and are linked from the README
- The architecture comparison doc exists with diagrams and tables for Paths A and B

**Hands-on time:** 5–10 hours
**Target calendar pace:** 1–2 days (DNS propagation can stretch this if the custom domain is new)
**Cost impact:** ~$2–8/month additional for APIM custom domain + estimated recruiter traffic on Functions Consumption
**Reversibility:** High. Toggle defaults to Path A; if Path B breaks, set toggle UI to A-only.

### Phase 2 — ACA Path

**Goal:** Containerize the Functions code and ship Path C.

**Scope:**
- Migrate Functions code in `backend/functions/` from PokeData to Scrydex schema, using `@pcpc/shared` as the canonical type source (one source of truth across all paths)
- Add `Dockerfile` to `backend/functions/` (Functions in container, base image `mcr.microsoft.com/azure-functions/node:4-node22`)
- Create new Terraform module `infra/modules/container-app/`
- Add new environment configuration for ACA in `infra/envs/`
- Add new ADO pipeline stage for ACA image build + deploy
- Provision ACA app, configure ingress, add `aca.pcpc.maber.io` custom domain
- Wire `?backend=aca` into the toggle, including healthcheck integration
- Write ADR-0002 (Functions Consumption vs ACA)
- Update `docs/architecture-comparison.md` to three columns

**Definition of done:**
- All three paths respond to live requests from `pcpc.maber.io`
- All three paths read from the same Cosmos DB with the same Scrydex schema
- All three paths share types via `@pcpc/shared`
- ADR-0002 published; comparison doc shows three columns
- ACA deployment is fully automated via the ADO pipeline

**Hands-on time:** 8–15 hours
**Target calendar pace:** 2–4 days. The Scrydex schema migration is the wildcard: the existing Functions use PokeData, the data model differs meaningfully, and "delete the old, wire up the new" almost always surfaces edge cases. If schema migration is rougher than expected, the fallback is shipping ACA against the current schema first and migrating later (see Risks).
**Cost impact:** ~$5–15/month additional (ACA min replicas = 1 to avoid cold-start in demos; can drop to min = 0 to save ~$5/month at the cost of 1–3s cold start)
**Reversibility:** Medium. New module and pipeline stage are additive. Toggle gracefully hides Path C if ACA is unhealthy.

### Phase 3 — Polish & Distribution

**Goal:** Make this portfolio actively work for the job search.

**Scope:**
- Write ADR-0004 (Path to AKS) — speculative document explaining the next architectural step
- Deploy `apps/portfolio/` (in `maber-web`) to `maber.io` or `portfolio.maber.io`
- Generate static architecture diagram images (SVG → PNG) for LinkedIn embedding
- Draft and publish a LinkedIn post linking to the comparison doc
- Update resume bullets to reflect the three-path framing
- Add the live demo URL and comparison doc to active job applications
- Optional: revisit the GitHub Actions question — if a multi-CI talking point would strengthen the comparison, add a frontend GitHub Actions workflow now

**Definition of done:**
- Portfolio site is live
- LinkedIn post is published with at least one architecture diagram
- Resume reflects the new framing
- The portfolio is referenced in at least one new job application

**Hands-on time:** 3–6 hours
**Target calendar pace:** 1–2 days
**Cost impact:** $0 (Vercel free tier covers the portfolio site)
**Reversibility:** Trivial.

### Total

| Dimension | Estimate |
|---|---|
| **Hands-on time** | 20–40 hours |
| **Target calendar pace** | ~1 week (5–10 days) |
| **Conservative calendar** | ~2 weeks (covers DNS, Azure provisioning, schema migration surprises) |
| **Total monthly cost at full deployment** | ~$10–25 |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `git filter-repo` migration breaks something subtle (paths, hooks, lockfiles) | Medium | Medium | Do the consolidation on a feature branch with both source repos tagged for rollback. Verify build, tests, and Vercel deployment before merging to main. Keep `maber-web/apps/pcpc/` archived (not deleted) until consolidation is proven stable for at least 2 weeks. |
| Shared `@maber/*` packages break PCPC frontend after extraction | Medium | Medium | Pre-migration audit (in Phase 0) inventories actual usage before any code moves. For minimal usage, inline into `frontend/src/lib/`. For heavier usage, copy the relevant packages into `frontend/packages/` as `@pcpc/*`. |
| Vercel deployment breaks after path change (`apps/pcpc` → `frontend`) | Medium | Low | Update Vercel project root directory setting before merge. Test deployment from the feature branch via Vercel preview. Vercel project settings change is reversible. |
| ADO pipelines break after path restructure (`.ado/` → `pipelines/ado/`, `app/backend` → `backend/functions/`) | High | Medium | Update pipeline path filters and triggers as part of the consolidation commit. Run a PR pipeline before merging to main. Pipeline YAML changes are git-tracked and reversible. |
| Job search lands a role mid-project; portfolio work pauses | Medium | Low | Phase 0 alone improves discoverability significantly. Each phase ships a complete state. Pausing after any phase is acceptable. |
| Schema migration in Phase 2 is harder than expected | Medium | Medium | The Scrydex pattern already exists in the migrated frontend. Worst case, scope Phase 2 down: ship ACA against current PokeData schema first, migrate later. Document the divergence honestly. |
| ACA cold start (1–3s) makes recruiter demos look slow | High (if min replicas = 0) | Medium | Default to min replicas = 1 (~$5/month). Optionally show a "warming up..." UI state and frame it as a portfolio positive. |
| Three-path toggle UX gets confusing | Medium | Medium | The default is always Path A (Vercel). Toggle is opt-in via URL param or a small UI control. Recruiter who doesn't toggle gets a normal app experience. |
| ADR documents become stale | Low | Low | ADRs are dated and immutable by convention. New decisions become new ADRs. Stale ADRs are still valuable as a record of past thinking. |
| Cost runs over expectations | Low | Low | Total projected cost across all three paths is < $25/month. Set Azure budget alerts at $30. |
| Repo links break (rename, move) | Low | High | Use canonical URLs (`pcpc.maber.io`, `maber.io`) rather than `*.vercel.app` URLs throughout the docs. After consolidation, add a `maber-web` README note pointing pcpc traffic to the new home. |

---

## Success Metrics

This is a portfolio, so traditional product metrics don't apply. The success metrics are:

- **Phase 0 done:** All PCPC work lives in one repo. A recruiter who has never seen the portfolio can describe what it is after 60 seconds of skimming.
- **Phase 1 done:** A recruiter clicks the live demo and toggles between architectures without instructions.
- **Phase 2 done:** The architecture comparison doc gets shared once on LinkedIn or referenced in one technical interview.
- **Phase 3 done:** At least one recruiter conversation cites the portfolio specifically.
- **Lagging indicator:** Interview pipeline conversion rate improves measurably between pre-Phase-0 and post-Phase-3.

---

## Open Questions

These are deferred and tracked here for resolution at or before the relevant phase.

1. **`@maber/*` package handling during migration.** Resolved by the Phase 0 audit task: inline into `frontend/src/lib/` for minimal usage; copy as `@pcpc/*` packages for heavy usage. Audit happens before the merge step.
2. **Whether to introduce Turbo at the PCPC repo root.** pnpm workspaces alone are sufficient for the current shape; Turbo adds task orchestration that may or may not be worth the config. Decision: defer until Phase 0 reveals whether root-level scripts feel awkward.
3. **Portfolio site domain.** `maber.io` (root) vs `portfolio.maber.io` (subdomain)? Decision needed before Phase 3.
4. ~~**Custom domains for backends.** `api.pcpc.maber.io` and `aca.pcpc.maber.io` are placeholders. Final names TBD before Phase 1.~~ **Resolved 2026-05-06:** per-env scheme `dev-api.pcpc.maber.io`, `staging-api.pcpc.maber.io`, `api.pcpc.maber.io`. **Currently DEFERRED** per ADR-012 (Azure-managed cert creation suspended Aug 15 2025 → Jun 30 2026); IaC scaffolding in place, restoration runbook in ADR-012.
5. ~~**Legacy Svelte 4 SPA in PCPC.** Retire it during Phase 0 consolidation, archive it under a tag, or keep it as a historical reference frontend?~~ **Resolved 2026-05-06:** archived at the `phase-0/legacy-spa-archive` tag and removed from main alongside the SWA deploy stage and validate-frontend PR pipeline. The Azure Static Web App resource and its Terraform module are left intact for separate deprovisioning when convenient.
6. ~~**APIM custom domain SSL.** Free Azure-managed cert vs Let's Encrypt vs purchased cert? Decision needed in Phase 1.~~ **Resolved 2026-05-06:** Azure-managed cert. **Currently DEFERRED** per ADR-012 — Microsoft suspended new managed cert creation through at least June 2026. See ADR-012 for the deferral rationale and the restoration runbook.
7. ~~**ACA min replicas.** 0 (cold start, save $5/month) vs 1 (always warm, better demo)?~~ **Resolved 2026-05-12 (Phase 2.2 PR-1):** min_replicas = 1 in dev. Rationale: the frontend's 2-second `probeHealth` timeout at [`frontend/src/lib/backends/health.ts`](../frontend/src/lib/backends/health.ts) is shorter than ACA's 1–3s cold-start at min=0, so min=0 would falsely degrade Path C after every idle period and hide it from the toggle. Cost envelope ~$5–15/mo per env documented in [ADR-009](./adr/ADR-009-functions-consumption-vs-container-apps.md).
8. **`maber-web` repo fate.** After PCPC consolidation, `maber-web` becomes a 3-app monorepo (landing, blackjack, portfolio). Keep as-is, rename to reflect new scope, or eventually retire? Decision: keep as-is; revisit if/when the other apps are also reorganized.
9. **GitHub Actions revisit in Phase 3.** Whether adding a frontend GitHub Actions workflow strengthens the comparison narrative enough to justify the duplication with Vercel's PR builds. Decision deferred to Phase 3 evaluation.

---

## Tracking

This spec lives at `PCPC/docs/PORTFOLIO_PLAN.md` and is the canonical reference for this work. Updates happen as phases complete.

A copy is also kept at `maber-web/docs/PORTFOLIO_PLAN.md` (or linked from `maber-web/README.md`) for the brief period during which both repos are relevant. Once consolidation is complete and stable, the `maber-web` copy is removed and replaced with a README pointer to the canonical PCPC version.

Phase tracking will use GitHub Issues in the `PCPC` repo, one issue per phase, with subtasks as a checklist. Issues link back to this spec.

ADRs are tracked at `PCPC/docs/adr/` with sequential numbering.

---

## Appendix: Skills Demonstrated by Path

| Skill | Path A (Vercel BFF) | Path B (APIM+Functions) | Path C (ACA) |
|---|---|---|---|
| SvelteKit / Svelte 5 | ✅ | — | — |
| pnpm workspaces (intra-project monorepo) | ✅ | ✅ | ✅ |
| Tailwind CSS v4 | ✅ | — | — |
| Edge runtime / SSR | ✅ | — | — |
| Vercel deployment | ✅ | — | — |
| Azure API Management | — | ✅ | — |
| Azure Functions v4 | — | ✅ | ✅ |
| Azure Container Apps | — | — | ✅ |
| KEDA autoscaling | — | — | ✅ |
| Container image immutability | — | — | ✅ |
| Terraform (multi-module) | — | ✅ | ✅ |
| Azure DevOps pipelines | — | ✅ | ✅ |
| ACR (registry + CI tooling) | — | ✅ | ✅ |
| Cosmos DB | ✅ | ✅ | ✅ |
| Redis caching | ✅ | ✅ | ✅ |
| Key Vault / managed identity | — | ✅ | ✅ |
| Application Insights / Log Analytics | — | ✅ | ✅ |
| Shared TypeScript types across runtimes | ✅ | ✅ | ✅ |
| ADR-driven architectural design | ✅ | ✅ | ✅ |
| Repository consolidation / git filter-repo | — | — | — *(repo-level skill)* |

The portfolio as a whole demonstrates the union of every cell with a checkmark, plus the repo-level skill of repository consolidation. No single path alone covers the spectrum; the *combination* is the point.
