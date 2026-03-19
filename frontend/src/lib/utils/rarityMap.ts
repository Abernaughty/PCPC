/**
 * Rarity mapping utility for PCPC card dropdown.
 * Maps Scrydex rarity strings to display colors and sort weights.
 */

export interface RarityInfo {
  label: string;
  color: string;
  /** Optional second color for gradient rarities (e.g. SAR) */
  colorTo?: string;
  /** Higher weight = rarer. Used for sort-by-rarity. */
  weight: number;
}

/**
 * Canonical rarity map. Keys are lowercase for case-insensitive lookup.
 * Colors reference CSS custom properties from app.css.
 */
const RARITY_MAP: Record<string, RarityInfo> = {
  common:           { label: 'Common',           color: 'var(--rarity-common)',   weight: 0 },
  uncommon:         { label: 'Uncommon',         color: 'var(--rarity-uncommon)', weight: 1 },
  rare:             { label: 'Rare',             color: 'var(--rarity-rare)',     weight: 2 },
  'holo rare':      { label: 'Holo Rare',        color: 'var(--rarity-holo)',     weight: 3 },
  'double rare':    { label: 'Double Rare',      color: 'var(--rarity-holo)',     weight: 3 },
  'ultra rare':     { label: 'Ultra Rare',       color: 'var(--rarity-ultra)',    weight: 4 },
  'illustration rare': { label: 'Illustration Rare', color: 'var(--rarity-ultra)', weight: 4 },
  'full art':       { label: 'Full Art',         color: 'var(--rarity-full-art)', weight: 5 },
  'special art rare': { label: 'Special Art Rare', color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 6 },
  'hyper rare':     { label: 'Hyper Rare',       color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 6 },
  sar:              { label: 'Special Art Rare',  color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)', weight: 6 },
  'ace spec rare':  { label: 'ACE SPEC Rare',    color: 'var(--rarity-ultra)',    weight: 4 },
  promo:            { label: 'Promo',            color: 'var(--rarity-holo)',     weight: 3 },
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
  { label: 'SAR', color: 'var(--rarity-sar-from)', colorTo: 'var(--rarity-sar-to)' },
];
