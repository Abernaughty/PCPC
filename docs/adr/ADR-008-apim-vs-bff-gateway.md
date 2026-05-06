# ADR-008: APIM vs SvelteKit BFF as Gateway

## Status

Accepted

Date: 2026-05-06

## Context

PCPC's three-path architecture (see
[ADR-007](./ADR-007-api-architecture-spectrum.md)) places two different kinds
of API gateway in front of the same Cosmos data layer:

- **Path A (Vercel BFF)** uses SvelteKit `+server.ts` routes co-deployed
  with the frontend on Vercel. The "gateway" is just the SvelteKit app — no
  separate gateway product, no separate runtime, no separate IaC.
- **Path B (APIM + Functions)** uses Azure API Management (Consumption tier)
  in front of Azure Functions v4 on a Consumption plan. APIM is a dedicated
  API gateway product with its own policy engine, subscription model, and
  developer portal.

The decision is not "which gateway is better" — both are correct in their
respective contexts. The decision is **why both exist in the same project,
and when each pattern is the right call.** The portfolio narrative needs an
explicit answer to that question because recruiters from different
backgrounds will reach for different defaults.

This ADR is intentionally narrower than ADR-007. ADR-007 explains why three
deployment paths exist at all. This ADR explains the gateway-shaped tradeoff
between two of them.

## Decision

**Keep both gateway patterns. Use APIM when the policy/governance/discovery
surface earns its operational weight; use the BFF pattern when it does not.
The PCPC frontend treats them as interchangeable through the
`BackendDefinition` abstraction, so the gateway choice never leaks into
application code.**

The decision rule, written for future selves and for portfolio readers:

| Choose APIM when… | Choose SvelteKit BFF when… |
|---|---|
| Multiple consumers (other apps, partner integrations, mobile clients) need stable contracts | Single frontend is the only consumer |
| Rate limiting, quota, or subscription billing is a real requirement | Rate limiting can live at the CDN edge or in app code |
| API discovery via developer portal has business value (FedRAMP/GovCloud, partner ecosystems) | No external API consumers |
| Policy-engine concerns (request transformation, JWT validation, IP filtering) are best expressed declaratively at the gateway | Authn/authz is straightforward and lives near the app code |
| Backend services are heterogeneous (multiple Functions apps, AKS services, external APIs) and benefit from a single front door | Backend is a single unit deployed alongside the frontend |
| Operations team owns the gateway as a separate concern from the application teams | Application team owns the entire stack |

## Consequences

### Positive

- **Honest about the tradeoff.** The codebase shows both patterns working,
  not just claims they exist. A reader can run both, observe the latency
  difference, and form their own opinion.
- **Architectural fluency demonstrated.** Senior+ engineers are expected to
  know that APIM is correct in some contexts and overkill in others. Showing
  both shipped patterns in one repo is the strongest possible
  demonstration of that fluency.
- **No gateway lock-in for the application code.** The
  `BackendDefinition` abstraction in `frontend/src/lib/backends/` makes the
  gateway choice a runtime concern. The frontend has no `if (apim) ... else`
  branches; it calls `backendStore.active.fetcher.fetch(canonicalPath)` and
  the active definition handles the rest. This is the same shape of
  abstraction that real-world teams build when they need to swap gateways
  during a migration.
- **Realistic latency cost is visible.** APIM Consumption adds ~80–150ms of
  cold-start overhead on the gateway hop (Functions cold starts add more on
  top). The BFF path has none of that overhead because the "gateway" is the
  same process serving the page. The toggle's latency badge surfaces the
  cost in real numbers, which is more useful than abstract claims.
- **Failure isolation is explicit.** A bug in the BFF brings the page down.
  A bug in APIM brings the gateway down for all consumers. The pattern
  choice is a failure-domain choice, and demonstrating both makes that
  visible.

### Negative

- **Two operational surfaces.** APIM requires its own Terraform module,
  policy authoring (XML), named values, backends, and product/subscription
  configuration. The BFF path requires none of that. Maintaining both means
  paying both bills (operational and cognitive).
- **APIM Consumption tier limits.** Consumption tier does not support
  caching policies, virtual networks, or some advanced policies. For PCPC
  (a portfolio), Consumption is right because Standard/Premium would cost
  10–100× more for zero portfolio benefit. But the limitation is real and
  is part of the honest comparison.
- **Latency penalty for the demonstration path.** Path B is, on every
  request, slower than Path A by at least one extra network hop (frontend →
  APIM → Functions). For a real product where Path B is the only path, that
  hop is justified by what APIM provides; for a portfolio where Path A is
  the canonical experience, the hop is purely demonstrative.
- **Default-path bias.** Because Path A is the default, casual visitors
  never engage with Path B unless they discover the toggle. The "live
  demonstration" benefit only materializes if visitors interact. Mitigated
  by the visible corner badge and the architecture-comparison doc that
  invites the toggle explicitly.

## Alternatives Considered

### Option 1: APIM in front of everything (including Path A)

- **Pros**: Single gateway model; consistent rate-limiting/policy story;
  could legitimately argue "this is how the enterprise version of the
  product would look."
- **Cons**: Adds ~100ms+ to every Path A request for no application benefit;
  defeats the *contrast* between the two patterns; makes Path A's "edge
  runtime, no separate gateway" story untellable.
- **Reason for rejection**: The contrast is the point. APIM-everywhere
  collapses the comparison into a single shape and loses the architectural
  spectrum.

### Option 2: BFF only, drop APIM entirely

- **Pros**: Simpler operational surface; lower cost; the BFF pattern is
  fashionable and well-understood.
- **Cons**: Removes the entire enterprise/regulated-industry story from the
  portfolio; fails the audience-flexibility goal in
  [`docs/PORTFOLIO_PLAN.md`](../PORTFOLIO_PLAN.md); APIM is exactly the
  kind of artifact defense and regulated-industry recruiters look for.
- **Reason for rejection**: Audience flexibility is a stated goal. Dropping
  APIM optimizes for the modern-startup audience at the cost of every other
  audience.

### Option 3: API Gateway product other than APIM (e.g. AWS API Gateway, Kong, Tyk)

- **Pros**: Could argue cross-cloud fluency; Kong/Tyk are popular in
  modern stacks.
- **Cons**: Splits the Azure story; introduces a non-Azure dependency for
  reasons unrelated to the comparison being made; the rest of the
  enterprise stack (Cosmos, Functions, ACA, App Insights) is Azure.
- **Reason for rejection**: Cross-cloud comparison is not what this project
  is about. The comparison is *patterns within one cloud*, not *across
  clouds*. Adding a non-Azure gateway would be noise.

### Option 4: A custom gateway service (e.g. an Express/Fastify proxy)

- **Pros**: Full control; cheap to run; could implement exactly the
  policies needed.
- **Cons**: Reinvents what APIM/Kong/Tyk already do; loses the
  "off-the-shelf gateway product" demonstration that recruiters look for;
  adds another runtime to operate.
- **Reason for rejection**: The portfolio value of APIM is precisely that
  it is the off-the-shelf option an enterprise team would actually choose.
  A custom proxy would be cheaper to build but less legible as a portfolio
  artifact.

## Implementation Notes

- The frontend abstraction lives at
  [`frontend/src/lib/backends/`](../../frontend/src/lib/backends/). Each
  path is a `BackendDefinition` with a `fetcher` that hides the gateway
  shape from the rest of the app.
- The APIM configuration lives at [`apim/`](../../apim/) and is deployed
  via Terraform from [`apim/terraform/`](../../apim/terraform/).
- The BFF routes live at
  [`frontend/src/routes/api/`](../../frontend/src/routes/api/) and deploy
  to Vercel automatically on push to `main`.
- During Phase 1, Path B's responses are reshaped on the frontend by the
  `pokedata-to-scrydex` adapter because the Functions code is still on the
  legacy schema. This adapter is removed in Phase 2 along with the Functions
  schema migration. The adapter is intentionally narrow — it bridges
  request/response shape only; it does not paper over functional gaps
  (e.g. PokeData has no per-variant pricing, so Path B card detail returns
  empty variants and the UI degrades to "no pricing available"). The
  toggle UX surfaces this honestly rather than hiding it.
- Custom domains for Path B are provisioned separately in Phase 1B,
  per-environment: `dev-api.pcpc.maber.io`, `staging-api.pcpc.maber.io`,
  and `api.pcpc.maber.io` (prod). DNS records (validation + CNAME) are
  added manually in Cloudflare; APIM's hostname binding + Azure-managed
  cert are managed via Terraform.

## Related Decisions

- [ADR-007: API Architecture Spectrum](./ADR-007-api-architecture-spectrum.md)
- ADR-009: Functions Consumption vs Container Apps *(planned, Phase 2)*
- [ADR-006: API Integration Strategy](./ADR-006-api-integration-strategy.md)
