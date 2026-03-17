# Scrydex API Migration Plan

## Overview

Replace the PokeData API (`pokedata.io/v0`) and remove the unused PokemonTcgApi service (`api.pokemontcg.io/v2`) with the Scrydex API (`api.scrydex.com/pokemon/v1`). This involves a new API service, a new Cosmos DB database, a rebuilt pricing model, and updates to every layer that touches API data.

---

## Scope Summary

| Category | Files | Effort |
|----------|-------|--------|
| New service | 1 new file (`scrydexApi.ts`) | High |
| Files to delete | 2 (`pokeDataApi.ts`, `pokemonTcgApi.ts`) | Low |
| Type definitions | 2 files (`models/types.ts`, `lib/types.ts`) | Medium |
| API route handlers | 4 files (sets, cards, card detail, health) | High |
| Configuration | 2 files (`config.ts`, `.env.example`) | Low |
| Database layer | 1 file (`cosmosDb.ts`) | Medium |
| Expansion mapper | 1 file (`expansionMapper.ts`) | Low-Medium |
| Frontend API client | 1 file (`api.ts`) | Low |
| Frontend stores | 1 file (`pricing.svelte.ts`) | Low-Medium |

---

## Phase 1: Foundation — New Types, Config, and Service

### 1.1 Environment & Configuration

**`.env.example`** — Replace PokeData vars, remove PokemonTcg vars, add Scrydex vars:

```env
# Remove these:
# POKEDATA_API_KEY=
# POKEDATA_API_BASE_URL=https://www.pokedata.io/v0
# POKEMON_TCG_API_KEY=
# POKEMON_TCG_API_BASE_URL=https://api.pokemontcg.io/v2

# Add these:
SCRYDEX_API_KEY=
SCRYDEX_TEAM_ID=
SCRYDEX_API_BASE_URL=https://api.scrydex.com/pokemon/v1

# Add new Cosmos DB config for Scrydex data:
COSMOS_DB_DATABASE_NAME=PokemonCardsScrydex
```

**`src/lib/server/config.ts`** — Update `AppConfig` and `getConfig()`:

```typescript
// Remove:
pokeDataApiKey / pokeDataApiBaseUrl / pokemonTcgApiKey / pokemonTcgApiBaseUrl

// Add:
scrydexApiKey: string;
scrydexTeamId: string;
scrydexApiBaseUrl: string;  // default: 'https://api.scrydex.com/pokemon/v1'
```

**`src/lib/server/models/types.ts`** — Update `AppConfig` interface to match.

---

### 1.2 New Pricing Model

The current `EnhancedPriceData` was designed around PokeData's flat key-value structure (`psa_10`, `cgc_9`, `ebay_raw`). Scrydex structures pricing inside card **variants**, where each variant has an array of price entries with condition, grading company, grade, and trend data. The new model should capture this richness.

**`src/lib/server/models/types.ts`** — Replace pricing types:

```typescript
// REMOVE:
interface EnhancedPriceData {
  psaGrades?: Record<string, { value: number }>;
  cgcGrades?: Record<string, { value: number }>;
  ebayRaw?: { value: number };
}

// ADD:
interface VariantPrice {
  condition: string;       // Raw conditions: "NM", "LP", "MP", "HP", "DM"
                           // Graded: typically "U" or condition of submission
  type: 'raw' | 'graded'; // Distinguishes ungraded vs graded pricing
  company?: string;        // Grading company: "PSA", "CGC", "BGS", "TAG", "SGC"
  grade?: string;          // Grade value: "10", "9.5", "9", etc.
  isPerfect: boolean;      // True for CGC Pristine 10, TAG Pristine 10, etc.
  isError: boolean;        // Notable error card (collectible defect)
  isSigned: boolean;       // Autographed card
  low: number;             // Lowest recorded price
  mid?: number;            // Median price (graded cards only)
  high?: number;           // Highest recorded price (graded cards only)
  market: number;          // Average market price
  currency: string;        // "USD" or "JPY"
  trends?: PriceTrends;
}

interface PriceTrends {
  days1?: TrendData;
  days7?: TrendData;
  days14?: TrendData;
  days30?: TrendData;
  days90?: TrendData;
  days180?: TrendData;
}

interface TrendData {
  priceChange: number;     // Absolute price change in the price's currency
  percentChange: number;   // Percentage change relative to starting price
}

interface CardVariant {
  name: string;            // e.g., "unlimitedHolofoil", "firstEditionShadowlessHolofoil"
  images?: CardImage[];
  prices: VariantPrice[];
}

interface CardImage {
  type: string;            // e.g., "front", "back"
  small: string;
  medium: string;
  large: string;
}
```

**`src/lib/server/models/types.ts`** — Update `Card` interface:

```typescript
// REMOVE:
pokeDataId?: number;
tcgPlayerPrice?: PriceData;
enhancedPricing?: EnhancedPriceData;
pricing?: Record<string, unknown>;

// UPDATE:
interface Card {
  id: string;              // Now Scrydex string ID (e.g., "base1-4")
  setCode: string;         // Scrydex expansion code (e.g., "BLK")
  setId: string;           // Changed from number → string (e.g., "base1")
  setName: string;
  cardId: string;          // Same as id for Scrydex
  cardName: string;
  cardNumber: string;      // From Scrydex 'number' field
  printedNumber?: string;  // NEW — from Scrydex 'printed_number' (e.g., "001/098")
  rarity: string;
  rarityCode?: string;     // NEW — from Scrydex 'rarity_code'
  artist?: string;         // NEW
  images?: CardImage[];    // Updated to Scrydex image format (small/medium/large)
  variants?: CardVariant[];// NEW — full variant + pricing data
  lastUpdated?: string;
  pricingLastUpdated?: string;
  language?: string;       // NEW
  languageCode?: string;   // NEW
}
```

**`src/lib/server/models/types.ts`** — Update `PokemonSet` interface:

```typescript
interface PokemonSet {
  id: string;              // Changed from string | number → always string
  code: string;            // Changed from string | null → always string (Scrydex provides codes)
  name: string;
  series: string;          // Changed from optional → always present in Scrydex
  releaseDate?: string;    // From Scrydex 'release_date' (format: YYYY/MM/DD)
  total?: number;          // NEW — total cards including secrets
  printedTotal?: number;   // NEW — printed total on cards
  language?: string;       // NEW
  languageCode?: string;   // NEW
  isOnlineOnly?: boolean;  // NEW — for Pokemon Pocket expansions
  logo?: string;           // NEW — expansion logo URL
  symbol?: string;         // NEW — expansion symbol URL
  cardCount?: number;      // Keep for backward compat
  isCurrent?: boolean;
  lastUpdated?: string;
}
```

**`src/lib/types.ts`** — Mirror the same changes for frontend types, specifically:
- Update `PokemonSet` to use `string` IDs, add `series`, `logo`, `symbol`
- Update `PokemonCard` to include `images` as `CardImage[]`, add `variants`
- Replace `EnhancedPriceData` / `PriceData` with `VariantPrice` / `CardVariant`
- Update `PricingResult` to reflect new variant-based structure

---

### 1.3 New Scrydex API Service

**Create `src/lib/server/services/scrydexApi.ts`**

This replaces `pokeDataApi.ts` entirely. Key design differences from the PokeData service:

**Authentication:** Header-based (`X-Api-Key` + `X-Team-ID`) instead of Bearer token. Both headers are required on every request. The API also requires an active subscription plan.

```typescript
private getHeaders() {
  return {
    'X-Api-Key': this.apiKey,
    'X-Team-ID': this.teamId,
    'Content-Type': 'application/json',
  };
}
```

**ID types:** All string-based. No numeric ID translation needed — eliminates the `setCodeToIdMap` pattern entirely.

**Pricing:** Requested via `?include=prices` on card endpoints, not a separate `/pricing` endpoint.

**Endpoint mapping:**

| Current PokeData Call | New Scrydex Equivalent |
|---|---|
| `GET /sets` | `GET /en/expansions` |
| `GET /sets/{numericId}/cards` | `GET /expansions/{stringId}/cards` |
| `GET /cards/{numericId}` | `GET /cards/{stringId}` |
| `GET /cards/{numericId}/pricing` | `GET /cards/{stringId}?include=prices` |
| `GET /account` | `GET https://api.scrydex.com/account/v1/usage` |

**API credit system:** Each general request costs 1 credit. Price history requests (`/cards/{id}/price_history`) cost 3 credits. When credits are exhausted, overage credits apply at the plan's overage rate — the API does not cut off access.

**Rate limiting:** 100 requests/second across all endpoints. The service must handle `429 Too Many Requests` responses with retry logic (similar to the existing `PokemonTcgApiService` retry pattern).

**Usage monitoring:** Replace the current `checkCreditsRemaining()` method with a call to the Scrydex usage endpoint:

```typescript
async getUsage(): Promise<ScrydexUsage | null> {
  // Note: different base URL — account endpoint is not under /pokemon/v1
  const response = await fetch('https://api.scrydex.com/account/v1/usage', {
    headers: this.getHeaders(),
  });
  // Returns: { total_credits, remaining_credits, used_credits, overage_credit_rate }
}
```

**Service interface:**

```typescript
interface IScrydexApiService {
  getAllExpansions(language?: string): Promise<ScrydexExpansion[]>;
  getExpansion(expansionId: string): Promise<ScrydexExpansion | null>;
  getCardsInExpansion(expansionId: string, page?: number, pageSize?: number): Promise<ScrydexPaginatedResponse<ScrydexCard>>;
  getCard(cardId: string, includePrices?: boolean): Promise<ScrydexCard | null>;
  searchCards(query: string, options?: SearchOptions): Promise<ScrydexPaginatedResponse<ScrydexCard>>;
  getCardListings(cardId: string, options?: ListingOptions): Promise<ScrydexPaginatedResponse<ScrydexListing>>;
  getUsage(): Promise<ScrydexUsage | null>;
}
```

**Retry logic:** Implement 429 handling with retry-after backoff, similar to the existing `PokemonTcgApiService` pattern but adapted for Scrydex's 100 req/s limit:

```typescript
private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { headers: this.getHeaders() });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
      console.log(`[ScrydexApiService] Rate limited, waiting ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Scrydex API returned ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }
  throw new Error(`Scrydex API request failed after ${maxRetries} retries`);
}
```

**Caching strategy (aligned with Scrydex recommendations):**
- **Expansion metadata:** Cache for 24+ hours. This data rarely changes except when new expansions are released.
- **Card metadata (without prices):** Cache for 24+ hours. Card data is stable.
- **Pricing data:** Cache for at least 24 hours. Scrydex states pricing updates at most once per day.
- **Listings:** Shorter cache (1-4 hours) since sold listings update more frequently.
- Keep the same in-memory caching approach, keyed by string IDs instead of numeric.
- The `setCodeToIdMap` can be removed entirely since Scrydex uses the expansion ID directly in URLs.
- Scrydex recommends caching images locally or on your own CDN. Consider storing image URLs in Cosmos DB and optionally proxying through your own CDN in the future.

**Pagination handling:** Scrydex returns `{ data, page, pageSize, totalCount }` with a max of 100 items per page. The service should support auto-pagination for the expansions list (likely under 100 total per language, so single page) and pass-through pagination for cards.

---

### 1.4 Delete Old Services

- **Delete** `src/lib/server/services/pokeDataApi.ts`
- **Delete** `src/lib/server/services/pokemonTcgApi.ts` (confirmed unused — never imported anywhere)

---

## Phase 2: Database & Caching Layer

### 2.1 New Cosmos DB Database

Create a new database (`PokemonCardsScrydex` or configurable name) with fresh containers. This avoids any migration complexity with the existing numeric-ID-based data.

**Changes to `src/lib/server/services/cosmosDb.ts`:**

1. **Remove `pokedata-` prefix handling** — The `getCard()` method strips `pokedata-` prefixes (line 53). Remove this.

2. **Simplify `getCardsBySetId()`** — Currently builds 3 query variants (numeric, string, `pokedata-` prefixed) to handle PokeData's mixed ID formats. With Scrydex, set IDs are always strings. Simplify to a single query:
   ```typescript
   // Before: complex multi-variant query with parseInt, pokedata- prefix
   // After:
   async getCardsBySetId(setId: string): Promise<Card[]> {
     const query = 'SELECT * FROM c WHERE c.setId = @setId';
     const parameters = [{ name: '@setId', value: setId }];
     // ...
   }
   ```

3. **Update `getCard()` signature** — Change `setId` parameter from `number` to `string`:
   ```typescript
   // Before:
   async getCard(cardId: string, setId: number): Promise<Card | null>
   // After:
   async getCard(cardId: string, setId: string): Promise<Card | null>
   ```

4. **Update `ICosmosDbService` interface** to reflect string-based IDs throughout.

### 2.2 Redis Cache

**No structural changes needed.** The Redis cache service is data-agnostic — it stores/retrieves serialized JSON with string keys. However, update the cache key patterns in the route handlers to remove any `pokedata` string literals (the sets route currently uses `${CacheKeys.setList()}-pokedata-${language}` as a key).

---

## Phase 3: API Route Handlers

### 3.1 Sets Route — `src/routes/api/sets/+server.ts`

**Changes:**
1. Import `getScrydexApiService()` instead of `getPokeDataApiService()`
2. Replace `pokeDataService.getAllSets()` with `scrydexService.getAllExpansions('en')` (or parameterized language)
3. Update cache key from `...-pokedata-${language}` to `...-scrydex-${language}`
4. Update the field mapping from Scrydex expansion → internal `PokemonSet`:
   ```typescript
   // Before (PokeData):
   { id: set.id, code: set.code, name: set.name, release_date: set.release_date, language: set.language }

   // After (Scrydex):
   { id: expansion.id, code: expansion.code, name: expansion.name,
     series: expansion.series, releaseDate: expansion.release_date,
     total: expansion.total, printedTotal: expansion.printed_total,
     language: expansion.language, languageCode: expansion.language_code,
     logo: expansion.logo, symbol: expansion.symbol,
     isOnlineOnly: expansion.is_online_only }
   ```
5. Language filtering changes — PokeData used `set.language === 'ENGLISH'`. Scrydex provides language-scoped endpoints (`/en/expansions`), so filtering may happen at the API call level instead.

### 3.2 Cards Route — `src/routes/api/sets/[set_id]/cards/+server.ts`

**Changes:**
1. Import `getScrydexApiService()` instead of `getPokeDataApiService()`
2. **Remove `parseInt(setId, 10)`** — set IDs are now strings, passed directly to `scrydexService.getCardsInExpansion(setId)`
3. Update the card mapping from Scrydex card → internal `Card`:
   ```typescript
   // Before (PokeData card fields):
   // card.id (number), card.set_code, card.set_id, card.set_name, card.name, card.num

   // After (Scrydex card fields):
   // card.id (string, e.g. "base1-4"), card.expansion.id, card.expansion.code,
   // card.expansion.name, card.name, card.number, card.printed_number,
   // card.rarity, card.rarity_code, card.artist, card.images, card.variants
   ```
4. **Remove `pokeDataId` assignment** — Scrydex card IDs are the primary identifiers
5. Add image data mapping from Scrydex `card.images` array

### 3.3 Card Detail Route — `src/routes/api/sets/[set_id]/cards/[card_id]/+server.ts`

**Changes:**
1. Import `getScrydexApiService()` instead of `getPokeDataApiService()`
2. **Remove `parseInt(cardId, 10)`** — card IDs are now strings
3. Replace `pokeDataService.getFullCardDetailsById(numericId)` with `scrydexService.getCard(cardId, true)` (with `includePrices=true`)
4. **Merge pricing fetch into the card request** — PokeData required a separate `getCardPricing()` call. Scrydex returns prices inline when `?include=prices` is used. This simplifies the route logic:
   ```typescript
   // Before: two calls
   const cardData = await pokeDataService.getFullCardDetailsById(cardIdNum);
   const pricing = await pokeDataService.getCardPricing(cardId, card.pokeDataId);

   // After: single call
   const cardData = await scrydexService.getCard(cardId, true); // includes prices
   ```
5. **Replace `mapApiPricingToEnhancedPriceData()`** — Instead of mapping flat pricing keys into PSA/CGC/eBay buckets, map Scrydex `variants[].prices[]` into the new `CardVariant[]` / `VariantPrice[]` structure
6. **Remove `pokeDataId` references** throughout

### 3.4 Health Check — `src/routes/api/health/+server.ts`

**Changes:**
1. Rename `checkPokeDataApi()` → `checkScrydexApi()`
2. Update the health probe request:
   ```typescript
   // Before:
   fetch(`${baseUrl}/sets?limit=1`, { headers: { Authorization: `Bearer ${apiKey}` } })

   // After:
   fetch(`${baseUrl}/en/expansions?page_size=1&select=id`, {
     headers: { 'X-Api-Key': apiKey, 'X-Team-ID': teamId }
   })
   ```
3. Update environment variable references from `POKEDATA_API_KEY` / `POKEDATA_API_BASE_URL` to Scrydex equivalents
4. Update component name in health response from `'pokeDataApi'` to `'scrydexApi'`

---

## Phase 4: Expansion Mapper & Frontend

### 4.1 Expansion Mapper — `src/lib/services/expansionMapper.ts`

**Good news:** This module is largely API-agnostic — it operates on set `code` and `name` fields, both of which Scrydex provides. However, Scrydex includes a `series` field directly on expansions (e.g., `"Scarlet & Violet"`, `"Sun & Moon"`), which is exactly what the expansion mapper is trying to infer from codes and names.

**Recommended approach:** Use Scrydex's `series` field as the primary grouping key, falling back to the existing code/name pattern matching only for expansions where `series` is missing or unexpected:

```typescript
export function getExpansionForSet(set: PokemonSet): string {
  // Scrydex provides series directly — use it if available
  if (set.series && EXPANSION_ORDER.includes(set.series as any)) {
    return set.series;
  }

  // Fallback to existing code/name pattern matching
  // ... (keep existing logic)
}
```

This is a significant simplification. The `SET_NAME_MAPPINGS` dictionary (lines 107-130, currently labeled "from PokeData") and much of the regex matching may become unnecessary, but can remain as fallback.

### 4.2 Frontend API Client — `src/lib/services/api.ts`

**Minimal changes.** This file calls the SvelteKit backend routes, not the external API directly. As long as the backend routes maintain the same response shape, no changes needed. However, verify:

- `getSets()` — expects `{ sets: PokemonSet[] }` — ensure the sets route still returns this shape
- `getCardsForSet()` — expects `PaginatedResponse<PokemonCard>` with `items` array — ensure cards route matches
- `getCardPricing()` — expects `PricingResult` — this will need to change if the pricing structure changes

### 4.3 Frontend Stores

**`src/lib/stores/sets.svelte.ts`** — No changes needed (consumes `api.getSets()` output).

**`src/lib/stores/cards.svelte.ts`** — No changes needed (consumes `api.getCardsForSet()` output).

**`src/lib/stores/pricing.svelte.ts`** — **Update `filterValidPrices()`**. Currently looks for `pricing['standard']` and iterates flat keys. With Scrydex's variant-based pricing, this needs to iterate `variants[].prices[]` instead. The `formatPrice()` utility should also be updated to handle the new `VariantPrice` structure (which has separate `low` and `market` fields plus trend data).

---

## Phase 5: Cleanup & Verification

### 5.1 Usage Monitoring

Replace the PokeData `checkCreditsRemaining()` with Scrydex usage monitoring. The health check route should incorporate a usage check alongside the connectivity probe:

```typescript
// Add to health check response:
{
  scrydexApi: { status: 'healthy', latency: 120 },
  scrydexUsage: {
    totalCredits: 5000,
    remainingCredits: 4200,
    usedCredits: 800,
    overageCreditRate: 0.005,
    percentUsed: 16
  }
}
```

Note: Scrydex usage data is updated every 20-30 minutes, so this is informational rather than real-time.

### 5.2 Files to Delete
- `src/lib/server/services/pokeDataApi.ts`
- `src/lib/server/services/pokemonTcgApi.ts`

### 5.3 Cleanup Tasks
- Remove all `pokeDataId` references across the codebase
- Remove all `parseInt()` calls on set/card IDs in route handlers
- Remove `pokedata-` prefix handling in Cosmos DB service
- Remove `pokemonTcgApiKey` / `pokemonTcgApiBaseUrl` from config
- Update any remaining `'ENGLISH'` / `'JAPANESE'` string comparisons to `'English'` / `'Japanese'` or `'EN'` / `'JA'` (Scrydex format)

### 5.4 Verification Checklist
- [ ] All expansions load and display correctly, grouped by series
- [ ] Cards load for each expansion with correct names, numbers, and images
- [ ] Card images render at all resolutions (small, medium, large)
- [ ] Card detail view shows complete data (rarity, artist, printed number, etc.)
- [ ] Raw pricing displays per-variant with market/low prices and conditions (NM, LP, MP, HP, DM)
- [ ] Graded pricing displays per-variant with company, grade, and low/mid/high/market
- [ ] Price trend data renders (1d, 7d, 14d, 30d, 90d, 180d)
- [ ] Health check endpoint validates Scrydex API connectivity
- [ ] Usage/credits endpoint returns remaining credits
- [ ] 429 rate limit handling works correctly with retry
- [ ] Redis caching works with new string-based keys
- [ ] Cosmos DB reads/writes work with new string-based IDs in new database
- [ ] No remaining references to `pokeDataId`, `PokeData`, or `pokemonTcg` in codebase
- [ ] Language filtering works (English expansions load by default)
- [ ] `pokeDataApi.ts` and `pokemonTcgApi.ts` fully removed

---

## Data Model Mapping Reference

### Expansion (Set) Field Mapping

| PokeData Field | Scrydex Field | Notes |
|---|---|---|
| `id` (number) | `id` (string, e.g., "base1") | Type change: number → string |
| `code` (string \| null) | `code` (string, e.g., "BLK") | Always present in Scrydex |
| `name` | `name` | Same |
| *(not available)* | `series` | **NEW** — direct expansion era |
| `language` ("ENGLISH"/"JAPANESE") | `language` ("English"/"Japanese") | Different casing |
| `release_date` | `release_date` | Same (format: YYYY/MM/DD) |
| *(not available)* | `total` | **NEW** — total cards including secrets |
| *(not available)* | `printed_total` | **NEW** — printed count |
| *(not available)* | `logo` | **NEW** — logo image URL |
| *(not available)* | `symbol` | **NEW** — symbol image URL |
| *(not available)* | `is_online_only` | **NEW** — Pocket expansions |
| *(not available)* | `language_code` | **NEW** — "EN"/"JA" |

### Card Field Mapping

| PokeData Field | Scrydex Field | Notes |
|---|---|---|
| `id` (number) | `id` (string, e.g., "base1-4") | Type change: number → string |
| `name` | `name` | Same |
| `num` | `number` | Field rename |
| *(not available)* | `printed_number` | **NEW** — e.g., "001/098" |
| `set_id` (number) | `expansion.id` (string) | Nested + type change |
| `set_code` | `expansion.code` | Nested |
| `set_name` | `expansion.name` | Nested |
| *(not available)* | `rarity` | **NEW** — e.g., "Rare Holo" |
| *(not available)* | `rarity_code` | **NEW** — e.g., "★H" |
| *(not available)* | `artist` | **NEW** |
| *(not available)* | `images[]` | **NEW** — small/medium/large URLs |
| *(not available)* | `variants[]` | **NEW** — variant names + pricing |
| *(not available)* | `hp`, `attacks`, `abilities`, etc. | **NEW** — full card gameplay data |
| `language` | `language` | Same |
| *(not available)* | `language_code` | **NEW** |
| `secret` (boolean) | *(not available)* | Removed (inferred from number > printed_total) |

### Pricing Structure Mapping

| Aspect | PokeData | Scrydex |
|---|---|---|
| **Endpoint** | Separate: `GET /cards/{id}/pricing` | Inline: `GET /cards/{id}?include=prices` |
| **Structure** | Flat map: `{ "psa_10": { value, currency } }` | Nested: `variants[].prices[]` |
| **Price points** | Single `value` per key | `low`, `market` (raw); + `mid`, `high` (graded) |
| **Trend data** | None | 1, 7, 14, 30, 90, 180-day trends with price_change + percent_change |
| **Raw conditions** | None (single "ebay_raw" value) | NM, LP, MP, HP, DM (5 conditions) |
| **Grading companies** | PSA, CGC only | PSA, CGC, BGS, TAG, SGC, others |
| **Variant awareness** | None | Per-variant pricing (e.g., "unlimitedHolofoil" vs "firstEditionShadowlessHolofoil") |
| **Special flags** | None | `is_perfect`, `is_signed`, `is_error` |
| **Currency** | USD only | USD and JPY (EUR coming soon) |
| **Credit cost** | Unknown | 1 credit (standard), 3 credits (price history) |

**Key mapping changes for `mapApiPricingToEnhancedPriceData()` replacement:**

The old mapper extracted flat keys like `psa_10` and sorted them into `psaGrades`, `cgcGrades`, and `ebayRaw` buckets. The new mapper will iterate `variants[].prices[]` and the data is already structured — each price entry self-describes via `type` ("raw"/"graded"), `company`, `grade`, and `condition` fields. No key parsing needed.

```typescript
// Old PokeData pricing response:
{ "psa_10": { value: 500, currency: "USD" }, "cgc_9": { value: 200, currency: "USD" }, "ebay_raw": { value: 50, currency: "USD" } }

// New Scrydex pricing (embedded in card.variants):
[
  { name: "unlimitedHolofoil", prices: [
    { condition: "NM", type: "raw", low: 868, market: 915.43, currency: "USD", trends: { days_1: {...}, days_7: {...}, ... } },
    { condition: "LP", type: "raw", low: 500, market: 600, currency: "USD", trends: {...} },
    { type: "graded", company: "PSA", grade: "10", low: 2000, mid: 2500, high: 3000, market: 2400, currency: "USD", trends: {...} },
    { type: "graded", company: "CGC", grade: "9.5", low: 1200, mid: 1400, high: 1600, market: 1350, currency: "USD", trends: {...} },
  ]},
  { name: "firstEditionShadowlessHolofoil", prices: [
    { condition: "NM", type: "raw", low: 15000, market: 18000, currency: "USD", trends: {...} },
    { type: "graded", company: "PSA", grade: "10", low: 200000, market: 250000, currency: "USD", trends: {...} },
  ]}
]
```

---

## Recommended Implementation Order

1. **Config + types** — Update env vars, `AppConfig`, and all type interfaces first. This establishes the contract everything else builds against.
2. **New Scrydex service** — Build `scrydexApi.ts` with full caching. Can be tested independently against the live API.
3. **Cosmos DB updates** — Simplify ID handling, point to new database. Test reads/writes with new string-based IDs.
4. **Route handlers** — Update one at a time: sets → cards → card detail → health. Each can be tested as it's updated.
5. **Expansion mapper** — Add `series` field support. Quick win since Scrydex provides this directly.
6. **Frontend pricing** — Update the pricing store and any components rendering price data.
7. **Delete old files** and do a final sweep for any remaining PokeData references.
8. **End-to-end testing** — Walk through the full flow: load sets → pick a set → view cards → view card detail with pricing.
