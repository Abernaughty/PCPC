# PCPC Pricing Page Redesign — Design Spec

**Date:** March 17, 2026
**Branch:** `feature/redesign`
**Repo:** `Abernaughty/maber-web` -> `apps/pcpc`
**Stack:** SvelteKit 2 . Svelte 5 . TailwindCSS 4 . TypeScript 5 . adapter-vercel
**Theme:** Dark-mode-first (light mode deferred)
**Status:** ALL 11 STEPS COMPLETE — ready for merge to main
**Tracking:** [GitHub Issue #2](https://github.com/Abernaughty/maber-web/issues/2) — source of truth for progress and decisions

> **Note:** This file contains the detailed design spec. For implementation progress, gate results, and decision log, see [Issue #2](https://github.com/Abernaughty/maber-web/issues/2).

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

(Sections 1-9 and 10.1-11 unchanged from previous version — see git history for full spec)
