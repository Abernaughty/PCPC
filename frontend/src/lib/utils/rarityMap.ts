/**
 * Rarity mapping utility for PCPC card dropdown.
 * Maps Scrydex rarity strings to display colors and sort weights.
 *
 * Rarity strings are sourced from live Scrydex API data across all eras.
 * Keys are lowercase for case-insensitive lookup.
 *
 * Era coverage:
 *   Base/WOTC: Common, Uncommon, Rare, Rare Holo
 *   BW/XY: + Rare Ultra, Rare Secret, Rare Holo EX
 *   SM: + Rare Holo GX, Rare Rainbow
 *   SWSH: + Rare Holo V, Rare Holo VMAX, Rare Holo VSTAR, Radiant Rare
 *   SV: + Double Rare, Ultra Rare, Illustration Rare, Special Illustration Rare,
 *        Hyper Rare, ACE SPEC Rare
 */

export interface RarityInfo {
  label: string;
  color: string;
  /** Optional second color for gradient rarities (e.g. SIR) */
  colorTo?: string;
  /** Higher weight = rarer. Used for sort-by-rarity. */
  weight: number;
}

/**
 * Canonical rarity map. Keys are lowercase for case-insensitive lookup.
 * Colors reference CSS custom properties from app.css.
 *
 * Weight tiers:
 *   -1  Unknown / empty
 *    0  Common
 *    1  Uncommon
 *    2  Rare
 *    3  Holo-tier (Holo Rare, Double Rare, Promo, Radiant Rare)
 *    4  Ultra-tier (Ultra Rare, Rare Ultra, Holo V/VMAX/VSTAR/GX/EX, Illustration Rare, ACE SPEC)
 *    5  Full Art / Rainbow / Secret / Special Illustration Rare
 *    6  Hyper Rare (gold cards, highest tier)
 */
const RARITY_MAP: Record<string, RarityInfo> = {
  // ─── Base rarities (all eras) ───
  common:                       { label: 'Common',                    color: 'var(--rarity-common)',   weight: 0 },
  uncommon:                     { label: 'Uncommon',                  color: 'var(--rarity-uncommon)', weight: 1 },
  rare:                         { label: 'Rare',                      color: 'var(--rarity-rare)',     weight: 2 },

  // ─── Holo tier (weight 3) ───
  'rare holo':                  { label: 'Rare Holo',                 color: 'var(--rarity-holo)',     weight: 3 },
  'holo rare':                  { label: 'Holo Rare',                 color: 'var(--rarity-holo)',     weight: 3 },  // alias
  'double rare':                { label: 'Double Rare',               color: 'var(--rarity-holo)',     weight: 3 },
  'radiant rare':               { label: 'Radiant Rare',              color: 'var(--rarity-holo)',     weight: 3 },
  promo:                        { label: 'Promo',                     color: 'var(--rarity-holo)',     weight: 3 },

  // ─── Ultra tier (weight 4) ───
  'ultra rare':                 { label: 'Ultra Rare',                color: 'var(--rarity-ultra)',    weight: 4 },
  'rare ultra':                 { label: 'Rare Ultra',                color: 'var(--rarity-ultra)',    weight: 4 },  // SWSH/SM/XY/BW format
  'rare holo v':                { label: 'Rare Holo V',               color: 'var(--rarity-ultra)',    weight: 4 },
  'rare holo vmax':             { label: 'Rare Holo VMAX',            color: 'var(--rarity-ultra)',    weight: 4 },
  'rare holo vstar':            { label: 'Rare Holo VSTAR',           color: 'var(--rarity-ultra)',    weight: 4 },
  'rare holo gx':               { label: 'Rare Holo GX',              color: 'var(--rarity-ultra)',    weight: 4 },
  'rare holo ex':               { label: 'Rare Holo EX',              color: 'var(--rarity-ultra)',    weight: 4 },
  'illustration rare':          { label: 'Illustration Rare',         color: 'var(--rarity-ultra)',    weight: 4 },
  'ace spec rare':              { label: 'ACE SPEC Rare',             color: 'var(--rarity-ultra)',    weight: 4 },

  // ─── Full Art / Secret / SIR tier (weight 5) ───
  'full art':                   { label: 'Full Art',                  color: 'var(--rarity-full-art)', weight: 5 },
  'rare rainbow':               { label: 'Rare Rainbow',              color: 'var(--rarity-full-art)', weight: 5 },
  'rare secret':                { label: 'Rare Secret',               color: 'var(--rarity-full-art)', weight: 5 },
  'special illustration rare':  { label: 'Special Illustration Rare', color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 5 },
  'special art rare':           { label: 'Special Art Rare',          color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 5 },  // alias
  sar:                          { label: 'Special Art Rare',          color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 5 },  // alias
  sir:                          { label: 'Special Illustration Rare', color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 5 },  // alias

  // ─── Hyper Rare tier (weight 6) — gold cards, highest non-promo tier ───
  'hyper rare':                 { label: 'Hyper Rare',                color: 'var(--rarity-hyper)',    weight: 6 },
};

const DEFAULT_RARITY: RarityInfo = {
  label: 'Unknown',
  color: 'var(--rarity-common)',
  weight: -1,
};

/**
 * Look up rarity info by the raw rarity string from Scrydex.
 * Case-insensitive, trims whitespace.
 */
export function getRarityInfo(rarity: string | undefined | null): RarityInfo {
  if (!rarity) return DEFAULT_RARITY;
  return RARITY_MAP[rarity.toLowerCase().trim()] ?? DEFAULT_RARITY;
}

/** Get just the CSS color value for a rarity dot. */
export function getRarityColor(rarity: string | undefined | null): string {
  return getRarityInfo(rarity).color;
}

/** Get the numeric sort weight (higher = rarer). */
export function getRarityWeight(rarity: string | undefined | null): number {
  return getRarityInfo(rarity).weight;
}

/** Whether this rarity should use a gradient dot. */
export function isGradientRarity(rarity: string | undefined | null): boolean {
  return !!getRarityInfo(rarity).colorTo;
}

/**
 * Rarity legend entries for display at the bottom of the card dropdown.
 * Ordered from most common to rarest.
 */
export const RARITY_LEGEND: { label: string; color: string; colorTo?: string }[] = [
  { label: 'C',   color: 'var(--rarity-common)' },
  { label: 'UC',  color: 'var(--rarity-uncommon)' },
  { label: 'R',   color: 'var(--rarity-rare)' },
  { label: 'HR',  color: 'var(--rarity-holo)' },
  { label: 'UR',  color: 'var(--rarity-ultra)' },
  { label: 'FA',  color: 'var(--rarity-full-art)' },
  { label: 'SIR', color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)' },
  { label: 'HyR', color: 'var(--rarity-hyper)' },
];
