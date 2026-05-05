# `@pcpc/shared`

Internal pnpm-workspace package. Canonical TypeScript types and schemas shared across:

- `frontend/` (SvelteKit BFF — Path A)
- `backend/functions/` (Azure Functions v4 — Path B and, after containerization, Path C)

Currently a placeholder. Real exports land when the Functions code migrates from PokeData to Scrydex in Phase 2 of the portfolio plan ([`docs/PORTFOLIO_PLAN.md`](../../docs/PORTFOLIO_PLAN.md)). The intent is one source of truth for `Card`, `Set` (Scrydex calls these *Expansions*), `Variant`, and pricing types so the three deployment paths stay in lockstep.
