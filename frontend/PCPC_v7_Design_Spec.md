# PCPC v7 Visual Personality & Pricing Redesign Spec

**Date:** March 20, 2026 (final)
**Branch:** `feature/redesign`
**Context:** Issue #12C — Visual personality pass
**Status:** Spec finalized and approved. Implementation pending.
**Mockup:** `pcpc_mockup_v7_final.html`

---

## 1. Design System Changes

### Font
- **Geist** from Google Fonts (`https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600`)
- Replaces system stack for all text
- Import via `<link>` in `app.html`

### Title
- `PCPC / pokemon card price checker` — slash in `--text-dim` color
- Font: 17px, weight 600, letter-spacing -0.4px

### Background
- Dot grid pattern on `body::before`
- `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)`
- `background-size: 24px 24px`
- Fixed position, pointer-events none

### Color System Updates
- All existing CSS custom properties remain
- New additions:
  - `--amber: #c49a6c` (accent for meta chips, detail buttons, expanded borders)
  - `--amber-dim: rgba(196, 154, 108, 0.12)`
  - `--amber-border: rgba(196, 154, 108, 0.25)`
  - `--sgc-green: #34d399` (SGC grading company)
  - `--sgc-dim: rgba(52, 211, 153, 0.1)`
  - Per-condition chart colors: NM=#4ade80, LP=#60a5fa, MP=#a78bfa, HP=#fbbf24, DM=#f87171
  - Per-company graded colors: PSA=#60a5fa, CGC=#a78bfa, BGS=#fbbf24, SGC=#34d399
  - Luminance shades per company (for compare chart):
    - PSA: #60a5fa, #93c5fd, #bfdbfe
    - CGC: #a78bfa, #c4b5fd, #ddd6fe, #ede9fe, #f3f0ff, #f8f6ff
    - BGS: #fbbf24, #fcd34d, #fde68a
    - SGC: #34d399, #6ee7b7, #a7f3d0

### Header
- 0.5px solid border bottom only
- **No glow, no gradient, no icon** — confidence through typography

### Borders
- 0.5px everywhere (hairline)
- Specular gradient highlights (`::before` pseudo with gradient) ONLY on:
  - Results card top edge (white/neutral)
  - Hero price top edge (trend-colored: green/red/neutral)
- Amber border (`--amber-border`) on: meta chips, detail buttons, expanded card state, detail chart container

### Card Image Area
- **Ambient glow underneath:** Blurred radial glow (16px blur, 50% opacity) positioned below card
- Glow color by rarity: SAR = gold-to-pink gradient, Rare = blue, Holo = purple, Common = neutral
- **Empty state:** Pokéball-inspired card-back design (radial gradient purple bg, centered orb)
- **Zoom overlay on hover:** Semi-transparent backdrop with "Zoom" label

### Meta Chips
- Replace the `card-info-grid` (uniform gray boxes with blue left border)
- **Uniform amber-bordered pills** for ALL fields (`--amber-border` border, light amber bg)
- Only exception: rarity chip gets colored dot + pink text
- Fields: Rarity, Set Code, Card Number, Language, Artist

---

## 2. Hero Market Price Block

- **Price text:** Always white/neutral (`--t1`) — NOT trend-colored
- Market price (28px, weight 600)
- Condition badge (pill, neutral bg)
- Trend badge (pill, colored: green/red/gray, includes time period: "▲ 8.0% 30d")
- Live dot (5px, pulsing animation, trend-colored)
- Footer: "Updated [date] · Scrydex · [variant]"
- **Dynamic `::before` glow:** Changes color based on 30d trend direction

### Embedded 180d Chart
- Full-width Chart.js line chart inside the hero block
- **Single-color line** based on overall 180d direction (green/red/gray)
- Dashed current-price reference line with "Current: $X.XX" label
- Hoverable with tooltip: price + dollar change + percent change from each historical point
- Y-axis: suggestedMin/Max with 25% padding + 5% floor + 16px top layout padding
- Custom `currentPriceLine` Chart.js plugin draws the dashed reference line

---

## 3. Three-Tier Pricing Layout

### Tier 1 — Price Cards (scan)

Same card design for BOTH raw conditions and graded grades.

Each card contains:
- **Label:** Condition code (NM/LP/etc.) or grade (10/9/etc.)
- **Market price:** Clickable — **clicking the price copies to clipboard** with toast
- **Mini sparkline:** Canvas-rendered, **30d data only** (5 points: 30d/14d/7d/1d/Now), colored by 30d trend direction
- **Percent change badge:** Colored pill (green/red/neutral) — NO time period on badge
- **"Detail" button:** Bottom-right, amber-bordered pill, clearly visible. Toggles Tier 2.
- **Clicking the card itself** (not the price) opens/closes the detail chart

**Raw section:**
- Header: `RAW PRICES (30d)` — time period shown in lighter text on header
- Cards in a horizontal row: NM, LP, MP, HP, DM
- Responsive: wrap to 2-3 per row on mobile

**Graded section:**
- Header: `GRADED PRICES (30d)` — time period shown in lighter text on header
- Company toggle pills at top: PSA, CGC, BGS, SGC (with company-colored dots)
- Grade cards in a row for the active company
- Switching company swaps the grade cards

### Tier 2 — Expandable Detail Chart (investigate)

- Triggered by clicking card or "Detail" button
- **Slides open** below the card row with smooth animation (200-300ms ease-out)
- **Only one open at a time** per section — opening a new detail closes the previous
- Amber border on the chart container
- Contains a full-width Chart.js line chart:
  - **Full 180d data** (7 points: 180d/90d/30d/14d/7d/1d/Now)
  - **Single-color line** based on overall 180d direction (green/red/gray)
  - Dashed current-price reference line with "Current: $X.XX" label
  - Y-axis with generous padding (25% + 5% floor)
  - Hoverable tooltip: price + dollar change + percent change from that point to now
- Close via: clicking card/"Detail" again, or clicking a different card

### Tier 3 — Compare Trends (analyze)

- **Own section** inside the results card, after Graded prices
- Header: `COMPARE TRENDS (180d)` — time period in lighter text
- **Expanded by default** when card is selected
- **Segmented control:** `[Raw] [Graded]`
- **Raw mode:** Multi-select condition chips (NM/LP/MP/HP/DM)
  - Each condition has its own color from the palette
  - Default: NM selected
- **Graded mode:** Company pills (PSA/CGC/BGS/SGC) → then multi-select grade chips
  - **Luminance stepping** for grades within a company (no dashed lines)
  - Default: highest grade selected
- **Chart:** Full-width Chart.js multi-line overlay
  - Hover crosshair tooltip shows ALL selected lines
  - Each tooltip line: label, price, dollar change, percent change
- **Legend below chart:** Per selected line: `[color line] Label  $price  +/-X.X%`
  - NO time period on legend badges — header shows "(180d)"

---

## 4. Chart Specifications

### Direction (ALL charts)
- Left = oldest (180d ago), Right = newest (Now)
- Consistent across sparklines, detail charts, hero chart, and compare chart

### Small Card Sparklines (30d)
- **30d data only:** 5 points (30d ago, 14d, 7d, 1d, Now)
- Built via `build30dPts()` function
- Color: matches 30d trend direction (green/red/gray)
- Canvas-rendered, no library

### Detail & Hero Charts (180d)
- **Full 180d data:** 7 points (180d, 90d, 30d, 14d, 7d, 1d, Now)
- Built via `buildPts()` function
- **Single color** based on overall 180d direction (current vs 180d-ago price)
- Dashed current-price reference line via custom `currentPriceLine` Chart.js plugin
- Y-axis: `suggestedMin = yMin - yPad`, `suggestedMax = yMax + yPad`
  - `yPad = max(yRange * 0.25, yMax * 0.05, 0.05)`
  - `layout.padding.top = 16px` for label headroom
- Chart.js 4.4.x

### Compare Chart (180d)
- Multi-line overlay
- Raw conditions: per-condition colors (NM=#4ade80, etc.)
- Graded: luminance stepping per grade within company (full → lighter → lightest)
- No dashed lines

---

## 5. Data Model

### Price Display Columns
- Raw: Condition → Market → Low
- Graded: Grade → Market → Low
- **Low (not Range)** — API provides `low` and `market`, no `high` for raw

### Historical Price Reconstruction
```
price_at_N_days_ago = current_market - trends.daysN.priceChange
```

### Trend Direction Logic
```ts
function dir(pct: number): 'up' | 'down' | 'flat' {
  return pct > 0.01 ? 'up' : pct < -0.01 ? 'down' : 'flat';
}
```

### Pricing Data Structure (from Scrydex API)
- Raw prices: `low` + `market` only
- Graded prices: `low` + `mid` + `high` + `market`
- Both have `trends` object: `days1/7/14/30/90/180` each with `priceChange` + `percentChange`
- Conditions: NM/LP/MP/HP/DM
- Grading companies: PSA/CGC/BGS/SGC
- CGC has `isPerfect` flag for Perfect 10

---

## 6. Share Section

- Bottom of results card, after Compare Trends
- Label: `SHARE THIS CARD`
- Copy link button + Share button
- Copies deep link URL to clipboard

---

## 7. New Components

| Component | Responsibility |
|-----------|---------------|
| `PriceCard.svelte` | Card with price, sparkline, %, copy action, detail toggle |
| `PriceDetailChart.svelte` | Expandable 180d Chart.js with hover + current price line |
| `CompareChart.svelte` | Multi-line overlay Chart.js with segmented control + filter chips + legend |
| `TrendSparkline.svelte` | Lightweight canvas sparkline (30d data, reusable) |

### Modified Components
| Component | Changes |
|-----------|--------|
| `PricingPanel.svelte` | Orchestrate three-tier layout, replace current table-based display |
| `CardDetailPanel.svelte` | Replace info-grid with uniform amber-bordered meta chips |
| `+page.svelte` | Update title, import Geist font, header markup |
| `app.css` | Dot grid bg, Geist font-family, amber variables, currentPriceLine plugin styles |
| `app.html` | Geist font `<link>` preconnect + import |

---

## 8. Implementation Order

1. **Design system:** app.css + app.html (Geist font, dot grid, amber variables)
2. **Header:** Update `+page.svelte` title and header styles
3. **Meta chips:** Refactor `CardDetailPanel.svelte` (amber-bordered uniform pills)
4. **Empty state:** Card-back design, ghosted pricing skeleton
5. **Hero price:** White price text, dynamic glow, embedded 180d chart with reference line
6. **TrendSparkline component:** Canvas sparkline with 30d data
7. **PriceCard component:** Card with sparkline, %, copy, detail toggle
8. **PriceDetailChart:** Expandable Chart.js with hover + reference line
9. **Tier 1+2 integration:** Wire PriceCards + expandable detail into PricingPanel
10. **CompareChart:** Multi-line chart with filters + legend + luminance stepping
11. **Tier 3 integration:** Compare section inside results card, expanded by default
12. **Share section:** Bottom of results card with label
13. **Gate 1+2 testing**

---

## 9. External Dependencies

- **Chart.js 4.4.x** — CDN import or npm install
- **Geist font** — Google Fonts import
- No other new dependencies

---

## 10. Mockup Reference

- `pcpc_mockup_v7_final.html` — Final approved interactive HTML mockup
- All mockups use real Tyranitar ex (sv3-66) data from Scrydex API
- Iterative versions v1–v7.8 explored: gradient effects (rejected), noise textures (rejected), split-color charts (rejected in favor of single-color + reference line), table layouts (replaced by cards), and various chart configurations
