export type SetMatchType = "manual" | "automatic" | "unmatched";

export interface SetMapping {
  id: string; // Cosmos document id - align with pokeDataSetId string
  pokeDataSetId: number;
  pokeDataSetCode: string | null;
  pokeDataSetName: string;
  tcgSetId: string | null;
  tcgSetName?: string | null;
  matchType: SetMatchType;
  confidence: number;
  status: "active" | "pending" | "unmatched";
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SetMappingMetadata {
  id: string;
  lastPokeDataSetCount: number;
  lastTcgSetCount: number;
  lastRunAt: string | null;
  lastDiffDetectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MappingSyncSummary {
  fetchedPokeDataSets: number;
  fetchedTcgSets: number;
  newMappings: number;
  updatedMappings: number;
  unchangedMappings: number;
  unmatchedPokeDataSets: number;
  cardsUpdated: number;
  cardsSkipped: number;
  cardsErrored: number;
  durationMs: number;
}
