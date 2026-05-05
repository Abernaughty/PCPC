# Memory

## Me
Michael (mabernathy87@gmail.com). Building PCPC — a Pokemon Card Price Comparison app.

## Tech Stack
| Component | Technology |
|-----------|-----------|
| Framework | SvelteKit 2.16 + Svelte 5 (runes) |
| Language | TypeScript 5.8 throughout (no Python) |
| Styling | TailwindCSS 4.1 |
| Database | Azure Cosmos DB |
| Cache | Redis (optional, configurable) + in-memory + IndexedDB (client) |
| Hosting | Vercel |
| Monorepo | Turborepo (apps: pcpc, blackjack, landing) |

## Terms
| Term | Meaning |
|------|---------|
| PCPC | Pokemon Card Price Comparison — the main app |
| Scrydex | New API replacing PokeData (api.scrydex.com) |
| PokeData | Old API — fully removed from codebase |
| PokemonTcgApi | Legacy pokemontcg.io service — fully removed from codebase |
| Expansion | Scrydex term for what PokeData called "sets" |
| Variant | Card variant (e.g., unlimitedHolofoil, firstEditionShadowlessHolofoil) — pricing is per-variant |

## Active Projects
| Name | What | Status |
|------|------|--------|
| **Scrydex Migration** | Replace PokeData API with Scrydex API across entire app | Code complete (Phases 1–4 done), needs env vars + E2E testing |

-> Details: memory/projects/scrydex-migration.md
-> Full plan: scrydex-migration-plan.md

## Key Decisions
- New Cosmos DB database for Scrydex data (no migration of old PokeData records)
- Rebuild pricing model from ground up for Scrydex's variant-based structure
- Remove unused PokemonTcgApiService
- Use Scrydex `series` field to simplify expansion mapper
- Stick with TypeScript everywhere (no Python)
- Vercel env vars: add Scrydex creds first, remove PokeData after migration verified

## Preferences
- Wants thorough analysis before implementation
- Prefers understanding full scope of changes before starting work
