import * as fs from "fs";
import * as path from "path";

interface SetMapping {
  pokeDataCode: string | null;
  pokeDataId: number;
  tcgName: string;
  pokeDataName: string;
  matchType: "manual" | "automatic";
}

interface SetMappingData {
  metadata: {
    generated: string;
    totalMappings: number;
    unmappedTcg: number;
    unmappedPokeData: number;
  };
  mappings: Record<string, SetMapping>;
  unmapped: {
    pokemonTcg: Array<{ id: string; name: string; ptcgoCode?: string }>;
    pokeData: Array<{ id: number; code: string | null; name: string }>;
  };
}

/**
 * Service for mapping PokeData set IDs to Pokemon TCG set IDs
 * This is the reverse of the existing SetMappingService and is used
 * for the PokeData-first architecture where we need to enhance
 * PokeData cards with Pokemon TCG images.
 */
export class PokeDataToTcgMappingService {
  private mappingData: SetMappingData | null = null;
  private mappingFilePath: string;
  private reverseMapping: Record<number, string> = {}; // PokeData ID -> TCG Set ID
  private reverseMappingLoaded: boolean = false;

  constructor() {
    this.mappingFilePath = path.join(__dirname, "../../data/set-mapping.json");
  }

  /**
   * Load the set mapping data from the JSON file
   */
  private loadMappingData(): SetMappingData {
    if (this.mappingData) {
      return this.mappingData;
    }

    try {
      const mappingContent = fs.readFileSync(this.mappingFilePath, "utf8");
      this.mappingData = JSON.parse(mappingContent);
      return this.mappingData!;
    } catch (error) {
      console.error("Failed to load set mapping data:", error);
      // Return empty mapping data as fallback
      return {
        metadata: {
          generated: new Date().toISOString(),
          totalMappings: 0,
          unmappedTcg: 0,
          unmappedPokeData: 0,
        },
        mappings: {},
        unmapped: {
          pokemonTcg: [],
          pokeData: [],
        },
      };
    }
  }

  /**
   * Generate the reverse mapping from PokeData set ID to Pokemon TCG set ID
   */
  private generateReverseMapping(): void {
    if (this.reverseMappingLoaded) {
      return;
    }

    const mappingData = this.loadMappingData();
    this.reverseMapping = {};

    // Iterate through all mappings and create reverse lookup
    Object.entries(mappingData.mappings).forEach(([tcgSetId, mapping]) => {
      this.reverseMapping[mapping.pokeDataId] = tcgSetId;
    });

    this.reverseMappingLoaded = true;
    console.log(
      `[PokeDataToTcgMappingService] Generated reverse mapping for ${
        Object.keys(this.reverseMapping).length
      } sets`
    );
  }

  /**
   * Get Pokemon TCG set ID from PokeData set ID
   * @param pokeDataSetId - PokeData set ID (e.g., 557)
   * @returns Pokemon TCG set ID (e.g., "sv8pt5") or null if not found
   */
  public getTcgSetId(pokeDataSetId: number): string | null {
    this.generateReverseMapping();

    const tcgSetId = this.reverseMapping[pokeDataSetId];

    if (tcgSetId) {
      console.log(
        `[PokeDataToTcgMappingService] Mapped PokeData set ID ${pokeDataSetId} to TCG set ID ${tcgSetId}`
      );
      return tcgSetId;
    }

    console.log(
      `[PokeDataToTcgMappingService] No mapping found for PokeData set ID ${pokeDataSetId}`
    );
    return null;
  }

  /**
   * Get complete mapping information for a PokeData set ID
   * @param pokeDataSetId - PokeData set ID (e.g., 557)
   * @returns Complete mapping information or null if not found
   */
  public getSetMapping(pokeDataSetId: number): SetMapping | null {
    this.generateReverseMapping();

    const tcgSetId = this.reverseMapping[pokeDataSetId];
    if (!tcgSetId) {
      return null;
    }

    const mappingData = this.loadMappingData();
    return mappingData.mappings[tcgSetId] || null;
  }

  /**
   * Check if a PokeData set ID has a mapping to Pokemon TCG
   * @param pokeDataSetId - PokeData set ID (e.g., 557)
   * @returns true if mapping exists, false otherwise
   */
  public hasMapping(pokeDataSetId: number): boolean {
    this.generateReverseMapping();
    return pokeDataSetId in this.reverseMapping;
  }

  /**
   * Get all available PokeData set IDs that have mappings
   * @returns Array of PokeData set IDs that can be mapped to Pokemon TCG
   */
  public getMappedPokeDataSetIds(): number[] {
    this.generateReverseMapping();
    return Object.keys(this.reverseMapping).map((id) => parseInt(id));
  }

  /**
   * Get mapping statistics
   * @returns Mapping metadata
   */
  public getMappingStats() {
    const mappingData = this.loadMappingData();
    return mappingData.metadata;
  }

  /**
   * Get all unmapped PokeData sets (sets that don't have Pokemon TCG equivalents)
   * @returns Array of unmapped PokeData sets
   */
  public getUnmappedPokeDataSets() {
    const mappingData = this.loadMappingData();
    return mappingData.unmapped.pokeData;
  }

  /**
   * Reload mapping data from file (useful for updates)
   */
  public reloadMappingData(): void {
    this.mappingData = null;
    this.reverseMappingLoaded = false;
    this.reverseMapping = {};
    this.loadMappingData();
  }

  /**
   * Get the reverse mapping object for debugging purposes
   * @returns The complete reverse mapping object
   */
  public getReverseMappingDebug(): Record<number, string> {
    this.generateReverseMapping();
    return { ...this.reverseMapping };
  }
}

// Export a singleton instance
export const pokeDataToTcgMappingService = new PokeDataToTcgMappingService();
