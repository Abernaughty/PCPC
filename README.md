# PCPC — Pokémon Card Price Checker

A single product (Pokémon card pricing) deployed three ways from one repo to demonstrate architectural range across modern-edge, enterprise-cloud, and managed-container patterns. **One frontend, three interchangeable backends, one shared schema.**

> **Status:** Phase 2.2 done — three live paths from one repo.
> **Live demo:** [pcpc.maber.io](https://pcpc.maber.io) — toggle all three backends via the corner badge or `?backend=vercel|azure|aca`.
> **Architecture comparison:** [`docs/architecture-comparison.md`](docs/architecture-comparison.md).

---

## The three paths

```
                         pcpc.maber.io
                       (Vercel · SvelteKit)
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
   ?backend=vercel        ?backend=azure        ?backend=aca
           │                    │                    │
   SvelteKit BFF        APIM → Functions      ACA → Functions
   (+server.ts)          (Consumption)       (KEDA-autoscaled
                                              container)
           │                    │                    │
           └────────────────────┼────────────────────┘
                                │
                       Cosmos DB (Scrydex schema)
                       Redis (optional)
```

| Path | Stack | What it demonstrates |
|---|---|---|
| **A — Vercel BFF** | SvelteKit 2 + Svelte 5 → SvelteKit `+server.ts` → Cosmos | Modern edge / SSR / BFF; lightweight personal-app architecture |
| **B — APIM + Functions** | APIM Consumption → Azure Functions v4 (Node 22) → Cosmos / Redis | Enterprise IaC, API gateway, ADO pipelines, defense/regulated patterns |
| **C — ACA Container** | Same Functions image → Azure Container Apps with KEDA | Container fluency, FedRAMP-friendly deployment, image immutability |

All three paths share the same Cosmos DB account and the same TypeScript types via [`@pcpc/shared`](backend/shared).

## Skills demonstrated

**Frontend / Edge** · SvelteKit 2 · Svelte 5 runes · Tailwind CSS v4 · Vercel adapter · pnpm workspaces

**Azure** · API Management · Functions v4 · Container Apps + KEDA · Cosmos DB · Redis · Application Insights · Key Vault · Managed Identity · ACR

**IaC + Pipelines** · Terraform (9 modules) · Azure DevOps multi-stage pipelines · ACR-backed CI containers · Static Web Apps

**Architecture / Practice** · ADR-driven design · Repository consolidation via `git filter-repo` · Multi-runtime type sharing · Architectural decision documentation

## Live demo

[pcpc.maber.io](https://pcpc.maber.io) — one URL, one frontend, three switchable backends. A corner badge surfaces the active path with its latency; click to switch, or pin via `?backend=vercel|azure|aca` in the URL. Healthcheck-driven graceful degradation hides any path whose `/health` does not respond within 2s, so partial outages never break the demo. The toggle defaults to Path A — a recruiter who never engages it gets a normal app experience.

| URL | What it hits |
|---|---|
| `pcpc.maber.io` | Path A (default) |
| `pcpc.maber.io/?backend=vercel` | Path A explicitly — SvelteKit BFF on Vercel |
| `pcpc.maber.io/?backend=azure` | Path B — APIM + Functions Consumption (Scrydex-native post-Phase-2.1) |
| `pcpc.maber.io/?backend=aca` | Path C — containerized Functions on Azure Container Apps (KEDA-ready) |

## Architecture decision records

Decisions live in [`docs/adr/`](docs/adr/). The existing ADRs (001–006) cover earlier infrastructure choices (package manager, runtime, caching, devcontainer, schema, API integration). The three-path portfolio story adds:

- **[ADR-007](docs/adr/ADR-007-api-architecture-spectrum.md)** — API architecture spectrum (why three paths exist) *(Accepted, Phase 1)*
- **[ADR-008](docs/adr/ADR-008-apim-vs-bff-gateway.md)** — APIM vs SvelteKit BFF as gateway *(Accepted, Phase 1)*
- **[ADR-009](docs/adr/ADR-009-functions-consumption-vs-container-apps.md)** — Functions Consumption vs Container Apps *(Accepted, Phase 2.2)*
- **ADR-010** *(optional)* — Path to AKS *(Phase 3)*

## Repository layout

```
PCPC/
├── frontend/          SvelteKit 2 + Svelte 5 app   (Path A — was maber-web/apps/pcpc)
├── backend/
│   ├── functions/     Azure Functions v4           (Path B; Phase 2 → Path C as container)
│   └── shared/        @pcpc/shared types           (canonical Scrydex schema)
├── infra/             Terraform modules            (9 modules + container-app in Phase 2)
├── apim/              APIM as code
├── db/                Cosmos DB schema
├── pipelines/ado/     Azure DevOps multi-stage CI/CD
├── docs/
│   ├── architecture-comparison.md   (in progress)
│   └── adr/
├── tests/             Jest + Playwright + k6
├── memory-bank/       Project memory documentation
└── .devcontainer/     ACR-backed devcontainer (~60s setup)
```

## Quick start

Requires Docker Desktop, VS Code with Dev Containers, and Git.

```bash
git clone https://github.com/Abernaughty/PCPC.git
cd PCPC
code .                                            # → "Reopen in Container"
pnpm install                                      # at the repo root
pnpm --filter @pcpc/frontend dev                  # frontend on :5173
pnpm --filter @pcpc/frontend build                # production build (Vercel adapter)
```

Backend (Path B) and infrastructure are run via `pipelines/ado/` and Terraform modules in `infra/` — see [`infra/README.md`](infra/README.md) and [`pipelines/ado/README.md`](pipelines/ado/README.md).

## Status by phase

| Phase | Goal | Status |
|---|---|---|
| **0** | Consolidate maber-web/apps/pcpc into this repo, set up workspace, add portfolio surface | done |
| **1** | Live two-path toggle (Vercel BFF + APIM/Functions), ADR-007 & ADR-008, comparison doc | done |
| **2.1** | Cut backend over from PokeData to Scrydex; `@pcpc/shared` canonical types; smoke tests re-promoted to blocking | done (PRs #145, #146) |
| **2.2** | Containerize Functions, ship ACA path, ADR-009 | done — dev only; staging/prod promotion planned |
| **3** | Polish: portfolio site, ADR-010 | next |

## License

MIT — see [LICENSE](LICENSE).
