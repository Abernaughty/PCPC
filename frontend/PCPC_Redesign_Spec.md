# PCPC Pricing Page Redesign — Design Spec

**Date:** March 17, 2026
**Branch:** `feature/redesign`
**Repo:** `Abernaughty/maber-web` -> `apps/pcpc`
**Stack:** SvelteKit 2 . Svelte 5 . TailwindCSS 4 . TypeScript 5 . adapter-vercel
**Theme:** Dark-mode-first (light mode deferred)
**Status:** ALL 11 STEPS COMPLETE
**Tracking:** [GitHub Issue #2](https://github.com/Abernaughty/maber-web/issues/2) — source of truth for progress and decisions

> **Note:** This file contains the detailed design spec. For implementation progress, gate results, and decision log, see [Issue #2](https://github.com/Abernaughty/maber-web/issues/2).

---

## 1. Design direction — "Elevated dark"

A layered dark palette with three surface levels that create depth without harsh contrast. Brand identity comes through warm accents rather than literal Pokemon brand colors on every element.

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

### Spacing and radius

- Card radius: 10-12px
- Input radius: 6-7px
- Badge/pill radius: 4-6px
- Section padding: 16-24px
- Component gaps: 6-8px (tight), 14-16px (standard), 20-24px (sections)

---

## 2. Page layout — Before and after selection

### Before selection (search state)

```
+- Header ------------------------------------+
| [PC] PCPC price checker        [link] [moon]|
+- Search bar --------------------------------+
| Set: [____________ EN]  Card: [________]     |
|                                [Get price]   |
+- Recent lookups ----------------------------+
| [card Charizard ex] [card Mew ex] [card Eevee] |
+----------------------------------------------+
```

### After selection (results state)

```
+- Header ------------------------------------+
+- Search bar (collapsed/persistent) ---------+
+- Recent lookups ----------------------------+
+- Results -----------------------------------+
| +----------+  Card Name                     |
| |          |  Set . Code . Artist            |
| |  Card    |  +- Hero Price ---------------+ |
| |  Image   |  | $82.49  NM  up 8.2% 30d   | |
| |          |  | Updated today . Scrydex     | |
| |          |  +----------------------------+ |
| +----------+                                 |
| | [SAR]    |  [Normal][Holofoil][Rev...]->    |
| | [Fire]   |                                 |
| | [#223]   |  Raw prices by condition        |
| | [EN]     |  NM    $82.49  $0.20            |
| +----------+  LP    $68.20  $0.18            |
|               MP    $51.75  $0.15            |
|               HP    $34.50  --               |
|                                              |
|               Graded prices                  |
|               [PSA 10] [PSA 9] [CGC 10]      |
|               [CGC 9.5][BGS 10][BGS 9.5]     |
|                                              |
|               link Copy link . up-right Share |
+----------------------------------------------+
```

### Mobile (< 768px)

- Card image + meta stack above card details (centered, 200px wide)
- Variant pills remain horizontal-scrollable
- Grade cards: 2-column grid instead of 3
- Search fields stack vertically

---

## 3-9. (Sections unchanged — see git history for full spec)

---

## 10. Implementation order

1. **Theme overhaul** — Update `app.css` with new dark palette variables — DONE
2. **Expansion mapper refactor** — Replace hardcoded order with date-based sorting — DONE
3. **Set dropdown enhancement** — Language badges, set symbols, release dates, chronological sort — DONE
4. **Card dropdown enhancement** — Thumbnails, rarity dots, sort toggles — DONE
5. **Component extraction** — Break `+page.svelte` into components (start with `SearchForm`) — DONE
6. **Hero price + variant pills** — Core pricing display with trend indicators — DONE
7. **Price table + graded grid** — Pricing detail components — DONE
8. **QOL features** — Tap-to-copy, recent lookups, skeleton loaders — DONE
9. **Deep linking** — Card detail route + URL state management — DONE
10. **Image lightbox** — Full-size card image overlay — DONE
11. **Mobile responsive pass** — Verify all breakpoints — DONE

---

## 11. Open issues (not in scope for this redesign)

These remain separate tasks:

- **Issue #3**: Duplicate API calls — **FIXED** on `feature/redesign`, PR #9 open to main
- **Issue #4**: Excessive IndexedDB writes (100 individual ops per card load) — still open
- **Issue #5**: "No cards found" text persists — still open
- **Issue #10**: Card/set counts truncated at 100 (Cosmos DB stale data) — still open
- **Issue #11**: Card detail panel flashes/reloads when pricing is fetched — still open
