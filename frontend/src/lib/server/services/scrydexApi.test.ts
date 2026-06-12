import { describe, it, expect } from 'vitest';
import {
  normalizeLanguageCode,
  mapScrydexPriceToVariantPrice,
  mapScrydexVariantToCardVariant,
  type ScrydexPrice,
  type ScrydexVariant,
} from './scrydexApi';

describe('normalizeLanguageCode', () => {
  it('defaults to EN when no code is provided', () => {
    expect(normalizeLanguageCode(undefined)).toBe('EN');
    expect(normalizeLanguageCode('')).toBe('EN');
  });

  it('maps the Scrydex JA code to the JP display code', () => {
    expect(normalizeLanguageCode('JA')).toBe('JP');
    expect(normalizeLanguageCode('ja')).toBe('JP');
  });

  it('uppercases other language codes unchanged', () => {
    expect(normalizeLanguageCode('en')).toBe('EN');
    expect(normalizeLanguageCode('de')).toBe('DE');
  });
});

function makePrice(overrides: Partial<ScrydexPrice> = {}): ScrydexPrice {
  return {
    condition: 'NM',
    type: 'raw',
    is_perfect: false,
    is_error: false,
    is_signed: false,
    low: 1.5,
    market: 2.25,
    currency: 'USD',
    ...overrides,
  };
}

describe('mapScrydexPriceToVariantPrice', () => {
  it('maps snake_case price fields to camelCase', () => {
    const mapped = mapScrydexPriceToVariantPrice(
      makePrice({
        type: 'graded',
        company: 'PSA',
        grade: '10',
        is_perfect: true,
        mid: 3,
        high: 4,
      })
    );
    expect(mapped).toMatchObject({
      condition: 'NM',
      type: 'graded',
      company: 'PSA',
      grade: '10',
      isPerfect: true,
      isError: false,
      isSigned: false,
      low: 1.5,
      mid: 3,
      high: 4,
      market: 2.25,
      currency: 'USD',
    });
  });

  it('maps trend windows when present', () => {
    const mapped = mapScrydexPriceToVariantPrice(
      makePrice({
        trends: {
          days_7: { price_change: 0.5, percent_change: 12.3 },
          days_30: { price_change: -1, percent_change: -8 },
        },
      })
    );
    expect(mapped.trends?.days7).toEqual({ priceChange: 0.5, percentChange: 12.3 });
    expect(mapped.trends?.days30).toEqual({ priceChange: -1, percentChange: -8 });
    expect(mapped.trends?.days90).toBeUndefined();
  });

  it('leaves trends undefined when the API provides none', () => {
    expect(mapScrydexPriceToVariantPrice(makePrice()).trends).toBeUndefined();
  });
});

describe('mapScrydexVariantToCardVariant', () => {
  it('maps images and prices', () => {
    const variant: ScrydexVariant = {
      name: 'holofoil',
      images: [{ type: 'front', small: 's.png', medium: 'm.png', large: 'l.png' }],
      prices: [makePrice()],
    };
    const mapped = mapScrydexVariantToCardVariant(variant);
    expect(mapped.name).toBe('holofoil');
    expect(mapped.images).toEqual([
      { type: 'front', small: 's.png', medium: 'm.png', large: 'l.png' },
    ]);
    expect(mapped.prices).toHaveLength(1);
    expect(mapped.prices[0].market).toBe(2.25);
  });

  it('defaults to an empty price list when prices are missing', () => {
    const mapped = mapScrydexVariantToCardVariant({ name: 'normal' });
    expect(mapped.prices).toEqual([]);
    expect(mapped.images).toBeUndefined();
  });
});
