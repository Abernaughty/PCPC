export const CacheKeys = {
  setList: () => 'sets:list',
  cardsForSet: (setId: string) => `cards:set:${setId}`,
  card: (cardId: string) => `card:${cardId}`,
  cardPricing: (cardId: string) => `pricing:${cardId}`,
};

export function isCacheExpired(timestamp: number, ttlSeconds: number): boolean {
  return (Date.now() - timestamp) / 1000 > ttlSeconds;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export function formatCacheEntry<T>(data: T, ttlSeconds: number): CacheEntry<T> {
  return {
    data,
    timestamp: Date.now(),
    ttl: ttlSeconds,
  };
}

export function parseCacheEntry<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;

  const age = (Date.now() - entry.timestamp) / 1000;
  if (age > entry.ttl) return null;

  return entry.data;
}

export function getCacheAge(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / 1000);
}
