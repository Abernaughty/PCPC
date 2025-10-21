import { Set } from "../models/Set";
import { PokeDataSet } from "./PokeDataApiService";
import { SetMatchType } from "../models/SetMapping";

interface MatchResult {
  tcgSet: Set | null;
  confidence: number;
  matchType: SetMatchType;
  reason: string;
}

interface NormalizedStrings {
  normalized: string;
  tokens: string[];
}

const NAME_SIMILARITY_THRESHOLD = 0.65;

export class SetMatchingEngine {
  private normalizeName(value: string): NormalizedStrings {
    const normalized = value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = normalized
      .split(" ")
      .filter(Boolean)
      .map((token) => token.trim());

    return { normalized, tokens };
  }

  private jaccardSimilarity(
    tokensA: string[],
    tokensB: string[]
  ): number {
    if (!tokensA.length || !tokensB.length) {
      return 0;
    }

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    const intersection = [...setA].filter((token) => setB.has(token));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.length / union.size;
  }

  private releaseDateProximity(
    pokeDataSet: PokeDataSet,
    tcgSet: Set
  ): number {
    if (!pokeDataSet.release_date || !tcgSet.releaseDate) {
      return 0.1;
    }

    const pokeDataDate = new Date(pokeDataSet.release_date).getTime();
    const tcgDate = new Date(tcgSet.releaseDate).getTime();
    if (Number.isNaN(pokeDataDate) || Number.isNaN(tcgDate)) {
      return 0.1;
    }

    const diffDays = Math.abs(pokeDataDate - tcgDate) / (1000 * 60 * 60 * 24);

    if (diffDays <= 7) return 0.2;
    if (diffDays <= 30) return 0.1;
    if (diffDays <= 90) return 0.05;
    return 0;
  }

  public match(
    pokeDataSet: PokeDataSet,
    tcgSets: Set[]
  ): MatchResult {
    const normalizedPokeDataName = this.normalizeName(pokeDataSet.name);
    const pokeDataCode = pokeDataSet.code?.toUpperCase() || "";

    let bestMatch: MatchResult = {
      tcgSet: null,
      confidence: 0,
      matchType: "unmatched",
      reason: "No suitable match found",
    };

    for (const tcgSet of tcgSets) {
      // Strategy 1: Code match
      const tcgCode = tcgSet.code ? tcgSet.code.toUpperCase() : "";
      if (pokeDataCode && tcgCode && pokeDataCode === tcgCode) {
        return {
          tcgSet,
          confidence: 1,
          matchType: "automatic",
          reason: "Exact PTCGO code match",
        };
      }

      // Strategy 2: Exact normalized name match
      const normalizedTcgName = this.normalizeName(tcgSet.name);
      if (normalizedPokeDataName.normalized === normalizedTcgName.normalized) {
        return {
          tcgSet,
          confidence: 0.95,
          matchType: "automatic",
          reason: "Exact normalized name match",
        };
      }

      // Strategy 3: Token similarity with release date proximity
      const similarity = this.jaccardSimilarity(
        normalizedPokeDataName.tokens,
        normalizedTcgName.tokens
      );

      if (similarity >= NAME_SIMILARITY_THRESHOLD) {
        const proximityBoost = this.releaseDateProximity(
          pokeDataSet,
          tcgSet
        );
        const confidence = Math.min(similarity + proximityBoost, 0.9);

        if (confidence > bestMatch.confidence) {
          bestMatch = {
            tcgSet,
            confidence,
            matchType: "automatic",
            reason: `Name similarity (${similarity.toFixed(
              2
            )}) with release date boost`,
          };
        }
      }
    }

    return bestMatch;
  }
}
