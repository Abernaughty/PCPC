# PCPC v7 Visual Personality & Pricing Redesign Spec

**Date:** March 20, 2026
**Branch:** `feature/redesign`
**Context:** Issue #12C — Visual personality pass
**Status:** Spec finalized, implementation pending

---

## 1. Design System Changes

### Font
- **Geist** from Google Fonts (`https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600`)
- Replaces system stack for all text
- Import via `<link>` in `app.html`

### Background
- Dot grid pattern on `body::before`
- `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)`
- `background-size: 24px 24px`
- Fixed position, pointer-events none

### Color System Updates
- All existing CSS custom properties remain
- New additions:
  - `--sgc-green: #34d399` (SGC grading company)
  - `--sgc-dim: rgba(52, 211, 153, 0.1)`
  - Per-condition chart colors: NM=#4ade80, LP=#60a5fa, MP=#a78bfa, HP=#fbbf24, DM=#f87171

### Header
- Text: `PCPC / price checker` — slash in `--text-dim` color
- Font: 17px, weight 600, letter-spacing -0.4px
- Border: 0.5px solid `--border` bottom only
- **No glow, no gradient, no icon** — confidence through typography

### Borders
- 0.5px everywhere (hairline)
- Specular gradient highlights (`::before` pseudo with gradient) ONLY on:
  - Results card top edge (white/neutral)
  - Graded price card top edges (company-colored)
  - Hero price top edge (trend-colored: green/red/neutral)

### Card Image Area
- **Ambient glow underneath:** Blurred radial glow (16px blur, 50% opacity) positioned below card
- Glow color by rarity: SAR = gold-to-pink gradient, Rare = blue, Holo = purple, Common = neutral
- **Empty state:** Pokeball-inspired card-back design (radial gradient purple bg, centered orb)
- **Zoom overlay on hover:** Semi-transparent backdrop with "Zoom" label

### Meta Chips
- Replace the `card-info-grid` (uniform gray boxes with blue left border)
- Compact inline pills with per-field accent colors:
  - Rarity: pink accent + rarity dot
  - Set code: neutral
  - Card number: neutral
  - Language: blue accent for EN, red for JP
  - Artist: neutral

---

## 2. Hero Price Block

- **Compact layout:** No embedded chart
- Market price (28px, weight 600)
- Condition badge (pill, neutral bg)
- Trend badge (pill, colored: green up / red down / neutral flat)
- Live dot (5px, pulsing animation, trend-colored)
- Footer: "Updated [date] · Scrydex · [variant]"
- **Dynamic `::before` glow:** Changes color based on 30d trend direction
  - Up: `rgba(74, 222, 128, 0.2)` (green)
  - Down: `rgba(248, 113, 113, 0.2)` (red)
  - Flat: `rgba(255, 255, 255, 0.06)` (neutral)

---

## 3. Three-Tier Pricing Layout

### Tier 1 — Price Cards (scan)

Same card design for BOTH raw conditions and graded grades.

Each card contains:
- **Label:** Condition code (NM/LP/etc.) or grade (10/9/etc.)
- **Market price:** Prominent, clickable (copies to clipboard with toast)
- **Mini sparkline:** Canvas-rendered, full 180d, colored by overall trend direction
- **Percent change badge:** Colored pill (green/red/neutral)
- **"Detail" link:** Small text link that toggles the Tier 2 expandable chart

**Raw section:**
- Cards in a horizontal row: NM, LP, MP, HP, DM (or whichever conditions the API returns)
- Responsive: wrap to 2-3 per row on mobile

**Graded section:**
- Company toggle pills at top: PSA, CGC, BGS, SGC (with company-colored dots)
- Grade cards in a row for the active company
- Switching company swaps the grade cards

### Tier 2 — Expandable Detail Chart (investigate)

- Triggered by clicking "Detail" on any price card
- **Slides open** below the card row with smooth animation (200-300ms ease-out)
- **Only one open at a time** — opening a new detail closes the previous
- Contains a full-width Chart.js line chart:
  - Single line for the selected condition/grade
  - X-axis: 180d ago, 90d ago, 30d ago, 14d ago, 7d ago, 1d ago, Now
  - Hoverable with tooltip showing:
    - Price at that time point
    - Dollar change from that point to now
    - Percent change from that point to now
  - Line color matches trend direction (green/red/neutral)
  - Subtle fill gradient below the line
- Close via: clicking "Detail" again, or clicking a different card's "Detail"

### Tier 3 — Compare Section (analyze)

- **Collapsible section** at the bottom of the pricing area
- Header: "Compare trends" with expand/collapse toggle
- Defaults to collapsed

When expanded:
- **Segmented control:** `[Raw] [Graded]`
- **Raw mode:** Multi-select condition chips (NM/LP/MP/HP/DM)
  - Each condition has its own color from the palette
  - Default: NM selected
- **Graded mode:** Company pills (PSA/CGC/BGS/SGC) → then multi-select grade chips
  - **Luminance stepping** for grades within a company (no dashed lines):
    - Highest grade: full company color
    - Next grade: lighter shade
    - Next: lightest shade
  - Default: highest grade selected
- **Chart:** Full-width Chart.js multi-line overlay
  - Hover crosshair tooltip shows ALL selected lines' values at that time point
  - Each tooltip line shows: label, price, dollar change, percent change from that point
- **Legend below chart:** Per selected line: `[color dot] Label  $price  +/-X.X%`
  - No start→end range — just current price and total % change

---

## 4. Data Model

### Price Table Columns
- Raw: Condition → Market → Low
- Graded: Grade → Market → Low
- **Low (not Range)** — the API provides `low` and `market`, no `high` for raw prices

### Historical Price Reconstruction
```
price_at_N_days_ago = current_market - trends.daysN.priceChange
```
This yields 7 data points: 180d, 90d, 30d, 14d, 7d, 1d, Now

### Trend Direction Logic
```ts
function dir(pct: number): 'up' | 'down' | 'flat' {
  return pct > 0.01 ? 'up' : pct < -0.01 ? 'down' : 'flat';
}
```

### Sparkline Color Logic
- Per-row sparklines: colored by that row's overall trend direction (green/red/gray)
- Compare chart lines: colored by identity (condition color or company luminance step)

---

## 5. New Components

| Component | Responsibility |
|-----------|---------------|
| `PriceCard.svelte` | Individual price card: label, market price, sparkline, %, copy action, detail toggle |
| `PriceDetailChart.svelte` | Expandable 180d single-line Chart.js chart with hover tooltips |
| `CompareChart.svelte` | Multi-line overlay Chart.js chart with segmented control + filter chips |
| `TrendSparkline.svelte` | Lightweight canvas sparkline component (reusable) |

### Modified Components
| Component | Changes |
|-----------|--------|
| `PricingPanel.svelte` | Orchestrate three-tier layout, replace current table-based display |
| `CardDetailPanel.svelte` | Replace info-grid with meta chips |
| `+page.svelte` | Import Geist font, update header markup |
| `app.css` | Add dot grid background, Geist font-family, new CSS variables |
| `app.html` | Add Geist font `<link>` preconnect + import |

---

## 6. Implementation Order

1. **Design system:** app.css + app.html (Geist font, dot grid, new variables)
2. **Header:** Update `+page.svelte` header markup and styles
3. **Meta chips:** Refactor `CardDetailPanel.svelte`
4. **Empty state:** Card-back design, ghosted pricing skeleton
5. **Hero price:** Compact layout with dynamic glow
6. **TrendSparkline component:** Canvas sparkline, reusable
7. **PriceCard component:** Card with sparkline, %, copy, detail toggle
8. **PriceDetailChart:** Expandable Chart.js with hover
9. **Tier 1+2 integration:** Wire PriceCards + expandable detail into PricingPanel
10. **CompareChart:** Multi-line chart with filters + legend
11. **Tier 3 integration:** Collapsible compare section at bottom
12. **Gate 1+2 testing**

---

## 7. External Dependencies

- **Chart.js 4.4.x** — CDN import for trend charts (or npm install)
- **Geist font** — Google Fonts import
- No other new dependencies

---

## 8. Mockups

- `pcpc_mockup_v6.html` — Interactive HTML mockup with tiered filter comparison chart
- v7 extends v6 with the three-tier card layout (Tier 1 cards + Tier 2 expandable + Tier 3 compare)
- All mockups use real Tyranitar ex (sv3-66) data from Scrydex API
