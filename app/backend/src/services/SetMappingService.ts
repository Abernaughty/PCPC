import { SetMapping } from "../models/SetMapping";
import { SetMappingRepository } from "./SetMappingRepository";

/**
 * Service for accessing set mappings
 * MIGRATED: Now uses Cosmos DB as single source of truth instead of static JSON file
 *
 * This service provides a compatibility layer for existing code that used the old
 * JSON-based SetMappingService. All data is now read from and written to Cosmos DB.
 *
 * DEPRECATION NOTICE: This service is maintained for backward compatibility.
 * New code should use SetMappingRepository or PokeDataToTcgMappingService directly.
 */
export class SetMappingService {
  private repository: SetMappingRepository;
  private cache: Map<string, SetMapping> = new Map();
  private cacheLoadedAt: number | null = null;
  private readonly cacheTtlMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(repository?: SetMappingRepository) {
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING || "";
    this.repository = repository || new SetMappingRepository(connectionString);
    console.log(
      "[SetMappingService] Initialized with Cosmos DB backend (migrated from JSON file)"
    );
  }

  /**
   * Load mappings from Cosmos DB into cache
   */
  private async loadMappingData(): Promise<void> {
    if (
      this.cacheLoadedAt &&
      Date.now() - this.cacheLoadedAt < this.cacheTtlMs
    ) {
      return; // Cache is still valid
    }

    try {
      const mappings = await this.repository.listMappings();
      this.cache.clear();

      mappings.forEach((mapping) => {
        // Index by TCG set code (uppercase) for backward compatibility
        if (mapping.tcgSetId) {
          this.cache.set(mapping.tcgSetId.toUpperCase(), mapping);
        }
      });

      this.cacheLoadedAt = Date.now();
      console.log(
        `[SetMappingService] Loaded ${mappings.length} mappings from Cosmos DB`
      );
    } catch (error) {
      console.error("[SetMappingService] Failed to load mapping data:", error);
      throw error;
    }
  }

  /**
   * Get PokeData set ID from Pokemon TCG set code
   * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
   * @returns PokeData set ID or null if not found
   */
  public async getPokeDataSetId(tcgSetCode: string): Promise<number | null> {
    await this.loadMappingData();
    const mapping = this.cache.get(tcgSetCode.toUpperCase());

    if (mapping) {
      return mapping.pokeDataSetId;
    }

    // Try direct lookup from database in case cache is stale
    const allMappings = await this.repository.listMappings();
    const found = allMappings.find(
      (m) => m.tcgSetId?.toUpperCase() === tcgSetCode.toUpperCase()
    );

    return found ? found.pokeDataSetId : null;
  }

  /**
   * Get PokeData set code from Pokemon TCG set code
   * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
   * @returns PokeData set code or null if not found
   */
  public async getPokeDataSetCode(tcgSetCode: string): Promise<string | null> {
    await this.loadMappingData();
    const mapping = this.cache.get(tcgSetCode.toUpperCase());

    if (mapping) {
      return mapping.pokeDataSetCode;
    }

    // Try direct lookup from database in case cache is stale
    const allMappings = await this.repository.listMappings();
    const found = allMappings.find(
      (m) => m.tcgSetId?.toUpperCase() === tcgSetCode.toUpperCase()
    );

    return found ? found.pokeDataSetCode : null;
  }

  /**
   * Get complete mapping information for a Pokemon TCG set code
   * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
   * @returns Complete mapping information or null if not found
   */
  public async getSetMapping(tcgSetCode: string): Promise<SetMapping | null> {
    await this.loadMappingData();
    const mapping = this.cache.get(tcgSetCode.toUpperCase());

    if (mapping) {
      return mapping;
    }

    // Try direct lookup from database in case cache is stale
    const allMappings = await this.repository.listMappings();
    const found = allMappings.find(
      (m) => m.tcgSetId?.toUpperCase() === tcgSetCode.toUpperCase()
    );

    return found || null;
  }

  /**
   * Check if a Pokemon TCG set code has a mapping
   * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
   * @returns true if mapping exists, false otherwise
   */
  public async hasMapping(tcgSetCode: string): Promise<boolean> {
    const mapping = await this.getSetMapping(tcgSetCode);
    return mapping !== null;
  }

  /**
   * Get mapping statistics
   * @returns Mapping metadata
   */
  public async getMappingStats() {
    const metadata = await this.repository.getMetadata();
    const mappings = await this.repository.listMappings();

    const totalMappings = mappings.length;
    const unmappedCount = mappings.filter((m) => !m.tcgSetId).length;

    return {
      generated: metadata?.lastRunAt || new Date().toISOString(),
      totalMappings,
      unmappedTcg: 0, // Not tracked in new system
      unmappedPokeData: unmappedCount,
      lastPokeDataSetCount: metadata?.lastPokeDataSetCount || 0,
      lastTcgSetCount: metadata?.lastTcgSetCount || 0,
    };
  }

  /**
   * Get all unmapped PokeData sets
   * @returns Array of unmapped PokeData sets
   */
  public async getUnmappedPokeDataSets() {
    const mappings = await this.repository.listMappings();
    return mappings
      .filter((m) => !m.tcgSetId || m.status === "unmatched")
      .map((m) => ({
        id: m.pokeDataSetId,
        code: m.pokeDataSetCode,
        name: m.pokeDataSetName,
      }));
  }

  /**
   * Reload mapping data from Cosmos DB (clears cache)
   */
  public async reloadMappingData(): Promise<void> {
    this.cache.clear();
    this.cacheLoadedAt = null;
    await this.loadMappingData();
    console.log("[SetMappingService] Cache reloaded from Cosmos DB");
  }

  /**
   * Get all mappings (for migration or debugging purposes)
   */
  public async getAllMappings(): Promise<SetMapping[]> {
    return await this.repository.listMappings();
  }
}

// Export a singleton instance for backward compatibility
// DEPRECATION NOTICE: Use dependency injection instead of singleton
export const setMappingService = new SetMappingService();
