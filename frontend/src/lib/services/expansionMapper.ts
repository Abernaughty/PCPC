/**
 * Expansion Mapper - Maps Pokemon sets to their expansion era
 * Groups sets by expansion for dropdown display
 *
 * Sorting is fully dynamic based on releaseDate — no hardcoded
 * expansion order array. Groups and sets within groups are both
 * sorted newest-first.
 */

import type { PokemonSet, GroupedSets } from '$lib/types';
import { createContextLogger } from './logger';

const log = createContextLogger('expansionMapper');

const FALLBACK_EXPANSION = 'Other';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a releaseDate string (e.g. "2026/01/30" or "2026-01-30") into a
 * comparable timestamp. Returns 0 for missing / unparseable dates so they
 * sort to the end.
 */
function parseDateToTimestamp(dateStr?: string): number {
  if (!dateStr) return 0;
  // Normalise separators — Scrydex uses "/" but be safe with "-"
  const ts = new Date(dateStr.replace(/\//g, '-')).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Format a timestamp to "Mon YYYY" (e.g. "Aug 2023").
 * Returns empty string for missing dates.
 */
function formatMonthYear(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr.replace(/\//g, '-'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Derive a date range label for a group of sets.
 * e.g. "2023 – present" or "2019 – 2022"
 */
function getDateRangeLabel(sets: PokemonSet[]): string {
  const timestamps = sets
    .map(s => parseDateToTimestamp(s.releaseDate))
    .filter(t => t > 0);
  if (timestamps.length === 0) return '';

  const minYear = new Date(Math.min(...timestamps)).getFullYear();
  const maxYear = new Date(Math.max(...timestamps)).getFullYear();
  const currentYear = new Date().getFullYear();

  if (maxYear >= currentYear) {
    return `${minYear} – present`;
  }
  if (minYear === maxYear) {
    return `${minYear}`;
  }
  return `${minYear} – ${maxYear}`;
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Get expansion era for a single set.
 * Uses the Scrydex `series` field directly. Falls back to "Other".
 */
export function getExpansionForSet(set: PokemonSet): string {
  if (set.series) {
    return set.series;
  }

  log.debug(`No series for set: ${set.name} (code: ${set.code}), using fallback`);
  return FALLBACK_EXPANSION;
}

/**
 * Group sets by expansion era.
 */
export function groupSetsByExpansion(
  sets: PokemonSet[]
): Record<string, PokemonSet[]> {
  const grouped: Record<string, PokemonSet[]> = {};

  for (const set of sets) {
    const expansion = getExpansionForSet(set);
    if (!grouped[expansion]) {
      grouped[expansion] = [];
    }
    grouped[expansion].push(set);
  }

  return grouped;
}

/**
 * Prepare grouped sets for dropdown display.
 *
 * Sorting strategy (all dynamic, no hardcoded order):
 *  1. Sets within each group: sorted by releaseDate descending (newest first)
 *  2. Groups: sorted by the newest releaseDate among their sets (newest first)
 *  3. "Other" group always sorts last regardless of dates
 */
export function prepareGroupedSetsForDropdown(
  groupedSets: Record<string, PokemonSet[]>
): GroupedSets[] {
  const groups: GroupedSets[] = [];

  for (const [expansion, sets] of Object.entries(groupedSets)) {
    // Sort sets within group by releaseDate descending
    const sortedSets = [...sets].sort((a, b) => {
      const tsA = parseDateToTimestamp(a.releaseDate);
      const tsB = parseDateToTimestamp(b.releaseDate);
      return tsB - tsA; // newest first
    });

    const dateRange = getDateRangeLabel(sortedSets);
    const label = dateRange ? `${expansion}` : expansion;

    groups.push({
      type: 'group',
      label,
      items: sortedSets,
      dateRange,
    });
  }

  // Sort groups by newest set date descending, "Other" always last
  groups.sort((a, b) => {
    if (a.label === FALLBACK_EXPANSION) return 1;
    if (b.label === FALLBACK_EXPANSION) return -1;

    const newestA = a.items.length > 0 ? parseDateToTimestamp(a.items[0].releaseDate) : 0;
    const newestB = b.items.length > 0 ? parseDateToTimestamp(b.items[0].releaseDate) : 0;
    return newestB - newestA; // newest group first
  });

  log.info(
    `Prepared ${groups.length} expansion groups: ${groups.map(g => `${g.label} (${g.items.length})`).join(', ')}`
  );

  return groups;
}

// ---------------------------------------------------------------------------
// Utility exports (used by components for display formatting)
// ---------------------------------------------------------------------------

export { parseDateToTimestamp, formatMonthYear, getDateRangeLabel };

/**
 * Expansion mapper object - main export
 */
export const expansionMapper = {
  getExpansionForSet,
  groupSetsByExpansion,
  prepareGroupedSetsForDropdown,
  formatMonthYear,
  getDateRangeLabel,
  FALLBACK_EXPANSION,
};
