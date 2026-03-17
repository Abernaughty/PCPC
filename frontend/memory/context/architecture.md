# PCPC Architecture

## Data Flow
```
Scrydex API (api.scrydex.com/pokemon/v1)
    ↓
ScrydexApiService (singleton, in-memory cache)
    ↓
SvelteKit API Routes (/api/sets, /api/sets/{id}/cards, /api/sets/{id}/cards/{id})
    ↓ writes to
    ├── Redis Cache (optional, TTL-based)
    ├── Cosmos DB (persistent storage)
    ↓ responds to
Frontend API Client (lib/services/api.ts)
    ↓
Svelte 5 Stores (sets, cards, pricing) + IndexedDB (browser cache)
    ↓
UI Components
```

## Key Files
| File | Purpose |
|------|---------|
| src/lib/server/services/scrydexApi.ts | API client (being created) |
| src/lib/server/services/cosmosDb.ts | Database operations |
| src/lib/server/services/redisCache.ts | Redis caching layer |
| src/lib/server/config.ts | Environment config |
| src/lib/server/models/types.ts | Backend type definitions |
| src/lib/types.ts | Frontend type definitions |
| src/lib/services/api.ts | Frontend HTTP client |
| src/lib/services/expansionMapper.ts | Groups expansions by series |
| src/lib/stores/*.svelte.ts | Svelte 5 reactive stores |
| src/routes/api/** | SvelteKit API route handlers |

## Caching Strategy (Multi-Layer)
1. In-memory (service level): 24h for expansions, configurable for cards
2. Redis (server): 7d for sets, 1h for cards (optional, configurable)
3. Cosmos DB: persistent storage
4. IndexedDB (browser): client-side cache via stores

## Hosting
- Vercel (SvelteKit adapter-vercel)
- Environment variables managed in Vercel dashboard
- Monorepo: Turborepo with apps/pcpc as main app
