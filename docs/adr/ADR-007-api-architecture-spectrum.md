# ADR-007: API Architecture Spectrum (Three Paths)

## Status

Accepted

Date: 2026-05-06

## Context

PCPC is a single product (Pokémon card pricing) but is being deployed three
ways from one repository to demonstrate architectural range across modern-edge,
enterprise-cloud, and managed-container patterns. The motivation is documented
in the project plan: the project is a portfolio
artifact, and recruiters evaluate fit across audiences (defense/regulated,
enterprise mid-market, modern startup) whose architectural vocabulary differs.
A single deployed shape forces the reader to imagine the others. Three live
shapes let the reader compare directly.

The product itself is not the artifact. The architectural reasoning behind
deploying it three ways is the artifact, and this ADR is the front door to
that reasoning.

The three paths are:

- **Path A — Vercel BFF.** SvelteKit `+server.ts` routes co-deployed with the
  frontend on Vercel. This is the canonical product experience.
- **Path B — APIM + Functions.** Azure API Management (Consumption) routing
  to Azure Functions v4. This is the enterprise/regulated shape.
- **Path C — ACA Container.** Same Functions code as Path B, packaged as a
  container, deployed to Azure Container Apps with KEDA autoscaling. This is
  the managed-container shape. Ships in Phase 2.

A single SvelteKit frontend at `pcpc.maber.io` serves all three. A
`?backend=vercel|azure|aca` query parameter selects which path is called for
data fetching. A small corner badge surfaces the current selection and lets
visitors switch with one click. Each path's own healthcheck determines whether
its toggle option is enabled, so a broken or undeployed path degrades
gracefully out of the UI rather than producing user-visible errors.

All three paths share a single Cosmos DB account using the Scrydex schema, and
all three share TypeScript types via `@pcpc/shared`. There is no per-path data
divergence by design; the comparison is purely about the *runtime* and
*operational surface* in front of the same data.

## Decision

**Ship the same product three ways from one repository, with a runtime
backend toggle on the frontend, and document the architectural tradeoffs as
the primary deliverable.**

The decision has four components:

### 1. Three deployment paths, not two

Two paths (Vercel BFF vs APIM + Functions) is enough to make a comparison
*statement* — modern edge vs enterprise cloud — but it is not enough to make
a comparison *spectrum*. The third path (ACA container) is the inflection
point that turns "two endpoints" into "three positions on a continuum" — the
container path lets us argue about portability, image immutability, KEDA
autoscaling, and the FedRAMP-friendly deployment model in the same breath as
the other two.

The marginal engineering cost of Path C is small (the Functions code is reused
verbatim; only packaging and IaC change). The marginal narrative value is
large.

### 2. Single user-facing URL, runtime path selection

There is exactly one URL to know: `pcpc.maber.io`. Recruiters do not need to
follow a different link for each architecture. The `?backend=` query parameter
plus the corner badge let a visitor switch paths in place and observe the
*same UI* responding from a *different runtime*. This is more legible than
three separate deployments at three URLs.

The toggle defaults to Path A, so a recruiter who never engages the toggle
gets a normal, fast, unbroken app experience. The toggle is opt-in.

### 3. Frontend abstraction over the path differences

Each backend path is represented by a `BackendDefinition` (see
`frontend/src/lib/backends/`). Each definition exposes a `fetcher` that
accepts the canonical Scrydex-shape path the frontend produces and is
responsible for translating to its own backend's URL and reshaping responses
back to the canonical envelope.

Consequence: every consumer in the frontend (stores, services, components)
calls `api.getSets()` etc. without knowing which backend will handle the
request. Adding Path C in Phase 2 is a single new `BackendDefinition`
registration; nothing else changes.

### 4. Healthcheck-driven graceful degradation

Each path exposes `/health` (Path A through SvelteKit, Path B through APIM →
Functions, Path C through ACA ingress). The frontend probes each path on
mount and on a 60-second poll. A path whose healthcheck does not return
healthy or degraded within 2 seconds is dimmed in the toggle and cannot be
selected. If the active path goes unhealthy mid-session, the frontend
automatically reverts to the default (Path A).

This means partial deployments are non-breaking. Path B can be down for
maintenance, Path C can be undeployed entirely, and the recruiter still gets
a working product — the toggle just shows fewer options.

## Consequences

### Positive

- **Architectural legibility.** A recruiter can demonstrate the toggle in a
  60-second screen share and *see* the comparison rather than read about it.
  The artifact is operational, not just documented.
- **Audience flexibility.** Defense/regulated recruiters see APIM, Terraform,
  ADO pipelines, container immutability. Modern startup recruiters see edge
  SSR, serverless functions, monorepo type sharing. Both audiences see the
  *same code* deployed differently — the implication is that the engineer
  understands *when* to use *which*.
- **Atomic schema evolution.** Because all three paths share `@pcpc/shared`,
  a schema change is one commit across one repo. There is no
  out-of-band coordination between projects.
- **Resilient demo.** Healthcheck-driven degradation means a partial outage
  on any path never breaks the user-facing demo. The toggle shrinks; the
  product keeps working.
- **Cheap to maintain.** All paths share the same Cosmos data layer, so there
  is no data divergence to manage. Total monthly cost across all three paths
  at full deployment is projected at ~$10–25.

### Negative

- **Three deployments to monitor.** Each path is real infrastructure with
  real failure modes. Path A is monitored through Vercel; Paths B and C
  through Application Insights. This is more operational surface than a
  single-deployment architecture.
- **Schema parity is a soft constraint.** During Phase 1, Path B serves
  PokeData-shape data (the legacy schema) while the frontend expects
  Scrydex-shape data. A temporary translation adapter in
  `$lib/backends/adapters/pokedata-to-scrydex.ts` bridges the gap. The
  adapter is removed in Phase 2 when Functions migrate to Scrydex. Until
  then, Path B's card pricing renders as "no pricing available" — an
  acknowledged Phase 1 limitation, surfaced through the toggle UX.
- **Cognitive overhead for casual readers.** Three architectures requires
  more attention than one. The default-to-Path-A behavior protects against
  this — a casual visitor never has to know about the toggle — but anyone
  evaluating the portfolio depth has to engage with three boxes instead of
  one.
- **Phase coupling.** Path C requires the Functions schema migration to land
  first (Phase 2), which is the largest single piece of work in the plan.
  Phasing risk is real and explicitly tracked in the project plan.

## Alternatives Considered

### Option 1: Single-path deployment (status quo, pre-Phase-1)

- **Pros**: Lower operational surface; lower cost; simpler README.
- **Cons**: The architectural comparison can only be *described*, not
  *demonstrated*. The recruiter has to take the engineer's word that they
  understand multiple deployment patterns.
- **Reason for rejection**: The product is a portfolio artifact. A
  description-only comparison loses the demonstration value that a runtime
  toggle provides. The marginal engineering cost of adding Path B and Path C
  is small relative to the narrative value gained.

### Option 2: Three separate deployments at three URLs

- **Pros**: Clean separation; no toggle UX to design; each deployment can
  evolve independently.
- **Cons**: Forces the visitor to context-switch between URLs; loses the
  "same UI, different runtime" observability that makes the comparison
  visceral; requires three distinct frontend deployments instead of one.
- **Reason for rejection**: The point of the comparison is the *runtime
  swap*. Three URLs hide that. One URL with a toggle makes it the headline
  feature.

### Option 3: Two paths only (Path A and Path B), defer Path C indefinitely

- **Pros**: Smaller scope; ships faster; no Functions schema migration on
  the critical path.
- **Cons**: Two paths is a *binary*, not a *spectrum*. The container path is
  what makes the story about *positions* (modern edge → managed
  container → enterprise cloud) rather than just two opposing endpoints.
- **Reason for rejection**: Phase 1 ships exactly this (two paths) as an
  intentional first-mile state, but Phase 2 adding Path C is the artifact's
  thesis and is not deferrable in the plan.

### Option 4: Server-side path selection (different paths for different visitors)

- **Pros**: Allows A/B-style segmentation; could route some traffic to Path B
  to demonstrate it under load.
- **Cons**: Hides the architectural choice from the visitor; defeats the
  purpose of *demonstrating* the comparison; adds complexity for zero
  portfolio benefit.
- **Reason for rejection**: The portfolio goal is for the visitor to *see*
  the choice. Hiding it server-side reverts the artifact to a single-path
  deployment from the visitor's perspective.

## Implementation Notes

- The active path lives in
  [`frontend/src/lib/backends/store.svelte.ts`](../../frontend/src/lib/backends/store.svelte.ts).
  URL state, localStorage state, and the in-memory rune are kept in sync.
- The fetcher seam is documented in ADR-008. ADR-008 covers the narrower
  question of *gateway choice* (APIM vs SvelteKit BFF); this ADR covers the
  *spectrum decision*.
- ADR-009 (Phase 2) covers the Functions Consumption vs ACA decision in
  detail.
- ADR-010 (Phase 3, optional) speculates on a fourth path to AKS without
  building it.

## Related Decisions

- [ADR-008: APIM vs SvelteKit BFF as Gateway](./ADR-008-apim-vs-bff-gateway.md)
- ADR-009: Functions Consumption vs Container Apps *(planned, Phase 2)*
- ADR-010: Path to AKS *(planned, Phase 3, optional)*
- [ADR-005: Database Schema Design](./ADR-005-database-schema-design.md)
- [ADR-006: API Integration Strategy](./ADR-006-api-integration-strategy.md)
