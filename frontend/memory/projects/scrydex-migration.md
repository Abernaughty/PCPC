# Scrydex Migration

**Status:** Code complete (Phases 1–4). Pending: env vars on Vercel + end-to-end testing.
**Plan document:** /scrydex-migration-plan.md (in project root)

## What It Is
Replace the PokeData API (pokedata.io/v0) with the Scrydex API (api.scrydex.com/pokemon/v1) across the entire PCPC app. Also remove the unused PokemonTcgApiService.

## Why
Scrydex is more robust — provides card images, variant-level pricing with trend data, graded card pricing across multiple companies (PSA, CGC, BGS, TAG, SGC), raw condition pricing (NM/LP/MP/HP/DM), sealed product data, sold listings, and powerful search syntax.

## Completed Work

### Phase 1: Foundation (Config + Types) ✅
- `.env.example` — Replaced PokeData/PokemonTCG vars with SCRYDEX_API_KEY, SCRYDEX_TEAM_ID, SCRYDEX_API_BASE_URL
- `config.ts` — Updated getConfig() for new env vars, default Cosmos DB name → PokemonCardsScrydex
- `models/types.ts` — Rebuilt Card (string IDs, variants, images, artist, rarity), PokemonSet (series required, logo, symbol, totals), new VariantPrice/CardVariant/PriceTrends/TrendData types, removed EnhancedPriceData/PriceData
- `lib/types.ts` — Frontend types mirrored, PricingResult now variant-based

### Phase 2: New Service + Database ✅
- Created `scrydexApi.ts` — Full service with header auth, fetchWithRetry (429 handling), in-memory caching, all endpoints, mapping helpers
- Updated `cosmosDb.ts` — String-based IDs throughout, removed pokedata- prefix handling, simplified getCardsBySetId to single query
- Deleted `pokeDataApi.ts` and `pokemonTcgApi.ts`

### Phase 3: Route Handlers ✅
- Sets route — Calls scrydexService.getAllExpansions(), maps expansion fields, cache key updated
- Cards route — String setId (no parseInt), maps Scrydex card fields + variants
- Card detail route — Single getCard(id, true) call replaces separate card + pricing fetches
- Health check — checkScrydexApi() with X-Api-Key + X-Team-ID headers

### Phase 4: Frontend ✅
- Expansion mapper — Uses Scrydex `series` as primary grouping key, fallback to code/name matching
- Pricing store — Rebuilt for variant-based pricing (getMarketPrice, getRawPrices, getGradedPrices, JPY support)
- API client — Fixed response shape for cards route, tightened to string IDs
- Cards store — Tightened setId to string

## Remaining Steps (Phase 5)

### Before First Deploy
1. **Add Vercel env vars:**
   - `SCRYDEX_API_KEY` — your Scrydex API key
   - `SCRYDEX_TEAM_ID` — your Scrydex team ID
   - `SCRYDEX_API_BASE_URL` — `https://api.scrydex.com/pokemon/v1`
   - Update `COSMOS_DB_DATABASE_NAME` to `PokemonCardsScrydex`
2. **Create Cosmos DB database:** Create `PokemonCardsScrydex` database with Cards and Sets containers in Azure
3. **Deploy to Preview** — test on a preview branch first

### End-to-End Testing Checklist
- [ ] All expansions load and display correctly, grouped by series
- [ ] Cards load for each expansion with correct names, numbers, and images
- [ ] Card images render at all resolutions (small, medium, large)
- [ ] Card detail view shows complete data (rarity, artist, printed number)
- [ ] Raw pricing displays per-variant with conditions (NM, LP, MP, HP, DM)
- [ ] Graded pricing displays per-variant with company, grade, low/mid/high/market
- [ ] Price trend data renders (1d, 7d, 14d, 30d, 90d, 180d)
- [ ] Health check validates Scrydex API connectivity
- [ ] 429 rate limit handling works with retry
- [ ] Redis caching works with new string-based keys
- [ ] Cosmos DB reads/writes work with new string-based IDs
- [ ] Language filtering works (English expansions by default)

### After Verification
- Remove old POKEDATA_* and POKEMON_TCG_* env vars from Vercel
- (Optional) Delete old PokemonCards Cosmos DB database

## Scrydex API Endpoints Used
| Endpoint | Purpose |
|----------|---------|
| GET /en/expansions | List all English expansions |
| GET /expansions/{id} | Single expansion detail |
| GET /expansions/{id}/cards | Cards in an expansion |
| GET /cards/{id}?include=prices | Single card with pricing |
| GET /cards/{id}/listings | Sold listings for a card |
| GET /account/v1/usage | Credit/usage monitoring |
