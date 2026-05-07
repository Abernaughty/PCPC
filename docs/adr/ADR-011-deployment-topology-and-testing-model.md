# ADR-011: Deployment Topology and Testing Model

## Status

Accepted

Date: 2026-05-06

## Context

PCPC has three Azure environments — dev, staging, and prod — each with its
own resource group, APIM service, Function App, Cosmos DB, storage account,
Key Vault, App Insights, and Log Analytics workspace. The CD pipeline at
`pipelines/ado/azure-pipelines.yml` is a single multi-stage pipeline:
**Build → Deploy_Dev (auto) → Deploy_Staging (manual approval) →
Deploy_Prod (manual approval)**.

The three environments are not cosmetic copies. They differ in ways that
reflect distinct operational postures:

| | Dev | Staging | Prod |
|---|---|---|---|
| Storage replication | LRS | GRS | GRS |
| Cosmos failover | off | on | on |
| Log Analytics retention | 30 d | 90 d | 365 d |
| App Insights sampling | 100% | 50% | 10% |
| App Insights daily cap | 1 GB | 5 GB | 100 GB |
| Alert thresholds | 10 fails | 10 fails | 5 fails (stricter) |
| Terraform safety | none | none | `prevent_deletion_if_contains_resources` |
| Key Vault on destroy | purge | purge | keep (`purge_soft_delete_on_destroy = false`) |
| APIM CORS (Phase 1B) | `*` | `https://pcpc.maber.io` | `https://pcpc.maber.io` |
| Custom hostname (Phase 1B) | `dev-api.pcpc.maber.io` | `staging-api.pcpc.maber.io` | `api.pcpc.maber.io` |

Despite all that engineering, no ADR existed explaining *why* three
environments. The shape was inherited convention, not a documented
decision. That gap is the problem this ADR resolves.

A second issue surfaced during Phase 1B planning: the frontend is a single
Vercel deployment at `pcpc.maber.io` with three Vercel scopes (Production,
Preview, Development). With one Vercel deployment and three Azure backends,
how does staging get tested? It doesn't have a corresponding frontend URL,
so a naive "you visit staging at staging.pcpc.maber.io" model isn't
available. Either staging needs a separate Vercel deployment (operationally
heavy for one developer), or staging needs a different testing model than
dev and prod.

A third question — was three environments financially justifiable? — was
investigated and resolved during planning. At Consumption-tier SKUs and
portfolio traffic, the all-three total runs roughly $6–45/month, which sits
inside the project's stated $10–25/month target when traffic is low. Cost
is not the deciding factor; the testing model is.

## Decision

**Keep all three Azure environments (dev/staging/prod) and define
their testing layers explicitly.**

The three environments serve three distinct purposes, mapped to three
testing layers:

### Layer 1 — Infrastructure / API validation (staging's actual job)

Each environment has its own ADO stage that runs:
- `terraform validate` and `terraform plan`
- `terraform apply` (gated by manual approval for staging and prod)
- Smoke tests (curl-based) directly against the env's APIM hostname

**Staging is the gate that catches IaC and API regressions before prod.**
Promotion is gated by manual approval in ADO. The gate's value is "the
Terraform plan applied cleanly + the smoke tests passed against the
staging APIM," not "an engineer dogfooded staging in a browser." This is
why staging is worth keeping despite having no frontend consumer.

### Layer 2 — Frontend integration testing

The Vercel deployment uses Vercel's three scopes to map cleanly onto the
backend environments:

| Vercel scope | Where it applies | `PUBLIC_AZURE_API_BASE_URL` |
|---|---|---|
| Production | `pcpc.maber.io` (live demo) | `https://api.pcpc.maber.io` |
| Preview | every PR's `*.vercel.app` URL | `https://dev-api.pcpc.maber.io` |
| Development | `vercel dev` locally | `https://dev-api.pcpc.maber.io` |

PR previews exercise the dev backend; the production deploy exercises the
prod backend. **Staging APIM is intentionally not mapped to any Vercel
scope.** It has no frontend consumer by design.

### Layer 3 — On-demand env switching from the live site

Out of scope for Phase 1. Could be added later by extending
`BackendToggle` (see [ADR-007](./ADR-007-api-architecture-spectrum.md))
with a `?apiBase=<url>` URL-param override (~30 LOC). Not pursued now
because Layer 1 + Layer 2 covers actual portfolio needs and adding Layer 3
without a concrete use case would be feature creep.

## Consequences

### Positive

- **Honest staging.** Staging's purpose is well-scoped: catch infra and API
  regressions before prod via CI smoke tests. It's not pretending to be a
  browser-testing environment, and the lack of a frontend mapping is a
  feature, not a gap.
- **Real promotion gate.** Manual approval between dev → staging → prod is
  a meaningful demonstration of enterprise CD discipline, not theatre.
- **Audience-flexibility goal preserved.** Three envs read as enterprise
  IaC competence; the clean per-env divergence (retention, sampling,
  alerts, safety flags) shows the engineer understands *why* envs differ,
  not just *that* they should. The decision-doc-explaining-the-choice is
  itself a senior signal.
- **Within budget.** Three envs at portfolio traffic stay within the
  $10–25/month target documented in `docs/PORTFOLIO_PLAN.md`. No financial
  pressure to simplify.
- **Cleanly composable with Vercel scopes.** The Vercel
  Production/Preview/Development model maps onto two of the three Azure
  envs (prod ← Production, dev ← Preview/Development) without contortion.
- **Easy to evolve.** If a Layer 3 need ever materializes (e.g. adding
  manual browser regression against staging), it's a small addition to
  `BackendToggle`, not a rework.

### Negative

- **Three Cloudflare CNAMEs to manage manually.** `dev-api`, `staging-api`,
  and `api`, each as DNS-only records. The maintenance burden is small
  (set once) but real.
- **Two manual approval gates per release.** Staging then prod. For a
  one-developer project, this is also two manual clicks. Acceptable but
  worth noting.
- **Staging is never browser-tested by default.** Engineers must trust
  pipeline smoke tests for staging. If a frontend regression shows up only
  against staging-shaped data, it won't be caught until prod. Mitigated by
  Path B serving the same Cosmos data across all three envs (no per-env
  data divergence).
- **No "easy" way to point the live site at staging for ad-hoc browser
  testing without redeploying with a different env var.** This is the
  Layer 3 gap. Acceptable for now; Layer 3 work documented as a future
  enhancement.

## Alternatives Considered

### Option A — Drop staging; use dev + prod only

- **Pros:** Half the operational surface; only two CNAMEs and one approval
  gate per release; cleaner repo (delete staging Terraform code, env
  config, and pipeline stage); ~$4–30/month vs ~$6–45/month.
- **Cons:** Loses the explicit pre-prod gate that staging provides. Any
  IaC or API regression goes straight to prod after dev passes. The
  enterprise multi-env IaC story shrinks. Reverting to three envs later
  is not free — staging would need to be re-introduced from scratch.
- **Reason for rejection:** The marginal cost of staging is low (one extra
  pipeline stage, one CNAME, one approval click), and the value of having
  a real promotion gate before prod is worth more in the portfolio
  narrative than the operational simplification is worth in actual ops
  effort.

### Option B — Single environment (rename dev → "live")

- **Pros:** Most aggressive simplification. One Azure env serving the
  live demo. One CNAME. Cheapest possible footprint (~$2–15/month).
- **Cons:** Demolishes the multi-env IaC demonstration almost entirely.
  Loses both the dev-vs-prod separation and the promotion-gate story.
  Sends a signal that the engineer doesn't understand or can't
  operationalize multi-env patterns — the opposite of what the portfolio
  is trying to demonstrate. A real production deploy with no separate
  dev environment is amateur, not pragmatic.
- **Reason for rejection:** Audience-flexibility goal is explicitly
  stated in `docs/PORTFOLIO_PLAN.md`. Single-env collapses the enterprise
  audience entirely.

### Option C — Per-env Vercel deployments matching per-env APIMs

- **Pros:** Closest to "real enterprise product" shape. Each frontend
  env hits its matching backend env. Browser-level testing of all three
  envs is trivial.
- **Cons:** Operationally heavy for one developer (three Vercel projects,
  three production domains, possibly per-env git branches with branch
  protection). Loses the "one URL, swap at runtime" headline UX that's
  the centerpiece of [ADR-007](./ADR-007-api-architecture-spectrum.md).
  The multi-Vercel pattern doesn't match the portfolio's single-frontend
  thesis.
- **Reason for rejection:** Conflicts with ADR-007's explicit choice of
  one URL with a runtime backend toggle. Adopting Option C would require
  retracting that decision.

### Option D — Extend BackendToggle with `?apiBase=<url>` URL override

- **Pros:** Lets any Vercel deploy point at any backend env via URL
  parameter. Most composable, ~30 LOC. Strongest "the toggle is a
  general-purpose backend probe" portfolio story.
- **Cons:** Adds a runtime feature with no concrete current use case.
  The `?backend=` parameter already lets visitors swap between Vercel
  BFF and Azure APIM; this would add the ability to point at *which*
  Azure APIM, but the only consumer is "an engineer manually testing
  staging from the prod URL," which can be solved by visiting the
  staging API directly with curl/Postman.
- **Reason for rejection (for now):** No concrete current need. Flagged
  as a future Layer 3 enhancement if the use case materializes.

## Implementation Notes

This ADR codifies the existing topology rather than introducing it. The
three-environment Terraform structure already existed in
`infra/envs/{dev,staging,prod}/` and `apim/environments/{dev,staging,prod}/`
before this ADR was written. The ADO pipeline at
`pipelines/ado/azure-pipelines.yml` already implemented the
Build → Dev → Staging → Prod sequence with manual approval gates.

What Phase 1B adds on top of that pre-existing structure:
- Custom hostnames per env (`dev-api`, `staging-api`, `api`) via the new
  `gateway_hostnames` variable on the api-management module
- CORS retarget per env (dev=`*`, staging/prod=`https://pcpc.maber.io`)
- `/health` exposure through APIM so the BackendToggle's healthcheck can
  probe Path B without bypassing the gateway

The Vercel env var mapping (Production → prod APIM, Preview → dev APIM,
Development → dev APIM) is documented in the Phase 1B PR body and in
`docs/architecture-comparison.md`. It is operator-managed (set in Vercel
project settings), not Terraform-managed.

## Related Decisions

- [ADR-007: API Architecture Spectrum (three paths)](./ADR-007-api-architecture-spectrum.md)
- [ADR-008: APIM vs SvelteKit BFF as Gateway](./ADR-008-apim-vs-bff-gateway.md)
- ADR-009: Functions Consumption vs Container Apps *(planned, Phase 2)*
- ADR-010: Path to AKS *(planned, Phase 3, optional)*
