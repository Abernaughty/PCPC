import * as fs from 'fs';
import * as path from 'path';

interface SetMapping {
    pokeDataCode: string | null;
    pokeDataId: number;
    tcgName: string;
    pokeDataName: string;
    matchType: 'manual' | 'automatic';
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

export class SetMappingService {
    private mappingData: SetMappingData | null = null;
    private mappingFilePath: string;

    constructor() {
        this.mappingFilePath = path.join(__dirname, '../../data/set-mapping.json');
    }

    /**
     * Load the set mapping data from the JSON file
     */
    private loadMappingData(): SetMappingData {
        if (this.mappingData) {
            return this.mappingData;
        }

        try {
            const mappingContent = fs.readFileSync(this.mappingFilePath, 'utf8');
            this.mappingData = JSON.parse(mappingContent);
            return this.mappingData!;
        } catch (error) {
            console.error('Failed to load set mapping data:', error);
            // Return empty mapping data as fallback
            return {
                metadata: {
                    generated: new Date().toISOString(),
                    totalMappings: 0,
                    unmappedTcg: 0,
                    unmappedPokeData: 0
                },
                mappings: {},
                unmapped: {
                    pokemonTcg: [],
                    pokeData: []
                }
            };
        }
    }

    /**
     * Get PokeData set ID from Pokemon TCG set code
     * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
     * @returns PokeData set ID or null if not found
     */
    public getPokeDataSetId(tcgSetCode: string): number | null {
        const mappingData = this.loadMappingData();
        const mapping = mappingData.mappings[tcgSetCode];
        
        if (mapping) {
            return mapping.pokeDataId;
        }
        
        return null;
    }

    /**
     * Get PokeData set code from Pokemon TCG set code
     * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
     * @returns PokeData set code or null if not found
     */
    public getPokeDataSetCode(tcgSetCode: string): string | null {
        const mappingData = this.loadMappingData();
        const mapping = mappingData.mappings[tcgSetCode];
        
        if (mapping) {
            return mapping.pokeDataCode;
        }
        
        return null;
    }

    /**
     * Get complete mapping information for a Pokemon TCG set code
     * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
     * @returns Complete mapping information or null if not found
     */
    public getSetMapping(tcgSetCode: string): SetMapping | null {
        const mappingData = this.loadMappingData();
        return mappingData.mappings[tcgSetCode] || null;
    }

    /**
     * Check if a Pokemon TCG set code has a mapping
     * @param tcgSetCode - Pokemon TCG set code (e.g., "sv8pt5")
     * @returns true if mapping exists, false otherwise
     */
    public hasMapping(tcgSetCode: string): boolean {
        const mappingData = this.loadMappingData();
        return tcgSetCode in mappingData.mappings;
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
     * Get all unmapped Pokemon TCG sets
     * @returns Array of unmapped Pokemon TCG sets
     */
    public getUnmappedTcgSets() {
        const mappingData = this.loadMappingData();
        return mappingData.unmapped.pokemonTcg;
    }

    /**
     * Get all unmapped PokeData sets
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
        this.loadMappingData();
    }
}

// Export a singleton instance
export const setMappingService = new SetMappingService();
