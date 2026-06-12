import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CacheKeys,
  isCacheExpired,
  formatCacheEntry,
  parseCacheEntry,
  getCacheAge,
} from './cache';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-10T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('CacheKeys', () => {
  it('builds stable, namespaced keys', () => {
    expect(CacheKeys.setList()).toBe('sets:list');
    expect(CacheKeys.cardsForSet('sv1')).toBe('cards:set:sv1');
    expect(CacheKeys.card('sv1-25')).toBe('card:sv1-25');
    expect(CacheKeys.cardPricing('sv1-25')).toBe('pricing:sv1-25');
  });
});

describe('isCacheExpired', () => {
  it('is false while within the TTL', () => {
    const timestamp = Date.now();
    vi.advanceTimersByTime(9_000);
    expect(isCacheExpired(timestamp, 10)).toBe(false);
  });

  it('is true once the TTL has elapsed', () => {
    const timestamp = Date.now();
    vi.advanceTimersByTime(11_000);
    expect(isCacheExpired(timestamp, 10)).toBe(true);
  });
});

describe('formatCacheEntry / parseCacheEntry', () => {
  it('round-trips data while fresh', () => {
    const entry = formatCacheEntry({ hello: 'world' }, 60);
    expect(entry.timestamp).toBe(Date.now());
    expect(entry.ttl).toBe(60);
    expect(parseCacheEntry(entry)).toEqual({ hello: 'world' });
  });

  it('returns null once the entry has expired', () => {
    const entry = formatCacheEntry('data', 60);
    vi.advanceTimersByTime(61_000);
    expect(parseCacheEntry(entry)).toBeNull();
  });

  it('returns null for a missing entry', () => {
    expect(parseCacheEntry(null)).toBeNull();
  });
});

describe('getCacheAge', () => {
  it('reports whole seconds since the timestamp', () => {
    const timestamp = Date.now();
    vi.advanceTimersByTime(2_500);
    expect(getCacheAge(timestamp)).toBe(2);
  });
});
