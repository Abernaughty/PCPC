import { describe, it, expect } from 'vitest';
import {
  getRarityInfo,
  getRarityColor,
  getRarityWeight,
  isGradientRarity,
  RARITY_LEGEND,
} from './rarityMap';

describe('getRarityInfo', () => {
  it('returns the mapped info for a known rarity', () => {
    const info = getRarityInfo('Common');
    expect(info.label).toBe('Common');
    expect(info.weight).toBe(0);
    expect(info.color).toBe('var(--rarity-common)');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(getRarityInfo('  RARE HOLO  ').label).toBe('Rare Holo');
    expect(getRarityInfo('uLtRa RaRe').label).toBe('Ultra Rare');
  });

  it('returns the Unknown default for unmapped strings', () => {
    const info = getRarityInfo('Mythical Sparkle Rare');
    expect(info.label).toBe('Unknown');
    expect(info.weight).toBe(-1);
  });

  it('returns the Unknown default for null, undefined, and empty input', () => {
    expect(getRarityInfo(null).weight).toBe(-1);
    expect(getRarityInfo(undefined).weight).toBe(-1);
    expect(getRarityInfo('').weight).toBe(-1);
  });
});

describe('getRarityWeight', () => {
  it('orders rarities from common to hyper rare', () => {
    const order = [
      'Common',
      'Uncommon',
      'Rare',
      'Rare Holo',
      'Ultra Rare',
      'Rare Secret',
      'Hyper Rare',
    ];
    const weights = order.map(getRarityWeight);
    const sorted = [...weights].sort((a, b) => a - b);
    expect(weights).toEqual(sorted);
    expect(new Set(weights).size).toBe(weights.length);
  });

  it('groups aliases into the same tier', () => {
    expect(getRarityWeight('Holo Rare')).toBe(getRarityWeight('Rare Holo'));
    expect(getRarityWeight('SIR')).toBe(getRarityWeight('Special Illustration Rare'));
  });
});

describe('isGradientRarity', () => {
  it('is true for special illustration rarities and their aliases', () => {
    expect(isGradientRarity('Special Illustration Rare')).toBe(true);
    expect(isGradientRarity('sar')).toBe(true);
    expect(isGradientRarity('sir')).toBe(true);
  });

  it('is false for solid-color rarities and unknown input', () => {
    expect(isGradientRarity('Rare')).toBe(false);
    expect(isGradientRarity('Hyper Rare')).toBe(false);
    expect(isGradientRarity(undefined)).toBe(false);
  });
});

describe('getRarityColor', () => {
  it('returns the CSS custom property for the rarity', () => {
    expect(getRarityColor('Hyper Rare')).toBe('var(--rarity-hyper)');
    expect(getRarityColor('nonsense')).toBe('var(--rarity-common)');
  });
});

describe('RARITY_LEGEND', () => {
  it('lists entries from most common to rarest', () => {
    expect(RARITY_LEGEND[0].label).toBe('C');
    expect(RARITY_LEGEND[RARITY_LEGEND.length - 1].label).toBe('HyR');
  });
});
