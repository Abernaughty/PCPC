import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getExpansionForSet,
  groupSetsByExpansion,
  prepareGroupedSetsForDropdown,
  parseDateToTimestamp,
  formatMonthYear,
  getDateRangeLabel,
} from './expansionMapper';
import type { PokemonSet } from '$lib/types';

function makeSet(overrides: Partial<PokemonSet> = {}): PokemonSet {
  return {
    id: 'sv1',
    code: 'SV1',
    name: 'Scarlet & Violet',
    series: 'Scarlet & Violet',
    releaseDate: '2023/03/31',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 10));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('parseDateToTimestamp', () => {
  it('parses slash-separated dates', () => {
    expect(parseDateToTimestamp('2023/03/31')).toBe(new Date('2023-03-31').getTime());
  });

  it('parses dash-separated dates', () => {
    expect(parseDateToTimestamp('2023-03-31')).toBeGreaterThan(0);
  });

  it('returns 0 for missing or unparseable dates', () => {
    expect(parseDateToTimestamp(undefined)).toBe(0);
    expect(parseDateToTimestamp('')).toBe(0);
    expect(parseDateToTimestamp('not a date')).toBe(0);
  });
});

describe('formatMonthYear', () => {
  it('formats as "Mon YYYY"', () => {
    expect(formatMonthYear('2023/08/11')).toBe('Aug 2023');
  });

  it('returns empty string for missing or invalid dates', () => {
    expect(formatMonthYear(undefined)).toBe('');
    expect(formatMonthYear('garbage')).toBe('');
  });
});

describe('getDateRangeLabel', () => {
  it('uses "present" when the newest set is from the current year or later', () => {
    const sets = [
      makeSet({ releaseDate: '2023/03/31' }),
      makeSet({ id: 'sv9', releaseDate: '2026/01/30' }),
    ];
    expect(getDateRangeLabel(sets)).toBe('2023 – present');
  });

  it('uses a closed year range for past eras', () => {
    const sets = [
      makeSet({ releaseDate: '2019/02/01' }),
      makeSet({ id: 'swsh12', releaseDate: '2022/11/11' }),
    ];
    expect(getDateRangeLabel(sets)).toBe('2019 – 2022');
  });

  it('collapses to a single year when min and max match', () => {
    expect(getDateRangeLabel([makeSet({ releaseDate: '2021/06/18' })])).toBe('2021');
  });

  it('returns empty string when no sets have parseable dates', () => {
    expect(getDateRangeLabel([makeSet({ releaseDate: undefined })])).toBe('');
    expect(getDateRangeLabel([])).toBe('');
  });
});

describe('getExpansionForSet', () => {
  it('uses the series field when present', () => {
    expect(getExpansionForSet(makeSet({ series: 'Sword & Shield' }))).toBe('Sword & Shield');
  });

  it('falls back to "Other" when series is missing', () => {
    expect(getExpansionForSet(makeSet({ series: '' }))).toBe('Other');
  });
});

describe('groupSetsByExpansion', () => {
  it('groups sets by their series', () => {
    const grouped = groupSetsByExpansion([
      makeSet({ id: 'a', series: 'Scarlet & Violet' }),
      makeSet({ id: 'b', series: 'Sword & Shield' }),
      makeSet({ id: 'c', series: 'Scarlet & Violet' }),
    ]);
    expect(Object.keys(grouped).sort()).toEqual(['Scarlet & Violet', 'Sword & Shield']);
    expect(grouped['Scarlet & Violet'].map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('returns an empty record for empty input', () => {
    expect(groupSetsByExpansion([])).toEqual({});
  });
});

describe('prepareGroupedSetsForDropdown', () => {
  it('sorts sets within a group newest first', () => {
    const groups = prepareGroupedSetsForDropdown({
      'Scarlet & Violet': [
        makeSet({ id: 'old', releaseDate: '2023/03/31' }),
        makeSet({ id: 'new', releaseDate: '2025/05/30' }),
        makeSet({ id: 'mid', releaseDate: '2024/01/26' }),
      ],
    });
    expect(groups[0].items.map((s) => s.id)).toEqual(['new', 'mid', 'old']);
  });

  it('sorts groups by their newest set, newest group first', () => {
    const groups = prepareGroupedSetsForDropdown({
      'Sword & Shield': [makeSet({ id: 'swsh', releaseDate: '2022/11/11' })],
      'Scarlet & Violet': [makeSet({ id: 'sv', releaseDate: '2025/05/30' })],
      'Sun & Moon': [makeSet({ id: 'sm', releaseDate: '2019/11/01' })],
    });
    expect(groups.map((g) => g.label)).toEqual([
      'Scarlet & Violet',
      'Sword & Shield',
      'Sun & Moon',
    ]);
  });

  it('always sorts the "Other" group last, even with the newest dates', () => {
    const groups = prepareGroupedSetsForDropdown({
      Other: [makeSet({ id: 'x', releaseDate: '2026/05/01' })],
      'Scarlet & Violet': [makeSet({ id: 'sv', releaseDate: '2023/03/31' })],
    });
    expect(groups.map((g) => g.label)).toEqual(['Scarlet & Violet', 'Other']);
  });

  it('attaches a dateRange to each group', () => {
    const groups = prepareGroupedSetsForDropdown({
      'Sword & Shield': [
        makeSet({ id: 'a', releaseDate: '2020/02/07' }),
        makeSet({ id: 'b', releaseDate: '2022/11/11' }),
      ],
    });
    expect(groups[0].dateRange).toBe('2020 – 2022');
  });
});
