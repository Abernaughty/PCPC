# PCPC Frontend Theming Style Guide

## Overview

This style guide documents the CSS theming system for the PCPC frontend application. It is the reference for the design token catalog, usage patterns, and best practices for consistent component styling.

The current theme is the **"Elevated Dark" v7** token system. It is **dark-mode-first**; a light mode is deferred (not yet implemented). The design intent and approved token values come from `frontend/PCPC_v7_Design_Spec.md` (Issue #12C, "Visual personality pass").

**Last Updated:** June 16, 2026
**Version:** 2.0.0 (v7 "Elevated Dark")

---

## Table of Contents

1. [Design Token System](#design-token-system)
2. [Token Categories](#token-categories)
3. [Theme Switching](#theme-switching)
4. [Tailwind v4 Setup](#tailwind-v4-setup)
5. [Component Styling Patterns](#component-styling-patterns)
6. [Do's and Don'ts](#dos-and-donts)
7. [Reference Implementation](#reference-implementation)
8. [Accessibility Guidelines](#accessibility-guidelines)

---

## Design Token System

### Architecture

PCPC uses a **semantic token system** built on CSS Custom Properties (CSS variables). All tokens are defined once, under a single `:root` block, in:

```
frontend/src/app.css
```

There is no separate global stylesheet — `app.css` is the single source of truth. It is imported once at the app entry (`frontend/src/routes/+layout.svelte` / the root layout) and the tokens cascade to every component.

The hierarchy is:

```
Raw token definitions (:root in app.css)
└─> Backward-compat aliases (also :root, mapping legacy names → new tokens)
    └─> Component usage (var(--token) in .svelte <style> blocks)
```

Tokens are organized into groups: **surfaces**, **text hierarchy**, **accents**, **pricing/semantic**, **grading-company colors**, **chart colors**, **rarity colors**, **borders**, **radius/spacing**, **type scale**, **shadows**, and **transitions**.

> Note on legacy names: the old `--bg-*`, `--text-inverse`, `--color-pokemon-*`, `--shadow-light/medium/heavy`, etc. still exist, but **only as backward-compat aliases** at the bottom of `app.css` (they `var()`-reference the real v7 tokens). New code should use the v7 tokens documented below, not the aliases.

---

## Token Categories

All values below are the literal definitions from `frontend/src/app.css` (`:root`, lines 8–163).

### 1. Surfaces (three depth levels)

| Token         | Value     | Usage                                          |
| ------------- | --------- | ---------------------------------------------- |
| `--surface-0` | `#0d0f14` | Page background (deepest level), `body`        |
| `--surface-1` | `#12141b` | Containers, headers, group/section backgrounds |
| `--surface-2` | `#1a1d28` | Inputs, dropdowns, cards, elevated elements    |

### 2. Text Hierarchy

| Token              | Value     | Usage                                       |
| ------------------ | --------- | ------------------------------------------- |
| `--text-primary`   | `#e8eaef` | Primary body text, headings                 |
| `--text-secondary` | `#d7dee3` | Secondary text                              |
| `--text-muted`     | `#9ca3af` | Labels, secondary detail, placeholders icon |
| `--text-dim`       | `#7c8493` | Dimmed text, input placeholders, the title slash |
| `--text-faint`     | `#374151` | Faintest text / disabled-adjacent           |

### 3. Accents

| Token               | Value     | Usage                                |
| ------------------- | --------- | ------------------------------------ |
| `--accent-red`      | `#e8453c` | Primary accent: buttons, focus, selected indicators |
| `--accent-red-dark` | `#d63a31` | Button hover state                   |
| `--amber`           | `#c49a6c` | v7 accent: meta chips, detail buttons, expanded borders |
| `--amber-dim`       | `rgba(196, 154, 108, 0.12)` | Amber tint backgrounds |
| `--amber-border`    | `rgba(196, 154, 108, 0.25)` | Amber hairline borders |

### 4. Pricing (semantic)

| Token             | Value     | Usage                  |
| ----------------- | --------- | ---------------------- |
| `--price-green`   | `#4ade80` | Price up / positive    |
| `--price-red`     | `#f87171` | Price down / error     |
| `--price-neutral` | `#9ca3af` | Neutral / no change    |

### 5. Language Badges

| Token            | Value                      | Usage                    |
| ---------------- | -------------------------- | ------------------------ |
| `--badge-en-bg`  | `rgba(59, 130, 246, 0.1)`  | English badge background |
| `--badge-en-text`| `#60a5fa`                  | English badge text; also links / cached indicator |
| `--badge-jp-bg`  | `rgba(232, 69, 60, 0.1)`   | Japanese badge background |
| `--badge-jp-text`| `#f09595`                  | Japanese badge text      |

### 6. Borders

| Token             | Value                       | Usage                        |
| ----------------- | --------------------------- | ---------------------------- |
| `--border-subtle` | `rgba(255, 255, 255, 0.06)` | Standard hairline borders    |
| `--border-faint`  | `rgba(255, 255, 255, 0.03)` | Faintest separators          |

Borders in v7 are hairline (0.5px) by convention.

### 7. Grading-Company Colors

| Token               | Value                       | Usage          |
| ------------------- | --------------------------- | -------------- |
| `--grade-psa`       | `rgba(59, 130, 246, 0.15)`  | PSA chip bg    |
| `--grade-psa-text`  | `#60a5fa`                   | PSA text       |
| `--grade-cgc`       | `rgba(139, 92, 246, 0.15)`  | CGC chip bg    |
| `--grade-cgc-text`  | `#a78bfa`                   | CGC text       |
| `--grade-bgs`       | `rgba(234, 179, 8, 0.15)`   | BGS chip bg    |
| `--grade-bgs-text`  | `#fbbf24`                   | BGS text       |
| `--grade-sgc`       | `rgba(52, 211, 153, 0.1)`   | SGC chip bg    |
| `--grade-sgc-text`  | `#34d399`                   | SGC text       |

### 8. Chart Colors

Per-condition (`chart.js` datasets):

| Token        | Value     | Condition         |
| ------------ | --------- | ----------------- |
| `--chart-nm` | `#4ade80` | Near Mint         |
| `--chart-lp` | `#60a5fa` | Lightly Played    |
| `--chart-mp` | `#a78bfa` | Moderately Played |
| `--chart-hp` | `#fbbf24` | Heavily Played    |
| `--chart-dm` | `#f87171` | Damaged           |

Per-company graded: `--chart-psa` `#60a5fa`, `--chart-cgc` `#a78bfa`, `--chart-bgs` `#fbbf24`, `--chart-sgc` `#34d399`.

Per-company luminance shades (compare chart) are also defined, e.g. `--psa-1..3`, `--cgc-1..6`, `--bgs-1..3`, `--sgc-1..3`. See `app.css` lines 69–73 for the full set.

### 9. Rarity Colors

| Token               | Value     | Rarity                       |
| ------------------- | --------- | ---------------------------- |
| `--rarity-common`   | `#6b7280` | Common                       |
| `--rarity-uncommon` | `#4ade80` | Uncommon                     |
| `--rarity-rare`     | `#60a5fa` | Rare                         |
| `--rarity-holo`     | `#a78bfa` | Holo                         |
| `--rarity-ultra`    | `#fbbf24` | Ultra Rare                   |
| `--rarity-full-art` | `#f472b6` | Full Art                     |
| `--rarity-sar-from` | `#fbbf24` | SAR gradient start (gold)    |
| `--rarity-sar-to`   | `#f472b6` | SAR gradient end (pink)      |
| `--rarity-hyper`    | `#f59e0b` | Hyper Rare                   |

### 10. Radius & Spacing

| Token             | Value     | Usage              |
| ----------------- | --------- | ------------------ |
| `--radius-card`   | `10px`    | Cards              |
| `--radius-input`  | `6px`     | Inputs, dropdowns  |
| `--radius-badge`  | `4px`     | Badges             |
| `--radius-pill`   | `6px`     | Pills              |

Layout tokens: `--content-max-width: 1400px`, `--sidebar-width: 200px`, `--layout-gap: 24px` (these scale up at the `1800px` / `2200px` breakpoints — see lines 237–254).

### 11. Type Scale

| Token             | Value  | Usage                     |
| ----------------- | ------ | ------------------------- |
| `--fs-micro`      | `10px` | Micro labels              |
| `--fs-badge`      | `11px` | Badges, uppercase labels  |
| `--fs-body`       | `12px` | Body text                 |
| `--fs-secondary`  | `13px` | Secondary text            |
| `--fs-card-name`  | `20px` | Card name                 |
| `--fs-hero`       | `28px` | Hero price                |

These scale up at `min-width: 1800px` and `--fs-hero` shrinks to `24px` at `max-width: 768px`. The font family is **Geist** (with a system-font fallback stack).

### 12. Shadows

| Token           | Value                                | Usage              |
| --------------- | ------------------------------------ | ------------------ |
| `--shadow-sm`   | `0 1px 2px rgba(0, 0, 0, 0.3)`       | Subtle elevation   |
| `--shadow-md`   | `0 4px 12px rgba(0, 0, 0, 0.4)`      | Dropdowns, popovers |
| `--shadow-lg`   | `0 8px 24px rgba(0, 0, 0, 0.5)`      | Modals             |
| `--shadow-glow` | `0 0 40px rgba(232, 69, 60, 0.08)`   | Accent glow        |

### 13. Transitions & Focus

| Token                | Value                                                          | Usage                |
| -------------------- | -------------------------------------------------------------- | -------------------- |
| `--transition-speed` | `0.2s`                                                         | Hover/focus timing   |
| `--transition-fn`    | `ease`                                                         | Easing function      |
| `--focus-ring`       | `0 0 0 2px var(--surface-0), 0 0 0 4px rgba(232, 69, 60, 0.4)` | `box-shadow` focus ring on inputs |

---

## Theme Switching

**There is no working light/dark CSS switch today.** Document and code reality:

- `app.css` defines all tokens under a single `:root` block. There are **no `[data-theme]` selectors** anywhere in `app.css` (confirmed: 0 occurrences). The system is dark-mode-first; light mode is explicitly deferred (see the header comment in `app.css`).
- A theme store exists at `frontend/src/lib/stores/theme.svelte.ts` (re-exported from `frontend/src/lib/stores/index.ts` as `themeStore`). It tracks a `'light' | 'dark'` value, persists it to `localStorage`, reads the OS `prefers-color-scheme`, and calls `document.documentElement.setAttribute('data-theme', theme)`.
- **However, no CSS consumes that `data-theme` attribute.** Because there are no `[data-theme="..."]` rules, setting the attribute has no visual effect — the app renders the dark `:root` tokens regardless of the store's value. The store is effectively dormant theming plumbing.

Practical implication: do **not** write components that rely on a theme toggle changing colors. If a real light mode is added later, it should introduce a `[data-theme='light']` (or `@media (prefers-color-scheme: light)`) block in `app.css` that overrides the `:root` token values — at which point this section should be updated.

---

## Tailwind v4 Setup

PCPC uses **Tailwind CSS v4** in CSS-first mode (no `tailwind.config.js`):

- `frontend/package.json` pins `tailwindcss` and `@tailwindcss/vite` at `^4.1.0`.
- Tailwind is wired in as a Vite plugin in `frontend/vite.config.ts`:

  ```ts
  import tailwindcss from '@tailwindcss/vite';
  import { sveltekit } from '@sveltejs/kit/vite';
  import { defineConfig } from 'vite';

  export default defineConfig({
    plugins: [tailwindcss(), sveltekit()]
  });
  ```

- Tailwind is activated by a single line at the top of `app.css`:

  ```css
  @import 'tailwindcss';
  ```

So `app.css` does double duty: it pulls in Tailwind and defines the design tokens. Components mix Tailwind utility classes with scoped `<style>` blocks that reference the CSS variables above.

---

## Component Styling Patterns

### Pattern 1: Surfaces and text

```svelte
<style>
  .panel {
    background-color: var(--surface-1);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
  }
  .panel .meta {
    color: var(--text-muted);
    font-size: var(--fs-badge);
  }
</style>
```

### Pattern 2: Primary button (accent)

The global `button` element already uses the accent (see `app.css` lines 212–218). To match it in a custom element:

```svelte
<style>
  .button {
    background-color: var(--accent-red);
    color: #ffffff;
    border: none;
    border-radius: var(--radius-input);
    transition: background-color var(--transition-speed) var(--transition-fn);
  }
  .button:hover:not(:disabled) {
    background-color: var(--accent-red-dark);
  }
  .button:disabled {
    background-color: var(--surface-2);
    color: var(--text-dim);
    cursor: not-allowed;
  }
</style>
```

### Pattern 3: Form input with focus ring

```svelte
<style>
  .input {
    background-color: var(--surface-2);
    color: var(--text-primary);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input);
  }
  .input:focus {
    outline: none;
    border-color: var(--accent-red);
    box-shadow: var(--focus-ring);
  }
  .input::placeholder {
    color: var(--text-dim);
  }
</style>
```

### Pattern 4: Dropdown menu

```svelte
<style>
  .dropdown {
    background-color: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input);
    box-shadow: var(--shadow-md);
  }
  .group-label {
    background-color: var(--surface-1);
    color: var(--text-muted);
    font-size: var(--fs-badge);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .dropdown-item:hover {
    background-color: var(--bg-hover); /* alias → rgba(255,255,255,0.04) */
  }
  .dropdown-item.selected {
    border-left: 3px solid var(--accent-red);
  }
</style>
```

### Pattern 5: Pricing and rarity semantics

```svelte
<style>
  .price-up   { color: var(--price-green); }
  .price-down { color: var(--price-red); }
  .price-flat { color: var(--price-neutral); }

  .rarity-rare { color: var(--rarity-rare); }
  .rarity-holo { color: var(--rarity-holo); }
</style>
```

---

## Do's and Don'ts

### DO

- Use v7 tokens (`--surface-*`, `--text-*`, `--accent-*`, `--price-*`, `--grade-*`, `--rarity-*`) directly in component `<style>` blocks.
- Use `--focus-ring` for input focus states, matching the global `input:focus` rule.
- Use the type-scale tokens (`--fs-body`, `--fs-badge`, …) instead of hardcoded `px` sizes so components scale at the desktop/mobile breakpoints.
- Use the radius and shadow tokens for consistent elevation.

```css
/* CORRECT — v7 tokens */
.card {
  background-color: var(--surface-2);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-md);
}
```

### DON'T

- Don't hardcode hex/rgba colors that a token already covers.

```css
/* WRONG */
.card { background-color: #1a1d28; color: #e8eaef; }
/* CORRECT */
.card { background-color: var(--surface-2); color: var(--text-primary); }
```

- Don't reach for the backward-compat aliases (`--bg-primary`, `--color-pokemon-red`, `--shadow-light`, `--text-inverse`, …) in new code. They map to v7 tokens but exist only so legacy components keep working — prefer the real token (`--surface-0`, `--accent-red`, etc.).
- Don't write theme-toggle-dependent styling. As documented above, no CSS responds to `data-theme`, so a "light mode override" you add to a component will never trigger.

---

## Reference Implementation

### `SearchableSelect.svelte` (correct pattern)

`frontend/src/lib/components/SearchableSelect.svelte` is a good real-world example of the v7 system in use. Its scoped `<style>` block uses tokens throughout:

```svelte
<style>
  .searchable-input {
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input, 6px);
    background-color: var(--surface-2);
    color: var(--text-primary);
    font-size: var(--fs-body);
    transition: border-color var(--transition-speed, 0.2s) ease,
                box-shadow var(--transition-speed, 0.2s) ease;
  }
  .searchable-input:focus {
    outline: none;
    border-color: var(--accent-red);
    box-shadow: var(--focus-ring);
  }
  .dropdown {
    background-color: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input, 6px);
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.4));
  }
  .group-label {
    background-color: var(--surface-1);
    color: var(--text-muted);
    font-size: var(--fs-badge);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .dropdown-item { color: var(--text-primary); }
  .dropdown-item:hover,
  .dropdown-item.highlighted {
    background-color: var(--bg-hover, rgba(255, 255, 255, 0.04));
  }
  .dropdown-item.selected { border-left: 3px solid var(--accent-red); }
  .item-secondary { color: var(--text-muted); font-size: var(--fs-badge); }
</style>
```

**Key takeaways:**

1. Surfaces come from `--surface-1` / `--surface-2`; text from `--text-primary` / `--text-muted`.
2. Focus uses `border-color: var(--accent-red)` plus `box-shadow: var(--focus-ring)`, matching the global input style.
3. Radius, shadow, type-scale, and transition tokens are used (with literal fallbacks) rather than magic values.
4. The selected-row affordance is an `--accent-red` left border.

---

## Accessibility Guidelines

### Color contrast

Target WCAG AA against the dark surfaces:

- Normal text: ≥ 4.5:1
- Large text (≥ 18px / `--fs-card-name` and up): ≥ 3:1
- Interactive/non-text indicators: ≥ 3:1

`--text-primary` (`#e8eaef`) and `--text-secondary` (`#d7dee3`) clear AA on all three surface levels; `--text-dim` (`#7c8493`) and `--text-faint` (`#374151`) are intentionally low-contrast — use them only for de-emphasized, non-essential text.

### Focus states

Use the shared focus ring so keyboard focus is always visible:

```css
.interactive:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
```

### Keyboard navigation

All interactive elements must be reachable and operable by keyboard. `SearchableSelect.svelte` is the reference: it handles `ArrowUp`/`ArrowDown`/`Enter`/`Escape`, manages a highlighted index, and exposes `role="option"` with `aria-selected`.

---

**Document Version:** 2.0.0 ("Elevated Dark" v7)
**Last Updated:** June 16, 2026
**Source of truth:** `frontend/src/app.css` · **Design intent:** `frontend/PCPC_v7_Design_Spec.md`
