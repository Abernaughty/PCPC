# PCPC Pricing Page Redesign — Design Spec

**Date:** March 17, 2026
**Branch:** `feature/redesign`
**Repo:** `Abernaughty/maber-web` → `apps/pcpc`
**Stack:** SvelteKit 2 · Svelte 5 · TailwindCSS 4 · TypeScript 5 · adapter-vercel
**Theme:** Dark-mode-first (light mode deferred)

---

## 1. Design direction — "Elevated dark"

A layered dark palette with three surface levels that create depth without harsh contrast. Brand identity comes through warm accents rather than literal Pokémon brand colors on every element.

### Color system

| Token | Value | Usage |
|-------|-------|-------|
| `--surface-0` | `#0d0f14` | Deepest layer: page bg, footer |
| `--surface-1` | `#12141b` | Main content area |
| `--surface-2` | `#1a1d28` | Elevated cards, inputs, hero price |
| `--text-primary` | `#e8eaef` | Headings, card names |
| `--text-secondary` | `#d7dee3` | Body text, price values |
| `--text-muted` | `#6b7280` | Labels, metadata |
| `--text-dim` | `#4b5563` | Timestamps, ranges |
| `--text-faint` | `#374151` | Borders, least important text |
| `--accent-red` | `#e8453c` | Primary button, active states |
| `--accent-red-dark` | `#d63a31` | Button hover |
| `--price-green` | `#4ade80` | Market price, positive trends |
| `--price-red` | `#f87171` | Negative trends |
| `--badge-en-bg` | `rgba(59,130,246,0.1)` | English language badge |
| `--badge-en-text` | `#60a5fa` | English badge text |
| `--badge-jp-bg` | `rgba(232,69,60,0.1)` | Japanese language badge |
| `--badge-jp-text` | `#f09595` | Japanese badge text |
| `--border-subtle` | `rgba(255,255,255,0.06)` | Card borders, dividers |
| `--border-faint` | `rgba(255,255,255,0.03)` | Table row separators |

### Typography

- Font: system stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`)
- Scale: 10px (micro labels), 11px (badges/metadata), 12px (body/prices), 13px (secondary), 16px (section heads), 18-20px (card name), 28-32px (hero price)
- Weights: 400 (body), 500 (headings, emphasis)
- Letter-spacing: -0.3px on headings, 0.5px on uppercase labels

### Spacing & radius

- Card radius: 10-12px
- Input radius: 6-7px
- Badge/pill radius: 4-6px
- Section padding: 16-24px
- Component gaps: 6-8px (tight), 14-16px (standard), 20-24px (sections)

---

## 2. Page layout — Before & after selection

### Before selection (search state)

```
┌─ Header ─────────────────────────────────┐
│ [PC] PCPC price checker        [🔗] [🌙] │
├─ Search bar ─────────────────────────────┤
│ Set: [____________ EN]  Card: [________]  │
│                                [Get price]│
├─ Recent lookups ─────────────────────────┤
│ [🃏 Charizard ex] [🃏 Mew ex] [🃏 Eevee] │
└──────────────────────────────────────────┘
```

### After selection (results state)

```
┌─ Header ─────────────────────────────────┐
├─ Search bar (collapsed/persistent) ──────┤
├─ Recent lookups ─────────────────────────┤
├─ Results ────────────────────────────────┤
│ ┌──────────┐  Card Name                  │
│ │          │  Set · Code · Artist         │
│ │  Card    │  ┌─ Hero Price ────────────┐ │
│ │  Image   │  │ $82.49  NM  ▲ 8.2% 30d │ │
│ │          │  │ Updated today · Scrydex  │ │
│ │          │  └─────────────────────────┘ │
│ ├──────────┤                              │
│ │ [SAR]    │  [Normal][Holofoil][Rev...]→  │
│ │ [Fire]   │                              │
│ │ [#223]   │  Raw prices by condition     │
│ │ [EN]     │  NM    $82.49  $74-$92       │
│ └──────────┘  LP    $68.20  $60-$78       │
│               MP    $51.75  $44-$59       │
│               HP    $34.50  $28-$41       │
│                                           │
│               Graded prices               │
│               [PSA 10] [PSA 9] [CGC 10]   │
│               [CGC 9.5][BGS 10][BGS 9.5]  │
│                                           │
│               🔗 Copy link · ↗ Share      │
└──────────────────────────────────────────┘
```

### Mobile (< 768px)

- Card image + meta stack above card details (centered, 200px wide)
- Variant pills remain horizontal-scrollable
- Grade cards: 2-column grid instead of 3
- Search fields stack vertically

---

## 3. Component architecture

The current monolithic `+page.svelte` (18KB, 250+ lines CSS) should be decomposed into:

| Component | Responsibility |
|-----------|---------------|
| `SearchForm.svelte` | Set picker, card picker, get price button, search row layout |
| `RecentLookups.svelte` | Horizontal strip of recent card chips with thumbnails |
| `CardDetailPanel.svelte` | Image + meta chips sidebar |
| `PricingPanel.svelte` | Hero price, variant pills, raw table, graded grid, share links |
| `HeroPrice.svelte` | Large price display with trend indicator and metadata |
| `VariantPills.svelte` | Horizontal-scrollable variant selector with availability dots |
| `PriceTable.svelte` | Raw prices table with clickable/copyable values |
| `GradedPriceGrid.svelte` | Grade cards with colored company badges |
| `SearchableSelect.svelte` | Enhanced existing — add language badges, set symbol, release dates |
| `CardSearchSelect.svelte` | Enhanced existing — add thumbnails, rarity dots, sort toggles |
| `ImageLightbox.svelte` | Full-size card image overlay on click |
| `Toast.svelte` | Clipboard copy feedback notification |
| `SkeletonLoader.svelte` | Animated placeholder shapes for loading states |

---

## 4. Set dropdown redesign

### Data source

`SearchableSelect` receives `groupedSetsForDropdown` from `setsStore`.

### Grouping

Sets grouped by expansion era using `series` field from Scrydex API (same as today).

### Sorting — CHANGED

**Remove the hardcoded `EXPANSION_ORDER` array entirely** from `expansionMapper.ts`.

Replace with dynamic chronological sorting:

1. Sort sets within each group by `releaseDate` descending (newest first)
2. Sort groups by the newest `releaseDate` among their sets (newest expansion first)
3. Group header shows date range: `"2023 – present"` (derived from min/max `releaseDate`)

### Item display (each set row)

```
[SYM]  Set Name                    [EN]
       CODE · 230 cards · Aug 2023
```

- **Set symbol**: 20×20px from `PokemonSet.symbol` URL, fallback to text abbreviation
- **Set name**: Primary text, 12px
- **Language badge**: `EN` (blue) or `JP` (red) inline with name, from `PokemonSet.languageCode`
- **Subtitle**: Set code + card count (`cardCount` or `total`) + release date (`releaseDate` formatted to "Mon YYYY")
- **Active state**: Left red border accent on selected set

### Japanese set names

- Display **English translation only** — no Japanese characters shown
- `JP` badge communicates the language/market
- Search matches against both translated name and set code

### Group headers

```
SCARLET & VIOLET                 2023 – present
```

- Sticky positioning while scrolling
- Expansion name + date range

---

## 5. Card dropdown redesign

### Sort options

Three-way toggle bar above the card list:

| Mode | Logic |
|------|-------|
| `By #` (default) | Sort by `card.number` ascending |
| `By name` | Alphabetical by `card.name` |
| `By rarity` | Rarest first (SAR > UR > Full Art > Holo Rare > Rare > Uncommon > Common) |

### Item display (each card row)

```
[THUMB]  [●] Card Name
         #001/197
```

- **Thumbnail**: 22×30px from `PokemonCard.images[0].small`, lazy-loaded (`loading="lazy"`)
- **Rarity dot**: 6px colored circle from `PokemonCard.rarity`
  - Gray: Common
  - Green: Uncommon
  - Blue: Rare
  - Purple: Holo Rare
  - Gold: Ultra Rare
  - Pink: Full Art
  - Gradient (gold→pink): Special Art Rare
- **Card name**: 12px
- **Card number**: `#number/printedTotal` format, 10px muted
- **Active state**: Left red border accent on selected card

### Rarity legend

Small legend row at the bottom of the dropdown showing dot colors → rarity names.

### Performance

- Virtual scrolling for sets with 200+ cards (only render visible rows)
- `IntersectionObserver` for lazy-loading thumbnails

---

## 6. Results section

### Card detail panel (left sidebar)

- Card image: 180px wide, rounded corners, subtle radial glow effect underneath
- Click-to-zoom: Shows lightbox with large image
- Hover state: "🔍 Zoom" indicator overlay
- Meta chips below image: rarity (pink accent), type, card number, language badge

### Hero price callout

```
┌──────────────────────────────────────┐
│ MARKET PRICE                         │
│ $82.49   [Near Mint]   [▲ 8.2% 30d] │
│ ● Updated today · Scrydex · Holofoil│
└──────────────────────────────────────┘
```

- Price: 28-32px, green (`--price-green`), clickable to copy
- Condition badge: muted pill showing NM/LP/etc
- **Trend indicator**: Uses existing `PriceTrends` data from `VariantPrice.trends`
  - Green pill with ▲ for positive % change
  - Red pill with ▼ for negative % change
  - Show 30-day trend by default (`trends.days30`)
- Live dot: green dot + "Updated today" + source
- Variant name shown in metadata line

### Variant pills

Horizontal-scrollable pill bar (not tabs):

```
[● Normal] [● Holofoil] [● Reverse holo] [● Pokeball holo] [● Masterball holo] [○ Crown rare] →
```

- Each pill: 6-12px, 6px rounded, border on active
- Green dot (●): variant has pricing data (`variant.prices.length > 0`)
- Gray dot (○): no pricing data available
- Active pill: elevated background + red border accent
- Scrollable with fade hint on right edge when overflowing
- Selecting a variant updates: hero price, raw table, graded grid

### Raw prices table

| Column | Content |
|--------|--------|
| Condition | NM, LP, MP, HP |
| Market | Price value, clickable to copy, highlights green on hover |
| Range | Low – High in muted text |

- From `pricingStore.getRawPrices(variant)`
- Table uses 0.5px row separators

### Graded prices grid

3-column grid of grade cards:

```
┌──────────┐
│ [PSA 10] │  ← Company badge (colored)
│  $245.00 │  ← Price (clickable to copy)
│ $220–$280│  ← Range
└──────────┘
```

- Badge colors per company:
  - PSA: blue (`rgba(59,130,246,...)`)
  - CGC: purple (`rgba(139,92,246,...)`)
  - BGS: gold (`rgba(234,179,8,...)`)
- From `pricingStore.getGradedPrices(variant)`

### Empty variant state

When a variant has no pricing data:

```
       ∅
No pricing data available for this variant yet.
This variant may be too new or not widely traded.
```

### Share row

```
🔗 Copy link · ↗ Share
```

- Copy link: copies deep link URL to clipboard
- Share: opens native share sheet (or copies on desktop)

---

## 7. QOL features

### 7.1 Price trend indicators

**Source**: `VariantPrice.trends` (already in type system, unused in UI)

Display a colored pill next to the hero price:
- `▲ 8.2%` green for positive 30d change
- `▼ 3.1%` red for negative 30d change
- Derived from `trends.days30.percentChange`

### 7.2 Tap-to-copy prices

Every price value in the UI is clickable:
- Hero price, raw table cells, graded card prices
- On click: copy value to clipboard, show toast "Copied $82.49"
- Visual feedback: brief green color flash on the value

### 7.3 Recent lookups

- Strip of horizontal chips below the search bar
- Each chip: tiny card thumbnail (18×25px) + card name
- Stored in `localStorage` (last 8-10 lookups)
- Key format: `pcpc_recent_lookups`
- Value: `[{setId, cardId, name, imageUrl}]`
- Clicking a chip re-selects the set + card and fetches pricing

### 7.4 Card image lightbox

- Click card image → full-screen overlay with large image
- Uses `PokemonCard.images[0].large` URL
- Close on click outside, Escape key, or X button
- Dark backdrop with blur

### 7.5 Deep linking

- When card is selected, update URL to: `/cards/{setId}/{cardId}?variant={variantName}`
- Uses SvelteKit's `goto()` with `replaceState`
- The `/cards` route directory already exists (currently empty)
- Visiting a deep link URL loads the card directly
- "Copy link" action copies this URL

### 7.6 Skeleton loading states

Replace text-based loading indicators with animated placeholder shapes:

- Set dropdown loading: 3 shimmer rows matching set item layout
- Card dropdown loading: 5 shimmer rows matching card item layout
- Pricing loading: shimmer hero price block + shimmer table rows
- Animation: subtle left-to-right gradient sweep

### 7.7 Set logo/symbol

- Display the set symbol (`PokemonSet.symbol` URL) as a 20×20px image next to set names
- Shown in: set dropdown items, results section set name
- Fallback: text abbreviation of expansion code in a styled box

---

## 8. Data model notes

### Existing fields used (no API changes needed)

| Field | Type | Used for |
|-------|------|----------|
| `PokemonSet.releaseDate` | `string?` | Chronological sorting |
| `PokemonSet.languageCode` | `string?` | EN/JP badges |
| `PokemonSet.language` | `string?` | Fallback language detection |
| `PokemonSet.symbol` | `string?` | Set symbol image |
| `PokemonSet.logo` | `string?` | Set logo (if needed) |
| `PokemonSet.cardCount` | `number?` | Card count display |
| `PokemonSet.total` | `number?` | Fallback card count |
| `PokemonCard.images` | `CardImage[]?` | Thumbnails, lightbox |
| `PokemonCard.rarity` | `string?` | Rarity dots |
| `PokemonCard.artist` | `string?` | Card info metadata |
| `VariantPrice.trends` | `PriceTrends?` | Trend indicators |
| `VariantPrice.currency` | `string` | JPY vs USD formatting |

### Translation requirement

Japanese set names need English translations. Check if Scrydex API provides an English name field for JP sets. If not, maintain a lightweight client-side translation map.

---

## 9. Files to modify

| File | Action |
|------|--------|
| `apps/pcpc/src/app.css` | Overhaul dark theme variables to new palette |
| `apps/pcpc/src/routes/+page.svelte` | Decompose into components, new layout |
| `apps/pcpc/src/lib/components/SearchableSelect.svelte` | Add language badges, set symbols, release dates, two-line items |
| `apps/pcpc/src/lib/components/CardSearchSelect.svelte` | Add thumbnails, rarity dots, sort toggles |
| `apps/pcpc/src/lib/services/expansionMapper.ts` | Remove `EXPANSION_ORDER`, implement date-based sorting |
| `apps/pcpc/src/lib/stores/pricing.svelte.ts` | No changes needed — already has variant/trend support |
| `apps/pcpc/src/lib/stores/sets.svelte.ts` | Minor: ensure `releaseDate` sort in `loadSets` |

### New files to create

| File | Purpose |
|------|--------|
| `apps/pcpc/src/lib/components/CardDetailPanel.svelte` | Image + meta chips sidebar |
| `apps/pcpc/src/lib/components/PricingPanel.svelte` | All pricing display logic |
| `apps/pcpc/src/lib/components/HeroPrice.svelte` | Hero price with trend |
| `apps/pcpc/src/lib/components/VariantPills.svelte` | Scrollable variant selector |
| `apps/pcpc/src/lib/components/PriceTable.svelte` | Raw prices table |
| `apps/pcpc/src/lib/components/GradedPriceGrid.svelte` | Graded price cards |
| `apps/pcpc/src/lib/components/RecentLookups.svelte` | Recent lookup chips |
| `apps/pcpc/src/lib/components/ImageLightbox.svelte` | Full-size image overlay |
| `apps/pcpc/src/lib/components/Toast.svelte` | Copy feedback notification |
| `apps/pcpc/src/lib/components/SkeletonLoader.svelte` | Loading placeholders |
| `apps/pcpc/src/lib/components/SearchForm.svelte` | Search bar composition |
| `apps/pcpc/src/routes/cards/[set_id]/[card_id]/+page.svelte` | Deep link route |

---

## 10. Implementation order

1. **Theme overhaul** — Update `app.css` with new dark palette variables
2. **Expansion mapper refactor** — Replace hardcoded order with date-based sorting
3. **Set dropdown enhancement** — Language badges, set symbols, release dates, chronological sort
4. **Card dropdown enhancement** — Thumbnails, rarity dots, sort toggles
5. **Component extraction** — Break `+page.svelte` into components (start with `SearchForm`)
6. **Hero price + variant pills** — Core pricing display with trend indicators
7. **Price table + graded grid** — Pricing detail components
8. **QOL features** — Tap-to-copy, recent lookups, skeleton loaders
9. **Deep linking** — Card detail route + URL state management
10. **Image lightbox** — Full-size card image overlay
11. **Mobile responsive pass** — Verify all breakpoints

---

## 10.1 Testing gates between implementation steps

Every step must pass two checks before moving to the next:

### Gate 1: Build check

Vercel preview deploy must succeed (runs `pnpm build` for `apps/pcpc`). This catches TypeScript errors, missing imports, and broken Svelte compilation. Verify by confirming the preview URL loads without a build error page.

### Gate 2: Smoke test — full user flow

Manually walk through the core flow on the Vercel preview (or locally):

1. Page loads without console errors
2. Set dropdown opens and populates
3. Selecting a set loads cards into the card dropdown
4. Card dropdown opens and populates
5. "Get Price" button fetches and displays pricing
6. No visual regressions in areas not touched by the current step

### Step-specific checks

| Step | Additional verification |
|------|------------------------|
| 1. Theme overhaul | All text is readable (no white-on-white or invisible elements). Buttons, inputs, dropdowns, and results all use the new palette. No remnant light-mode artifacts. |
| 2. Expansion mapper | Sets appear in chronological order (newest first). All expansion groups are present. No sets missing or duplicated. |
| 3. Set dropdown | Language badges (EN/JP) render correctly. Set symbols load (or show fallback). Subtitle line shows code + card count + date. Search still filters. |
| 4. Card dropdown | Thumbnails load for at least the first ~20 visible cards. Rarity dots show correct colors. All three sort modes (By #, By name, By rarity) reorder the list correctly. |
| 5. Component extraction | This is the highest-risk step. After decomposing `+page.svelte`, re-run the *full* smoke test twice. Verify: search form, error display, card details, pricing section, and variant selector all still render and function identically to pre-extraction. |
| 6. Hero price + variants | Hero price displays the correct value for the selected variant. Trend pill shows direction and percentage. Switching variant pills updates the hero price. |
| 7. Price table + graded | Raw prices table shows NM/LP/MP/HP rows with market + range. Graded grid shows PSA/CGC/BGS cards with correct badge colors. Empty variants show the empty state message. |
| 8. QOL features | Tap any price → clipboard contains the value, toast appears. Recent lookups strip appears after first lookup, persists on reload (check localStorage). Skeleton loaders show during API fetches (throttle network in DevTools to verify). |
| 9. Deep linking | After selecting a card, URL updates to `/cards/{setId}/{cardId}`. Copy that URL, open in a new tab → card loads directly with pricing. Back button works. |
| 10. Image lightbox | Click card image → lightbox opens with large image. Close via: click outside, Escape key, X button. No scroll bleed to page behind. |
| 11. Mobile responsive | Resize to <768px: card image stacks above details, search fields stack vertically, variant pills scroll horizontally, graded grid becomes 2-column. Test on at least one real mobile device or Chrome DevTools device mode. |

### Regression policy

If a step introduces a regression caught by the smoke test:
- Fix the regression before proceeding to the next step
- If the fix is non-trivial, commit it as a separate "fix:" commit for clear git history
- Do not batch fixes across multiple steps

---

## 11. Open issues (not in scope for this redesign)

These remain separate tasks:

- **Issue #3**: Duplicate API calls — still open
- **Issue #4**: Excessive IndexedDB writes (100 individual ops per card load) — still open
- **Issue #5**: "No cards found" text persists — still open
