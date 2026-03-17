/**
 * Expansion Mapper - Maps Pokémon sets to their expansion era
 * Groups sets by expansion for dropdown display
 */

import type { PokemonSet, GroupedSets } from '$lib/types';
import { createContextLogger } from './logger';

const log = createContextLogger('expansionMapper');

// Expansion priority order for dropdown display
const EXPANSION_ORDER = [
  'Scarlet & Violet',
  'Sword & Shield',
  'Sun & Moon',
  'XY',
  'Black & White',
  'HeartGold & SoulSilver',
  'Call of Legends',
  'Platinum',
  'Diamond & Pearl',
  'EX',
  'Neo',
  'Gym',
  'Base Set',
  'Other',
] as const;

// Regex patterns for set codes mapping to expansions
const EXPANSION_PATTERNS: Record<string, RegExp[]> = {
  'Scarlet & Violet': [
    /^SV\d+[a-z]?$/i,
    /^sv/i,
  ],
  'Sword & Shield': [
    /^SWSH\d+$/i,
    /^s[1-9]/i,
  ],
  'Sun & Moon': [
    /^SM\d+[a-z]?$/i,
    /^us/i,
  ],
  'XY': [
    /^XY\d+$/i,
    /^xy\d+$/i,
  ],
  'Black & White': [
    /^BW\d+$/i,
    /^bw\d+$/i,
  ],
  'HeartGold & SoulSilver': [
    /^HGSS\d+$/i,
    /^hgss/i,
  ],
  'Call of Legends': [
    /^COL\d+$/i,
    /^col\d+$/i,
  ],
  'Platinum': [
    /^PL\d+$/i,
    /^pl\d+$/i,
  ],
  'Diamond & Pearl': [
    /^DP\d+$/i,
    /^dp\d+$/i,
  ],
  'EX': [
    /^EX\d+$/i,
    /^ex\d+$/i,
  ],
  'Neo': [
    /^NEO\d+$/i,
    /^neo\d+$/i,
  ],
  'Gym': [
    /^GYM\d+$/i,
    /^gym\d+$/i,
  ],
  'Base Set': [
    /^BS\d+$/i,
    /^base/i,
  ],
};

// Special case mappings for specific set codes
const SPECIAL_CASES: Record<string, string> = {
  // Scarlet & Violet special cases
  sv04: 'Scarlet & Violet',
  sv04pt: 'Scarlet & Violet',
  sv4pt: 'Scarlet & Violet',

  // Sword & Shield special cases
  swsh1: 'Sword & Shield',
  swsh2: 'Sword & Shield',
  swsh3: 'Sword & Shield',

  // Sun & Moon special cases
  sm1: 'Sun & Moon',
  usm1: 'Sun & Moon',

  // Older special cases
  bs2: 'Base Set',
  base: 'Base Set',
};

// Set name mappings for sets without codes (fallback)
const SET_NAME_MAPPINGS: Record<string, string> = {
  'Scarlet & Violet': 'Scarlet & Violet',
  'Sword & Shield': 'Sword & Shield',
  'Sun & Moon': 'Sun & Moon',
  'XY': 'XY',
  'Black & White': 'Black & White',
  'HeartGold & SoulSilver': 'HeartGold & SoulSilver',
  'Call of Legends': 'Call of Legends',
  'Platinum': 'Platinum',
  'Diamond & Pearl': 'Diamond & Pearl',
  'EX': 'EX',
  'Neo': 'Neo',
  'Gym': 'Gym',
  'Base Set': 'Base Set',

  // Abbreviations
  'S&V': 'Scarlet & Violet',
  'S & V': 'Scarlet & Violet',
  'SW&SH': 'Sword & Shield',
  'SM': 'Sun & Moon',
  'B&W': 'Black & White',
  'HGSS': 'HeartGold & SoulSilver',
  'DP': 'Diamond & Pearl',
};

const FALLBACK_EXPANSION = 'Other';

/**
 * Get expansion era for a single set.
 * Scrydex provides a `series` field directly on expansions — use it as the
 * primary grouping key when available. Falls back to code/name pattern
 * matching for any sets where series is missing or unrecognized.
 */
export function getExpansionForSet(set: PokemonSet): string {
  // Scrydex provides series directly — use it if it matches a known expansion
  if (set.series && EXPANSION_ORDER.includes(set.series as any)) {
    return set.series;
  }

  const code = set.code?.toLowerCase() || '';
  const name = set.name || '';

  // Check special cases first
  if (code in SPECIAL_CASES) {
    return SPECIAL_CASES[code];
  }

  // Try pattern matching on set code
  if (code) {
    for (const [expansion, patterns] of Object.entries(EXPANSION_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(code)) {
          log.debug(`Code "${code}" matched expansion "${expansion}"`);
          return expansion;
        }
      }
    }
  }

  // Try set name mapping
  if (name in SET_NAME_MAPPINGS) {
    return SET_NAME_MAPPINGS[name];
  }

  // If Scrydex provides a series that isn't in our known list, use it directly
  // (e.g., a new expansion era we haven't added to EXPANSION_ORDER yet)
  if (set.series) {
    log.debug(`Using Scrydex series "${set.series}" as expansion for set: ${name}`);
    return set.series;
  }

  // Fallback
  log.debug(`No expansion match for set: ${name} (code: ${code}), using fallback`);
  return FALLBACK_EXPANSION;
}

/**
 * Group sets by expansion era
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
 * Prepare grouped sets for dropdown display
 * Returns arrays in expansion priority order
 */
export function prepareGroupedSetsForDropdown(
  groupedSets: Record<string, PokemonSet[]>
): GroupedSets[] {
  const result: GroupedSets[] = [];

  // Iterate through expansions in priority order
  for (const expansion of EXPANSION_ORDER) {
    if (groupedSets[expansion]) {
      result.push({
        type: 'group',
        label: expansion,
        items: groupedSets[expansion],
      });
    }
  }

  // Add any unmapped expansions not in the order
  for (const [expansion, sets] of Object.entries(groupedSets)) {
    if (!EXPANSION_ORDER.includes(expansion as any)) {
      result.push({
        type: 'group',
        label: expansion,
        items: sets,
      });
    }
  }

  return result;
}

/**
 * Expansion mapper object - main export
 */
export const expansionMapper = {
  getExpansionForSet,
  groupSetsByExpansion,
  prepareGroupedSetsForDropdown,
  EXPANSION_ORDER,
  FALLBACK_EXPANSION,
};
