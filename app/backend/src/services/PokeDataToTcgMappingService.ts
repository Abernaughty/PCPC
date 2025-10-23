import { SetMapping } from "../models/SetMapping";
import { SetMappingRepository } from "./SetMappingRepository";

const MIN_CACHE_TTL_SECONDS = 60;

/**
 * Service for mapping PokeData set IDs to Pokemon TCG set IDs
 * Implements intelligent caching with per-entry updates to avoid cache invalidation race conditions
 */
export class PokeDataToTcgMappingService {
  private repository: SetMappingRepository;
  private cache: Map<number, SetMapping | null> = new Map();
  private cacheLoadedAt: number | null = null;
  private readonly cacheTtlMs: number;

  constructor(repository?: SetMappingRepository, cacheTtlSeconds?: number) {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING || "";
    this.repository = repository || new SetMappingRepository(connectionString);

    const ttlSeconds =
      cacheTtlSeconds ??
      parseInt(process.env.SET_MAPPING_CACHE_TTL_SECONDS || "900", 10);
    this.cacheTtlMs = Math.max(ttlSeconds, MIN_CACHE_TTL_SECONDS) * 1000;
  }

  /**
   * Check if the entire cache is still valid based on TTL
   */
  private isCacheValid(): boolean {
    if (this.cacheLoadedAt === null) {
      return false;
    }
    return Date.now() - this.cacheLoadedAt < this.cacheTtlMs;
  }

  /**
   * Load all mappings into cache
   */
  private async ensureCache(): Promise<void> {
    if (this.isCacheValid() && this.cache.size > 0) {
      return;
    }

    const mappings = await this.repository.listMappings();
    this.cache.clear();
    mappings.forEach((mapping) => {
      this.cache.set(mapping.pokeDataSetId, mapping);
    });
    this.cacheLoadedAt = Date.now();
    console.log(
      `[PokeDataToTcgMappingService] Cache refreshed with ${mappings.length} mappings`
    );
  }

  /**
   * Get TCG set ID for a given PokeData set ID
   */
  async getTcgSetId(pokeDataSetId: number): Promise<string | null> {
    if (!this.isCacheValid()) {
      await this.ensureCache();
    }

    if (!this.cache.has(pokeDataSetId)) {
      const mapping = await this.repository.getMappingByPokeDataSetId(
        pokeDataSetId
      );
      this.cache.set(pokeDataSetId, mapping);
    }

    const mapping = this.cache.get(pokeDataSetId);
    if (!mapping) {
      console.log(
        `[PokeDataToTcgMappingService] No mapping found for PokeData set ID ${pokeDataSetId}`
      );
      return null;
    }

    if (!mapping.tcgSetId) {
      console.log(
        `[PokeDataToTcgMappingService] Mapping for PokeData set ID ${pokeDataSetId} does not have a TCG set`
      );
      return null;
    }

    console.log(
      `[PokeDataToTcgMappingService] Mapped PokeData set ID ${pokeDataSetId} to TCG set ID ${mapping.tcgSetId}`
    );
    return mapping.tcgSetId;
  }

  /**
   * Get complete set mapping for a given PokeData set ID
   */
  async getSetMapping(pokeDataSetId: number): Promise<SetMapping | null> {
    const cached = this.cache.get(pokeDataSetId);
    if (cached) {
      return cached;
    }

    const mapping = await this.repository.getMappingByPokeDataSetId(
      pokeDataSetId
    );
    if (mapping) {
      this.cache.set(pokeDataSetId, mapping);
    }
    return mapping;
  }

  /**
   * Check if a PokeData set has a valid TCG mapping
   */
  async hasMapping(pokeDataSetId: number): Promise<boolean> {
    const mapping = await this.getSetMapping(pokeDataSetId);
    return !!(mapping && mapping.tcgSetId);
  }

  /**
   * Get all PokeData set IDs that have TCG mappings
   */
  async getMappedPokeDataSetIds(): Promise<number[]> {
    await this.ensureCache();
    return Array.from(this.cache.entries())
      .filter(([, mapping]) => !!mapping?.tcgSetId)
      .map(([pokeDataSetId]) => pokeDataSetId);
  }

  /**
   * Force reload all mappings from database
   */
  async reloadMappingData(): Promise<void> {
    this.cache.clear();
    this.cacheLoadedAt = null;
    await this.ensureCache();
  }

  /**
   * Update a single cache entry without invalidating the entire cache
   * FIXED: No longer resets cacheLoadedAt to avoid cache invalidation race condition
   *
   * @param pokeDataSetId - The PokeData set ID to update
   * @param mapping - The updated mapping, or null to remove from cache
   */
  updateCacheEntry(pokeDataSetId: number, mapping: SetMapping | null): void {
    if (!mapping) {
      this.cache.delete(pokeDataSetId);
      console.log(
        `[PokeDataToTcgMappingService] Removed cache entry for PokeData set ID ${pokeDataSetId}`
      );
    } else {
      this.cache.set(mapping.pokeDataSetId, mapping);
      console.log(
        `[PokeDataToTcgMappingService] Updated cache entry for PokeData set ID ${pokeDataSetId}`
      );
    }
    // IMPORTANT: Do NOT reset cacheLoadedAt here
    // This was causing cache invalidation race conditions where updating a single entry
    // would reset the TTL for the entire cache, defeating the purpose of cache expiration
  }

  /**
   * Get debug information about reverse mappings
   */
  async getReverseMappingDebug(): Promise<Record<number, string | null>> {
    await this.ensureCache();
    const result: Record<number, string | null> = {};
    this.cache.forEach((mapping, setId) => {
      result[setId] = mapping?.tcgSetId ?? null;
    });
    return result;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): {
    size: number;
    isValid: boolean;
    loadedAt: number | null;
    ttlMs: number;
    ageMs: number | null;
  } {
    return {
      size: this.cache.size,
      isValid: this.isCacheValid(),
      loadedAt: this.cacheLoadedAt,
      ttlMs: this.cacheTtlMs,
      ageMs: this.cacheLoadedAt ? Date.now() - this.cacheLoadedAt : null,
    };
  }
}
