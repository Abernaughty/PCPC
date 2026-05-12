# `@pcpc/shared`

Internal pnpm-workspace package. Canonical TypeScript types shared across:

- `frontend/` (SvelteKit BFF — Path A)
- `backend/functions/` (Azure Functions v4 — Path B and, after containerization, Path C)

## What's exported

- **`./types/scrydex`** — Snake-case Scrydex API response shapes (`ScrydexExpansion`, `ScrydexCard`, `ScrydexImage`, `ScrydexVariant`, `ScrydexPrice`, `ScrydexPaginatedResponse`, `ScrydexUsage`, `ScrydexListing`).
- **`./types/domain`** — Canonical camelCase shapes persisted in Cosmos DB and returned by every backend (`Card`, `CardImage`, `CardVariant`, `VariantPrice`, `PriceTrends`, `TrendData`, `PokemonSet`).
- **`./types/envelopes`** — Common response envelopes (`ApiResponse<T>`, `ErrorResponse`, `PaginatedResponse<T>`).

All exports are types/interfaces. No runtime values, no build step needed — TypeScript elides type-only imports during compilation in both the SvelteKit (Vite/bundler resolution) and Azure Functions (`tsc` to CommonJS) consumers.
