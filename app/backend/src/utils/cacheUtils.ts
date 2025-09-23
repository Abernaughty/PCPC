/**
 * Generate a cache key for a set list
 * @returns The cache key for the set list
 */
export function getSetListCacheKey(): string {
    return 'sets:list';
}

/**
 * Generate a cache key for cards in a set
 * @param setCode The set code
 * @returns The cache key for cards in the set
 */
export function getCardsForSetCacheKey(setCode: string): string {
    return `cards:set:${setCode.toLowerCase()}`;
}

/**
 * Generate a cache key for a card
 * @param cardId The card ID
 * @returns The cache key for the card
 */
export function getCardCacheKey(cardId: string): string {
    return `card:${cardId.toLowerCase()}`;
}

/**
 * Generate a cache key for card pricing
 * @param cardId The card ID
 * @returns The cache key for card pricing
 */
export function getCardPricingCacheKey(cardId: string): string {
    return `pricing:${cardId.toLowerCase()}`;
}

/**
 * Generate a cache key for current sets
 * @returns The cache key for current sets
 */
export function getCurrentSetsCacheKey(): string {
    return 'sets:current';
}

/**
 * Check if a cache entry is expired
 * @param timestamp The timestamp of the cache entry
 * @param ttlSeconds The TTL in seconds
 * @returns Whether the cache entry is expired
 */
export function isCacheExpired(timestamp: number, ttlSeconds: number): boolean {
    const now = Date.now();
    const expiryTime = timestamp + (ttlSeconds * 1000);
    return now > expiryTime;
}

/**
 * Calculate the age of a cache entry in seconds
 * @param timestamp The timestamp of the cache entry
 * @returns The age of the cache entry in seconds
 */
export function getCacheAge(timestamp: number): number {
    const now = Date.now();
    const ageMs = now - timestamp;
    return Math.floor(ageMs / 1000);
}

/**
 * Format a cache entry with timestamp and TTL information
 * @param data The data to cache
 * @param ttlSeconds The TTL in seconds
 * @returns The formatted cache entry
 */
export function formatCacheEntry<T>(data: T, ttlSeconds: number): { data: T; timestamp: number; ttl: number } {
    return {
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds
    };
}

/**
 * Parse a cache entry and check if it's expired
 * @param cacheEntry The cache entry
 * @returns The data if not expired, null otherwise
 */
export function parseCacheEntry<T>(cacheEntry: { data: T; timestamp: number; ttl: number } | null): T | null {
    if (!cacheEntry) {
        return null;
    }
    
    if (isCacheExpired(cacheEntry.timestamp, cacheEntry.ttl)) {
        return null;
    }
    
    return cacheEntry.data;
}
