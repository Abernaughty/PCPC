# PCPC frontend

The SvelteKit 2 + Svelte 5 application that serves [`pcpc.maber.io`](https://pcpc.maber.io) and acts as **Path A** in PCPC's three-path architecture (see [`../docs/PORTFOLIO_PLAN.md`](../docs/PORTFOLIO_PLAN.md)).

The frontend is also the runtime backend toggle: a `?backend=vercel|azure|aca` query parameter swaps which API the page calls, with healthcheck-driven graceful degradation if any backend is down.

## Stack

- **SvelteKit 2.16** + **Svelte 5** (runes)
- **Tailwind CSS v4** (CSS-first config in [`src/app.css`](src/app.css))
- **TypeScript 5.8**, strict mode
- **Vercel adapter** (`@sveltejs/adapter-vercel`) — preview/prod deploys via Vercel's GitHub integration
- **Vitest** for tests (currently empty — `--passWithNoTests`)

## Layout

```
frontend/
├── src/
│   ├── app.css                Design system + Tailwind v4 imports
│   ├── app.html               SvelteKit shell
│   ├── lib/
│   │   ├── components/        Svelte 5 components (incl. legacy v6 designs)
│   │   ├── server/            Server-only services — Cosmos, Redis, Scrydex
│   │   ├── services/          Client-side services (api, logger)
│   │   └── stores/            Svelte 5 runes-based stores
│   └── routes/
│       ├── +page.svelte       Search and lookup UI
│       ├── api/               +server.ts BFF endpoints (Path A)
│       └── cards/[set_id]/[card_id]/   Deep-link route
├── static/                    Public assets, favicon, background images
├── eslint.config.js           Inlined ESLint preset (was @maber/config/eslint)
├── package.json               @pcpc/frontend
├── svelte.config.js
├── tsconfig.json
├── vercel.json                Framework + security headers
└── vite.config.ts
```

## Local development

From the **PCPC repo root** (not from `frontend/`):

```bash
pnpm install                              # workspace-wide install
pnpm --filter @pcpc/frontend dev          # http://localhost:5173
pnpm --filter @pcpc/frontend check        # svelte-kit sync && svelte-check
pnpm --filter @pcpc/frontend lint         # eslint .
pnpm --filter @pcpc/frontend test         # vitest run --passWithNoTests
pnpm --filter @pcpc/frontend build        # production build (Vercel adapter)
```

> `pnpm build` will fail on **Windows** at the adapter-vercel post-build symlink step (`EPERM: operation not permitted`). The Vite build itself succeeds — verify production builds via Vercel's PR previews. This is a known Windows-only limitation, not a regression.

## Environment variables

`.env` at the frontend root, loaded by SvelteKit's `$env/dynamic/private`:

| Var | Purpose |
|---|---|
| `COSMOS_DB_CONNECTION_STRING` | Cosmos DB account |
| `COSMOS_DB_DATABASE_NAME` | default `PokemonCardsScrydex` |
| `COSMOS_DB_CARDS_CONTAINER_NAME` | default `Cards` |
| `COSMOS_DB_SETS_CONTAINER_NAME` | default `Sets` |
| `REDIS_CONNECTION_STRING` | optional |
| `ENABLE_REDIS_CACHE` | `'true'` to enable |
| `SCRYDEX_API_KEY`, `SCRYDEX_TEAM_ID`, `SCRYDEX_API_BASE_URL` | upstream API |
| `CACHE_TTL_SETS`, `CACHE_TTL_CARDS`, `CACHE_TTL_PRICES` | seconds |

In Vercel, set the same vars on the project's **Environment Variables** page. The Vercel project's **Root Directory** must be `frontend` (no trailing slash, no trailing space).

## Deployment

Vercel auto-deploys from the Vercel-connected branch:

- **Production:** pushes to `main`
- **Previews:** every PR (build runs install / typecheck / build / adapter-vercel function bundling)

The Vercel project (`prj_k26pGexXyOzihAIlIWPYsBL67vXT`) was repointed from `maber-web/apps/pcpc/` to `Abernaughty/PCPC/frontend/` during the Phase 0 consolidation.

## Path A wiring (today)

Each `src/routes/api/**/+server.ts` is a serverless function on Vercel that talks to Cosmos / Redis / Scrydex through the services in `src/lib/server/`. Phase 1 will add a backend abstraction layer so `?backend=vercel|azure` swaps the data fetcher; Phase 2 wires `?backend=aca`. See [`../docs/PORTFOLIO_PLAN.md`](../docs/PORTFOLIO_PLAN.md).

The `@pcpc/shared` workspace package (currently a placeholder) will hold canonical Scrydex types once the backend migrates from PokeData in Phase 2.
