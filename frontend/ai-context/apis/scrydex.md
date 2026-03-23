# Scrydex API — PCPC Integration Reference

> **Source of truth:** `apps/pcpc/docs/vendors/scrydex/raw/` (vendor docs).
> This file distills the parts PCPC actually uses and documents project-specific decisions.
> Last synced with vendor docs: 2026-03-23.

---

## 1. Purpose

PCPC uses the Scrydex Pokemon API for:

- **Expansion (set) metadata** — names, codes, series, release dates, logos, symbols, language, card counts.
- **Card metadata** — names, numbers, rarity, artist, images, variants.
- **Pricing data** — raw (by condition) and graded (by company/grade), with trend history.
- **Listings** — historical sold prices from marketplaces (implemented in service layer, not yet exposed in UI).

Sealed products are available in the API but **not in scope** for PCPC currently.

---

## 2. Base URL & Authentication

**Base URL:** `https://api.scrydex.com/pokemon/v1`

**Required headers** (every request):

| Header | Value | Source |
|--------|-------|--------|
| `X-Api-Key` | API key | `SCRYDEX_API_KEY` env var |
| `X-Team-ID` | Team ID | `SCRYDEX_TEAM_ID` env var |
| `Content-Type` | `application/json` | hardcoded |

All requests must be over HTTPS. Requests without auth headers still work but have heavily reduced rate limits.

Secrets are server-side only — loaded via SvelteKit `$env/dynamic/private` in `src/lib/server/config.ts`. Never exposed to the client.

---

## 3. Rate Limits & Credits

**Rate limit:** 100 requests/second (across all endpoints, all plans).

**Credit costs:**

| Request type | Credits |
|--------------|---------|
| General (cards, expansions, listings, sealed) | 1 |
| Price history (`/cards/{id}/price_history`) | 3 |

Overage: when plan credits are exhausted, requests continue but overage credits are billed at the start of the next billing cycle.

**Monitor usage:** `GET https://api.scrydex.com/account/v1/usage` (note: `/account/v1`, not `/pokemon/v1`). Returns `total_credits`, `remaining_credits`, `used_credits`, `overage_credit_rate`. Updated every 20-30 minutes.

**429 handling:** on `Too Many Requests`, read the `Retry-After` header (seconds) and wait before retrying. PCPC implementation uses exponential backoff with up to 3 retries.

---

## 4. Pagination

**All list/search endpoints are paginated.** The response shape from the API is:

```json
{
  "data": [...],
  "page": 1,
  "page_size": 100,
  "count": 100,
  "total_count": 406
}
```

| Parameter | Description | Default | Max |
|-----------|-------------|---------|-----|
| `page` | Page number (1-indexed) | `1` | — |
| `page_size` | Items per page | `100` | `100` |

Both `page_size` and `pageSize` are accepted (the API accepts snake_case or camelCase query params).

**Important:** The maximum `page_size` is **100**. To fetch all items in a collection (e.g., all 406 EN expansions, or a set with 300+ cards), you must paginate by incrementing `page` until `data` is empty or items collected >= `total_count`.

> **Known gotcha (Issue #10):** The raw API response uses **snake_case** field names (`page_size`, `total_count`). Our `scrydexApi.ts` has a `mapPaginatedResponse()` boundary function that converts these to camelCase (`pageSize`, `totalCount`) for all internal code. A previous bug where code expected camelCase from the raw response caused pagination to exit after page 1.

---

## 5. Language Scoping

The API supports language-scoped requests by inserting a language code between the version and endpoint:

| Pattern | Returns |
|---------|---------|
| `/pokemon/v1/cards` | All languages (mixed EN + JA) |
| `/pokemon/v1/en/cards` | English only |
| `/pokemon/v1/ja/cards` | Japanese only |
| `/pokemon/v1/en/expansions` | English expansions only |
| `/pokemon/v1/ja/expansions` | Japanese expansions only |

Same pattern works for `/expansions`, `/cards/search`, etc.

**PCPC project decision:** Expansions are fetched with language scoping (default `en`). The expansion cache is keyed by language to avoid cross-language bleed.

### Japanese data & translations

- Japanese cards have fields (`name`, `supertype`, `subtypes`, `types`, etc.) in Japanese.
- A `translation.en` nested object provides English equivalents when available.
- If a Japanese field is missing, it falls back to the English equivalent automatically.
- Japanese expansions also have a `translation.en.name` field for the English name.
- Translations are a **work in progress** — not all fields are guaranteed to have translations.

**PCPC project decision:** Display English translation only for JP sets/cards. Use the `JP` badge to communicate language/market. No Japanese characters shown in the UI.

---

## 6. Endpoints In Scope

### 6.1 Expansions

**List all expansions (paginated):**
```
GET /pokemon/v1/{lang}/expansions?page={n}&page_size=100
```

**Get single expansion:**
```
GET /pokemon/v1/expansions/{id}
```

**Search expansions:**
```
GET /pokemon/v1/{lang}/expansions?q={lucene_query}&page={n}&page_size=100
```

**Expansion object fields used by PCPC:**

| API field (snake_case) | Type | PCPC usage |
|------------------------|------|------------|
| `id` | string | Primary key, URL params |
| `name` | string | Display name |
| `series` | string | Grouping in dropdown |
| `code` | string | Display in subtitle |
| `total` | integer | Card count (includes secret rares) |
| `printed_total` | integer | Printed card count |
| `language` | string | Fallback language detection |
| `language_code` | string | EN/JP badge |
| `release_date` | string (YYYY/MM/DD) | Chronological sorting, subtitle display |
| `is_online_only` | boolean | Filter out Pocket-only sets |
| `logo` | string (URL) | Set logo image |
| `symbol` | string (URL) | Set symbol image (20x20) |
| `translation.en.name` | string | English name for JP sets |

### 6.2 Cards

**List cards in an expansion (paginated):**
```
GET /pokemon/v1/expansions/{expansionId}/cards?page={n}&page_size=100
```

**Get single card:**
```
GET /pokemon/v1/cards/{id}
GET /pokemon/v1/cards/{id}?include=prices
```

**Search cards:**
```
GET /pokemon/v1/{lang}/cards/search?q={lucene_query}&page={n}&page_size=100
```

**Card object fields used by PCPC:**

| API field (snake_case) | Type | PCPC usage |
|------------------------|------|------------|
| `id` | string | Primary key, URL params, deep links |
| `name` | string | Display name |
| `number` | string | Sort by number, display |
| `printed_number` | string | Display (e.g., "087/160") |
| `rarity` | string | Rarity dots, sort by rarity |
| `rarity_code` | string | Display |
| `artist` | string | Card detail metadata |
| `language` | string | Language detection |
| `language_code` | string | EN/JP badge |
| `images[]` | array | Thumbnails (small), lightbox (large) |
| `images[].type` | string | "front" / "back" |
| `images[].small` | string (URL) | Card thumbnails (22x30) |
| `images[].medium` | string (URL) | Card image in detail panel (180px) |
| `images[].large` | string (URL) | Lightbox full-size |
| `expansion` | object | Nested set info (id, code, name, series) |
| `variants[]` | array | Variant list with pricing |
| `variants[].name` | string | Variant name (e.g., "holofoil") |
| `variants[].images[]` | array | Variant-specific images |
| `variants[].prices[]` | array | Pricing data (only present with `?include=prices`) |

**Fields available but NOT used by PCPC:** `supertype`, `subtypes`, `types`, `hp`, `level`, `evolves_from`, `rules`, `ancient_trait`, `abilities`, `attacks`, `weaknesses`, `resistances`, `retreat_cost`, `converted_retreat_cost`, `national_pokedex_numbers`, `flavor_text`, `regulation_mark`, `expansion_sort_order`.

### 6.3 Pricing (via `?include=prices`)

Pricing is **opt-in**. Add `?include=prices` to card endpoints. Without it, `variants[].prices` will be an empty array.

**Raw price object:**

| Field | Type | Notes |
|-------|------|-------|
| `condition` | string | NM, LP, MP, HP, DM |
| `type` | string | Always `"raw"` |
| `is_perfect` | boolean | Always false for raw |
| `is_signed` | boolean | Always false for raw |
| `is_error` | boolean | Always false for raw |
| `low` | number | Lowest recorded price |
| `market` | number | Average market price |
| `currency` | string | `"USD"` or `"JPY"` |
| `trends` | object | See below |

**Graded price object** — same as raw, plus:

| Field | Type | Notes |
|-------|------|-------|
| `company` | string | PSA, CGC, BGS, SGC, TAG |
| `grade` | string | e.g., "10", "9.5", "9" |
| `is_perfect` | boolean | true for CGC Pristine 10, TAG Pristine 10 |
| `mid` | number | Median price (graded only) |
| `high` | number | Highest recorded price (graded only) |
| `type` | string | Always `"graded"` |

**Trends object** (same for raw and graded):

```json
"trends": {
  "days_1":   { "price_change": 0.0, "percent_change": 0.0 },
  "days_7":   { "price_change": -16.59, "percent_change": -1.78 },
  "days_14":  { "price_change": -44.32, "percent_change": -4.62 },
  "days_30":  { "price_change": -95.64, "percent_change": -9.46 },
  "days_90":  { "price_change": -365.6, "percent_change": -28.54 },
  "days_180": { "price_change": -646.65, "percent_change": -41.4 }
}
```

`price_change` is in the same currency as the price object. To reconstruct historical price: `market - trends.daysN.price_change`.

**Pricing update frequency:** at most once per day. Cache for at least 24 hours.

### 6.4 Listings

**Get listings for a card:**
```
GET /pokemon/v1/cards/{id}/listings?page={n}&page_size=25
```

Supports filters: `days`, `source`, `variant`, `grade`, `company`, `condition`, `is_perfect`, `is_error`, `is_signed`.

**Listing object fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | UUID |
| `source` | string | e.g., "ebay" |
| `card_id` | string | Links to card |
| `title` | string | Original listing title |
| `variant` | string | e.g., "holofoil" |
| `company` | string | Grading company, if applicable |
| `grade` | string | Grade, if applicable |
| `is_perfect` | boolean | Flawless condition |
| `is_error` | boolean | Error card |
| `is_signed` | boolean | Autographed |
| `url` | string | Link to original listing |
| `price` | number | Sold price |
| `currency` | string | USD, JPY |
| `sold_at` | string | Date sold (YYYY/MM/DD) |

**PCPC status:** Service layer implemented (`getCardListings`), but **not yet exposed in UI**. See Issue #21.

### 6.5 Sealed Products (not in scope)

Endpoints exist at `/pokemon/v1/sealed` and `/pokemon/v1/expansions/{id}/sealed`. Same pagination, search, and pricing patterns as cards. **Not used by PCPC currently.** See Issue #26.

---

## 7. Search Syntax (Lucene-like `q` parameter)

All search endpoints (`/cards`, `/expansions`, `/sealed`) support a `q` parameter with Lucene-like syntax:

| Pattern | Example | Meaning |
|---------|---------|--------|
| Field match | `name:charizard` | Name contains "charizard" |
| Phrase match | `name:"venusaur v"` | Exact phrase in name |
| AND (implicit) | `name:charizard subtypes:mega` | Both conditions |
| OR | `(subtypes:mega OR subtypes:vmax)` | Either condition |
| Exclude | `-types:water` | Not water type |
| Wildcard | `name:char*` | Starts with "char" |
| Exact match | `!name:charizard` | Name is exactly "charizard" |
| Range (inclusive) | `hp:[150 TO *]` | HP >= 150 |
| Range (exclusive) | `hp:{100 TO 200}` | 100 < HP < 200 |
| Nested field | `expansion.id:sm1` | Expansion ID is sm1 |

**PCPC usage:** Currently no direct search queries are constructed in the UI. Card and expansion fetching is done by expansion ID, not by search. The `searchCards` method exists in the service layer but is not used in the current UI flow. See Issue #20 for planned global search feature.

---

## 8. Query Parameter Reference

These parameters work on all paginated/search endpoints. Both snake_case and camelCase are accepted.

| Parameter | Description |
|-----------|-------------|
| `page` | Page number (1-indexed, default: 1) |
| `page_size` | Items per page (default: 100, max: 100) |
| `q` | Lucene-like search query |
| `select` | Comma-separated field list to return (reduces payload) |
| `include` | Opt-in data: `prices` (adds pricing to variants) |
| `orderBy` | Sort field(s), prefix with `-` for descending (e.g., `name,-number`) |
| `casing` | Response field casing: `camel` or `snake` (default: snake) |

### 8.1 `?select=` Field Filtering (confirmed behavior, Mar 2026)

The `select` parameter limits which fields are returned in the response. Key behaviors confirmed via live API testing:

- **Top-level fields only** — dot notation does NOT work. `?select=variants.name` will not select a nested sub-field; it will either fail silently or return nothing for that field.
- **`variants` must be in the select list to get pricing data** — if you use `?select=id,name` with `?include=prices`, no pricing data is returned because the `variants` field (which carries the prices) is not selected.
- **If `select` is omitted**, all fields are returned (full payload, same as today).
- **Works on all endpoints** — expansions, cards, sealed, listings.

**PCPC project decision (planned, Issue #19):** Add `?select=` to card list fetches to trim unused game-data fields (`attacks`, `abilities`, `weaknesses`, etc.). Expansion payloads are already lean — not worth adding `?select=` to expansion fetches. The select field list should be maintained as a named constant (`CARD_LIST_SELECT_FIELDS`) so it's easy to expand when new features need additional fields (e.g., Issue #22 rich card data).

**Planned card list select fields:**
```
id,name,number,printed_number,rarity,rarity_code,artist,images,variants,expansion,language,language_code
```

### 8.2 `?include=prices` Scope

The `include=prices` parameter opts into pricing data that is excluded by default.

**Supported on:**
- Cards (list, get, search) — populates `variants[].prices[]`
- Sealed products (list, get, search) — populates `variants[].prices[]`
- Listings (search) — includes pricing context

**NOT supported on:**
- Expansions — no pricing data exists on expansion objects

**Credit cost:** Including prices does **not** change the credit cost. A card fetch is 1 credit whether prices are included or not.

**PCPC project decision (planned, Issue #19):** Add `?include=prices` to the card-list-by-expansion fetch (`getCardsInExpansion`). This eliminates the separate single-card pricing fetch and enables client-side price sorting/filtering in the card dropdown. The single-card fetch with `?include=prices` remains necessary for deep links and future global search.

---

## 9. Image URLs

Image URL pattern (from docs): `https://images.scrydex.com/pokemon/{card-id}/{size}`

Sizes: `small`, `medium`, `large`.

**Important (from vendor best practices):** Never assume URL patterns — always use URLs as returned by the API. The pattern is generally consistent but not guaranteed.

**PCPC project decision:** Images are hotlinked directly from Scrydex. No self-hosting or CDN caching. Consuming images does not cost API credits. See Issue #17 for planned self-hosting.

Expansion images use a different pattern:
- Logo: `https://images.scrydex.com/pokemon/{expansion-id}-logo/logo`
- Symbol: `https://images.scrydex.com/pokemon/{expansion-id}-symbol/symbol`

---

## 10. Caching Strategy (PCPC Project Decisions)

Vendor recommendation: cache aggressively. Pricing changes at most once per day. Card metadata and expansions change rarely (only on new expansion releases; webhooks coming soon).

**PCPC three-tier cache:**

| Layer | Technology | TTL | What |
|-------|-----------|-----|------|
| L1 (client) | IndexedDB | 7 days (sets/cards), 24h (pricing) | Sets, cards, pricing |
| L2 (server) | Azure Cosmos DB | Until invalidated | Cards, pricing (sets skip Cosmos) |
| L3 (server, in-memory) | ScrydexApiService class | 24h (expansions, cards, pricing), 4h (listings) | All API responses |

Redis is configured but **disabled** in production (`ENABLE_REDIS_CACHE` not set).

> **Note (Issue #19):** If pricing is bundled with the card list fetch via `?include=prices`, the IndexedDB card cache will carry pricing data. The 24h pricing TTL becomes the binding constraint for card cache freshness, not the 7-day card metadata TTL.

---

## 11. Field Mapping: Scrydex API -> PCPC Types

The casing boundary is in `src/lib/server/services/scrydexApi.ts`. Raw Scrydex responses are snake_case; all internal PCPC code uses camelCase.

**Type chain:** `ScrydexExpansion` / `ScrydexCard` / `ScrydexPrice` (API types in scrydexApi.ts) -> `PokemonSet` / `Card` / `VariantPrice` (server models in server/models/types.ts) -> `PokemonSet` / `PokemonCard` / `VariantPrice` (frontend types in lib/types.ts)

**Key field renames (Scrydex -> PCPC):**

| Scrydex (snake_case) | PCPC (camelCase) | Notes |
|---------------------|------------------|-------|
| `release_date` | `releaseDate` | |
| `language_code` | `languageCode` | |
| `is_online_only` | `isOnlineOnly` | |
| `printed_total` | `printedTotal` | |
| `rarity_code` | `rarityCode` | |
| `printed_number` | `printedNumber` | |
| `is_perfect` | `isPerfect` | |
| `is_signed` | `isSigned` | |
| `is_error` | `isError` | |
| `page_size` | `pageSize` | Pagination response |
| `total_count` | `totalCount` | Pagination response |
| `price_change` | `priceChange` | Trends |
| `percent_change` | `percentChange` | Trends |
| `days_1` through `days_180` | `days1` through `days180` | Trends |

---

## 12. Known Gotchas & Lessons Learned

1. **Pagination snake_case (Issue #10):** The raw API pagination response uses `page_size` and `total_count` (snake_case). Code that expected camelCase without the mapping boundary function caused pagination to exit after page 1 (100 items), silently truncating large collections.

2. **Prices are opt-in:** Without `?include=prices`, the `variants[].prices` array is empty. Including prices increases payload size and costs the same 1 credit, but it's recommended to omit when you don't need pricing.

3. **Max page_size is 100:** Cannot request more than 100 items per page. Sets with 200+ cards and the full expansion list (406+ sets) require multi-page fetching.

4. **Image URLs — don't assume patterns:** The vendor docs explicitly warn not to hardcode URL patterns. Always consume URLs as returned in the API response.

5. **Japanese translations are incomplete:** Not all fields are guaranteed to have `translation.en` values. Build fallback logic.

6. **Release date format:** `YYYY/MM/DD` (with slashes, not dashes).

7. **`casing` query parameter:** The API supports a `?casing=camel` parameter that could return camelCase responses natively. PCPC does not use this — we handle the conversion ourselves in `mapPaginatedResponse()` and the mapping helper functions. This is a conscious decision for explicit control over the boundary.

8. **Credit usage for images:** Consuming images from `images.scrydex.com` does **not** cost API credits.

9. **Usage endpoint lag:** The `/account/v1/usage` endpoint is updated every 20-30 minutes, not in real-time.

10. **`?select=` is top-level only:** Dot notation does not work for selecting nested fields. You cannot do `?select=variants.name` to get only variant names — you must select the entire `variants` field or nothing.

11. **`?select=` and `?include=prices` interaction:** The `variants` field must be in the `?select=` list for `?include=prices` to have any effect. If you select `id,name` with `include=prices`, no pricing data is returned.

12. **`?include=prices` scope:** Only supported on card, sealed, and listing endpoints. Expansions do not support `?include=` because they have no pricing data.

---

## 13. Endpoints NOT Used by PCPC (with planned issues)

These exist in the Scrydex API. Some have planned PCPC features:

- **Sealed products:** `/pokemon/v1/sealed`, `/pokemon/v1/expansions/{id}/sealed` — full CRUD with same patterns as cards. **Planned: Issue #26.**
- **Price history:** `/pokemon/v1/cards/{id}/price_history` — 3 credits per request. Could be used for historical charts. **Planned: Issue #23.**
- **Card search:** `/pokemon/v1/{lang}/cards/search` — Lucene-like search across all sets. Service method exists but no UI. **Planned: Issue #20.**
- **Listings UI:** Service method exists for `/cards/{id}/listings` but not exposed in UI. **Planned: Issue #21.**
- **Image analysis:** Coming soon per vendor docs.
- **Webhooks:** Coming soon per vendor docs — will enable event-driven cache invalidation.
- **`?casing=camel`:** Available but we handle casing conversion ourselves.
- **`?select=` field filtering:** Available, planned for card list fetches. **Planned: Issue #19.**
- **`?orderBy=` server-side sorting:** Available on list/search endpoints, not currently used. Could complement client-side sorting.

---

## 14. File Reference

| File | Role |
|------|------|
| `src/lib/server/config.ts` | Loads env vars (`SCRYDEX_API_KEY`, `SCRYDEX_TEAM_ID`, `SCRYDEX_API_BASE_URL`) |
| `src/lib/server/services/scrydexApi.ts` | Scrydex API client, casing boundary, retry logic, in-memory cache |
| `src/lib/server/models/types.ts` | Server-side types (camelCase) |
| `src/lib/types.ts` | Frontend types (camelCase) |
| `src/lib/services/api.ts` | Frontend API client (calls SvelteKit routes, not Scrydex directly) |
| `src/lib/services/db.ts` | IndexedDB client-side cache |
| `src/lib/server/services/cosmosDb.ts` | Cosmos DB server-side cache |
| `src/routes/api/sets/` | SvelteKit route handlers for set endpoints |
| `src/routes/api/sets/[set_id]/cards/` | SvelteKit route handlers for cards-in-set |
| `src/routes/api/cards/` | SvelteKit route handlers for card detail |
| `.env.example` | Template for required env vars |
| `docs/vendors/scrydex/raw/` | Raw vendor documentation (source of truth for API behavior) |
