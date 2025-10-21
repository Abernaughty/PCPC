import { SetMappingRepository } from "./SetMappingRepository";
import { SetMapping } from "../models/SetMapping";

const MIN_CACHE_TTL_SECONDS = 60;

export class PokeDataToTcgMappingService {
  private repository: SetMappingRepository;
  private cache: Map<number, SetMapping | null> = new Map();
  private cacheLoadedAt: number | null = null;
  private readonly cacheTtlMs: number;

  constructor(
    repository?: SetMappingRepository,
    cacheTtlSeconds?: number
  ) {
    const connectionString =
      process.env.COSMOS_DB_CONNECTION_STRING || "";
    this.repository =
      repository || new SetMappingRepository(connectionString);

    const ttlSeconds =
      cacheTtlSeconds ??
      parseInt(process.env.SET_MAPPING_CACHE_TTL_SECONDS || "900", 10);
    this.cacheTtlMs =
      Math.max(ttlSeconds, MIN_CACHE_TTL_SECONDS) * 1000;
  }

  private isCacheValid(): boolean {
    if (this.cacheLoadedAt === null) {
      return false;
    }
    return Date.now() - this.cacheLoadedAt < this.cacheTtlMs;
  }

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

  async hasMapping(pokeDataSetId: number): Promise<boolean> {
    const mapping = await this.getSetMapping(pokeDataSetId);
    return !!(mapping && mapping.tcgSetId);
  }

  async getMappedPokeDataSetIds(): Promise<number[]> {
    await this.ensureCache();
    return Array.from(this.cache.entries())
      .filter(([, mapping]) => !!mapping?.tcgSetId)
      .map(([pokeDataSetId]) => pokeDataSetId);
  }

  async reloadMappingData(): Promise<void> {
    this.cache.clear();
    this.cacheLoadedAt = null;
    await this.ensureCache();
  }

  updateCacheEntry(pokeDataSetId: number, mapping: SetMapping | null): void {
    if (!mapping) {
      this.cache.delete(pokeDataSetId);
    } else {
      this.cache.set(mapping.pokeDataSetId, mapping);
    }
    this.cacheLoadedAt = Date.now();
  }

  async getReverseMappingDebug(): Promise<Record<number, string | null>> {
    await this.ensureCache();
    const result: Record<number, string | null> = {};
    this.cache.forEach((mapping, setId) => {
      result[setId] = mapping?.tcgSetId ?? null;
    });
    return result;
  }
}
