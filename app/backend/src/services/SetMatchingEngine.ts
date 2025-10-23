import { Set } from "../models/Set";
import { SetMatchType } from "../models/SetMapping";
import { PokeDataSet } from "./PokeDataApiService";

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

/**
 * Configurable similarity threshold for name matching
 * Can be overridden via environment variable SET_MATCHING_SIMILARITY_THRESHOLD
 * Default: 0.70 (increased from 0.65 to reduce false positives)
 */
const DEFAULT_NAME_SIMILARITY_THRESHOLD = 0.7;

/**
 * Minimum confidence score required for automatic matching
 * Matches below this threshold will be logged for review
 */
const MIN_CONFIDENCE_THRESHOLD = 0.6;

export class SetMatchingEngine {
  private readonly similarityThreshold: number;

  constructor(similarityThreshold?: number) {
    this.similarityThreshold =
      similarityThreshold ??
      parseFloat(
        process.env.SET_MATCHING_SIMILARITY_THRESHOLD ||
          String(DEFAULT_NAME_SIMILARITY_THRESHOLD)
      );

    console.log(
      `[SetMatchingEngine] Initialized with similarity threshold: ${this.similarityThreshold}`
    );
  }

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

  private jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
    if (!tokensA.length || !tokensB.length) {
      return 0;
    }

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    const intersection = [...setA].filter((token) => setB.has(token));
    const union = new Set([...tokensA, ...tokensB]);

    return intersection.length / union.size;
  }

  private releaseDateProximity(pokeDataSet: PokeDataSet, tcgSet: Set): number {
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

  /**
   * Match a PokeData set to a Pokemon TCG set
   * Returns the best match with confidence score and reasoning
   */
  public match(pokeDataSet: PokeDataSet, tcgSets: Set[]): MatchResult {
    const normalizedPokeDataName = this.normalizeName(pokeDataSet.name);
    const pokeDataCode = pokeDataSet.code?.toUpperCase() || "";

    let bestMatch: MatchResult = {
      tcgSet: null,
      confidence: 0,
      matchType: "unmatched",
      reason: "No suitable match found",
    };

    const matchCandidates: Array<{
      tcgSet: Set;
      confidence: number;
      reason: string;
    }> = [];

    for (const tcgSet of tcgSets) {
      // Strategy 1: Code match
      const tcgCode = tcgSet.code ? tcgSet.code.toUpperCase() : "";
      if (pokeDataCode && tcgCode && pokeDataCode === tcgCode) {
        console.log(
          `[SetMatchingEngine] Exact code match: ${pokeDataSet.name} (${pokeDataCode}) -> ${tcgSet.name} (${tcgCode})`
        );
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
        console.log(
          `[SetMatchingEngine] Exact name match: ${pokeDataSet.name} -> ${tcgSet.name}`
        );
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

      if (similarity >= this.similarityThreshold) {
        const proximityBoost = this.releaseDateProximity(pokeDataSet, tcgSet);
        const confidence = Math.min(similarity + proximityBoost, 0.9);

        matchCandidates.push({
          tcgSet,
          confidence,
          reason: `Name similarity (${similarity.toFixed(
            2
          )}) with release date boost (+${proximityBoost.toFixed(2)})`,
        });

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

    // Log match quality for monitoring and threshold tuning
    if (bestMatch.tcgSet) {
      if (bestMatch.confidence < MIN_CONFIDENCE_THRESHOLD) {
        console.warn(
          `[SetMatchingEngine] Low confidence match (${bestMatch.confidence.toFixed(
            2
          )}): ${pokeDataSet.name} -> ${bestMatch.tcgSet.name}`
        );
        console.warn(
          `[SetMatchingEngine] Reason: ${bestMatch.reason}. Consider manual review.`
        );
      } else {
        console.log(
          `[SetMatchingEngine] Match found (confidence: ${bestMatch.confidence.toFixed(
            2
          )}): ${pokeDataSet.name} -> ${bestMatch.tcgSet.name}`
        );
      }

      // Log alternative candidates if they exist
      if (matchCandidates.length > 1) {
        console.log(
          `[SetMatchingEngine] Alternative candidates for ${pokeDataSet.name}:`
        );
        matchCandidates
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 3)
          .forEach((candidate, index) => {
            console.log(
              `  ${index + 1}. ${
                candidate.tcgSet.name
              } (confidence: ${candidate.confidence.toFixed(2)}, ${
                candidate.reason
              })`
            );
          });
      }
    } else {
      console.log(
        `[SetMatchingEngine] No match found for ${pokeDataSet.name} (code: ${pokeDataCode})`
      );
    }

    return bestMatch;
  }

  /**
   * Get the current similarity threshold
   */
  public getSimilarityThreshold(): number {
    return this.similarityThreshold;
  }

  /**
   * Get match quality statistics for a set of matches
   */
  public getMatchQualityStats(matches: MatchResult[]): {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    unmatched: number;
    averageConfidence: number;
  } {
    const stats = {
      total: matches.length,
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      unmatched: 0,
      averageConfidence: 0,
    };

    let totalConfidence = 0;

    matches.forEach((match) => {
      if (!match.tcgSet) {
        stats.unmatched++;
      } else if (match.confidence >= 0.8) {
        stats.highConfidence++;
        totalConfidence += match.confidence;
      } else if (match.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        stats.mediumConfidence++;
        totalConfidence += match.confidence;
      } else {
        stats.lowConfidence++;
        totalConfidence += match.confidence;
      }
    });

    stats.averageConfidence =
      matches.length > 0 ? totalConfidence / matches.length : 0;

    return stats;
  }
}
