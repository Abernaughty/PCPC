import type { CardImage, CardVariant, VariantPrice, PriceTrends, TrendData } from '../models/types';
import { getConfig } from '../config';

// ─── Scrydex API response types ─────────────────────────────────────────────────────────────

export interface ScrydexExpansion {
  id: string;
  code: string;
  name: string;
  series: string;
  release_date: string;
  total: number;
  printed_total: number;
  language: string;
  language_code: string;
  is_online_only: boolean;
  logo?: string;
  symbol?: string;
}

export interface ScrydexCard {
  id: string;
  name: string;
  number: string;
  printed_number?: string;
  rarity?: string;
  rarity_code?: string;
  artist?: string;
  language?: string;
  language_code?: string;
  expansion: {
    id: string;
    code: string;
    name: string;
    series?: string;
  };
  images?: ScrydexImage[];
  variants?: ScrydexVariant[];
}

export interface ScrydexImage {
  type: string;
  small: string;
  medium: string;
  large: string;
}

export interface ScrydexVariant {
  name: string;
  images?: ScrydexImage[];
  prices?: ScrydexPrice[];
}

export interface ScrydexPrice {
  condition: string;
  type: 'raw' | 'graded';
  company?: string;
  grade?: string;
  is_perfect: boolean;
  is_error: boolean;
  is_signed: boolean;
  low: number;
  mid?: number;
  high?: number;
  market: number;
  currency: string;
  trends?: {
    days_1?: { price_change: number; percent_change: number };
    days_7?: { price_change: number; percent_change: number };
    days_14?: { price_change: number; percent_change: number };
    days_30?: { price_change: number; percent_change: number };
    days_90?: { price_change: number; percent_change: number };
    days_180?: { price_change: number; percent_change: number };
  };
}

/**
 * Raw paginated response shape from the Scrydex API (snake_case).
 * The API returns: data, page, page_size, count, total_count
 */
interface ScrydexRawPaginatedResponse<T> {
  data: T[];
  page: number;
  page_size: number;
  count: number;
  total_count: number;
}

/**
 * Internal paginated response (camelCase).
 * All code outside this file uses this shape.
 */
export interface ScrydexPaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

/**
 * Map the raw snake_case API response to our internal camelCase type.
 * This is the single boundary where the casing conversion happens.
 */
function mapPaginatedResponse<T>(raw: ScrydexRawPaginatedResponse<T>): ScrydexPaginatedResponse<T> {
  return {
    data: raw.data,
    page: raw.page,
    pageSize: raw.page_size,
    count: raw.count,
    totalCount: raw.total_count,
  };
}

export interface ScrydexUsage {
  totalCredits: number;
  remainingCredits: number;
  usedCredits: number;
  overageCreditRate: number;
}

export interface ScrydexListing {
  id: string;
  seller?: string;
  price?: number;
  currency?: string;
  condition?: string;
  url?: string;
}

export interface SearchOptions {
  page?: number;
  pageSize?: number;
  language?: string;
}

export interface ListingOptions {
  page?: number;
  pageSize?: number;
  condition?: string;
}

// ─── Card list field selection ─────────────────────────────────────────────────────────

/**
 * Fields to select when fetching card lists from the Scrydex API.
 *
 * Only top-level fields are supported (no dot notation).
 * `variants` MUST be included to receive pricing data with ?include=prices.
 *
 * Omitted fields (saves bandwidth per card):
 *   supertype, subtypes, types, hp, level, evolves_from, rules, ancient_trait,
 *   abilities, attacks, weaknesses, resistances, retreat_cost,
 *   converted_retreat_cost, national_pokedex_numbers, flavor_text,
 *   regulation_mark, expansion_sort_order
 *
 * When #22 (rich card data panel) is implemented, expand this list to include:
 *   supertype, subtypes, types, hp, abilities, attacks, flavor_text
 */
export const CARD_LIST_SELECT_FIELDS = [
  'id',
  'name',
  'number',
  'printed_number',
  'rarity',
  'rarity_code',
  'artist',
  'images',
  'variants',
  'expansion',
  'language',
  'language_code',
].join(',');

// ─── Service interface ────────────────────────────────────────────────────────────────

export interface IScrydexApiService {
  getAllExpansions(language?: string): Promise<ScrydexExpansion[]>;
  getExpansion(expansionId: string): Promise<ScrydexExpansion | null>;
  getCardsInExpansion(
    expansionId: string,
    page?: number,
    pageSize?: number
  ): Promise<ScrydexPaginatedResponse<ScrydexCard>>;
  getAllCardsInExpansion(expansionId: string): Promise<ScrydexCard[]>;
  getCard(cardId: string, includePrices?: boolean): Promise<ScrydexCard | null>;
  searchCards(
    query: string,
    options?: SearchOptions
  ): Promise<ScrydexPaginatedResponse<ScrydexCard>>;
  getCardListings(
    cardId: string,
    options?: ListingOptions
  ): Promise<ScrydexPaginatedResponse<ScrydexListing>>;
  getUsage(): Promise<ScrydexUsage | null>;
}

// ─── Implementation ───────────────────────────────────────────────────────────────────

export class ScrydexApiService implements IScrydexApiService {
  private apiKey: string;
  private teamId: string;
  private baseUrl: string;

  // In-memory caches — expansion cache keyed by language to avoid cross-language bleed
  private expansionsCache: Record<
    string,
    { data: ScrydexExpansion[]; timestamp: number }
  > = {};

  private cardsCache: Record<
    string,
    { data: ScrydexPaginatedResponse<ScrydexCard> | null; timestamp: number }
  > = {};

  private cardDetailCache: Record<
    string,
    { data: ScrydexCard | null; timestamp: number }
  > = {};

  // Cache TTLs (in milliseconds)
  private readonly EXPANSION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CARD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly PRICING_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly LISTING_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

  constructor(
    apiKey: string,
    teamId: string,
    baseUrl: string = 'https://api.scrydex.com/pokemon/v1'
  ) {
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.baseUrl = baseUrl;

    console.log('[ScrydexApiService] Initializing...');
    console.log(`[ScrydexApiService] Base URL: ${this.baseUrl}`);
    console.log(
      `[ScrydexApiService] API Key: ${this.apiKey ? `SET (${this.apiKey.substring(0, 8)}...)` : 'MISSING'}`
    );
    console.log(
      `[ScrydexApiService] Team ID: ${this.teamId ? `SET (${this.teamId.substring(0, 8)}...)` : 'MISSING'}`
    );
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-Api-Key': this.apiKey,
      'X-Team-ID': this.teamId,
      'Content-Type': 'application/json',
    };
  }

  private isCacheValid(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl;
  }

  /**
   * Fetch with retry logic and 429 rate-limit handling.
   * Scrydex allows 100 req/s; retries on 429 with Retry-After backoff.
   */
  private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, { headers: this.getHeaders() });

        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get('retry-after') || '1',
            10
          );
          console.warn(
            `[ScrydexApiService] Rate limited (429), waiting ${retryAfter}s before retry ${attempt}/${maxRetries}...`
          );
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }

        if (!response.ok) {
          throw new Error(
            `Scrydex API returned ${response.status}: ${response.statusText}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[ScrydexApiService] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
        );

        if (attempt < maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw lastError || new Error(`Scrydex API request failed after ${maxRetries} retries`);
  }

  /**
   * Fetch a paginated endpoint, mapping the raw snake_case response
   * to our internal camelCase ScrydexPaginatedResponse type.
   */
  private async fetchPaginated<T>(url: string): Promise<ScrydexPaginatedResponse<T>> {
    const raw = await this.fetchWithRetry<ScrydexRawPaginatedResponse<T>>(url);
    return mapPaginatedResponse(raw);
  }

  // ─── Expansion endpoints ──────────────────────────────────────────────────────────

  async getAllExpansions(language: string = 'en'): Promise<ScrydexExpansion[]> {
    // Check language-keyed cache
    const cached = this.expansionsCache[language];
    if (
      cached?.data &&
      this.isCacheValid(cached.timestamp, this.EXPANSION_CACHE_TTL)
    ) {
      console.log(
        `[ScrydexApiService] Returning cached expansions for '${language}' (${cached.data.length} expansions)`
      );
      return cached.data;
    }

    if (!this.apiKey) {
      console.error(
        '[ScrydexApiService] API key is missing. Please configure SCRYDEX_API_KEY in your .env file'
      );
      throw new Error(
        'Scrydex API key not configured. Please set SCRYDEX_API_KEY in your .env file'
      );
    }

    const startTime = Date.now();

    try {
      console.log(
        `[ScrydexApiService] Fetching all expansions (language: ${language})`
      );

      // Paginate through all pages to avoid truncating sets
      const allExpansions: ScrydexExpansion[] = [];
      let currentPage = 1;
      const fetchPageSize = 100;
      let totalCount = Infinity;

      while (allExpansions.length < totalCount) {
        const response = await this.fetchPaginated<ScrydexExpansion>(
          `${this.baseUrl}/${language}/expansions?page=${currentPage}&page_size=${fetchPageSize}`
        );

        allExpansions.push(...response.data);
        totalCount = response.totalCount;
        currentPage++;

        console.log(
          `[ScrydexApiService] Expansions page ${response.page}: ${response.data.length} items, ${allExpansions.length}/${totalCount} total`
        );

        // Safety: break if we got an empty page (shouldn't happen, but prevents infinite loops)
        if (response.data.length === 0) break;
      }

      const duration = Date.now() - startTime;
      console.log(
        `[ScrydexApiService] Retrieved ${allExpansions.length} expansions for '${language}' (${duration}ms)`
      );

      this.expansionsCache[language] = {
        data: allExpansions,
        timestamp: Date.now(),
      };

      return allExpansions;
    } catch (error) {
      console.error('[ScrydexApiService] Error fetching expansions:', error);
      throw error;
    }
  }

  async getExpansion(expansionId: string): Promise<ScrydexExpansion | null> {
    try {
      console.log(
        `[ScrydexApiService] Fetching expansion ${expansionId}`
      );

      const response = await this.fetchWithRetry<{ data: ScrydexExpansion }>(
        `${this.baseUrl}/expansions/${expansionId}`
      );

      return response.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        console.log(
          `[ScrydexApiService] Expansion ${expansionId} not found`
        );
        return null;
      }
      console.error(
        `[ScrydexApiService] Error fetching expansion ${expansionId}:`,
        error
      );
      throw error;
    }
  }

  // ─── Card endpoints ─────────────────────────────────────────────────────────────

  async getCardsInExpansion(
    expansionId: string,
    page: number = 1,
    pageSize: number = 100
  ): Promise<ScrydexPaginatedResponse<ScrydexCard>> {
    const cacheKey = `${expansionId}-p${page}-s${pageSize}`;

    if (
      this.cardsCache[cacheKey]?.data &&
      this.isCacheValid(this.cardsCache[cacheKey].timestamp, this.CARD_CACHE_TTL)
    ) {
      console.log(
        `[ScrydexApiService] Returning cached cards for expansion ${expansionId} (page ${page})`
      );
      return this.cardsCache[cacheKey].data!;
    }

    try {
      console.log(
        `[ScrydexApiService] Fetching cards for expansion ${expansionId} (page ${page}, pageSize ${pageSize})`
      );

      const url = `${this.baseUrl}/expansions/${expansionId}/cards?page=${page}&page_size=${pageSize}&select=${CARD_LIST_SELECT_FIELDS}&include=prices`;

      const response = await this.fetchPaginated<ScrydexCard>(url);

      console.log(
        `[ScrydexApiService] Retrieved ${response.data.length} cards for expansion ${expansionId} (page ${response.page}, totalCount ${response.totalCount})`
      );

      this.cardsCache[cacheKey] = {
        data: response,
        timestamp: Date.now(),
      };

      return response;
    } catch (error) {
      console.error(
        `[ScrydexApiService] Error fetching cards for expansion ${expansionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Fetch ALL cards in an expansion by paginating through every page.
   * Use this when hydrating Cosmos DB or when you need the complete set.
   * Cards are fetched with ?select= and ?include=prices for optimal payloads.
   */
  async getAllCardsInExpansion(expansionId: string): Promise<ScrydexCard[]> {
    const allCards: ScrydexCard[] = [];
    let currentPage = 1;
    const fetchPageSize = 100;
    let totalCount = Infinity;

    console.log(
      `[ScrydexApiService] Fetching ALL cards for expansion ${expansionId}`
    );

    while (allCards.length < totalCount) {
      const response = await this.getCardsInExpansion(
        expansionId,
        currentPage,
        fetchPageSize
      );

      allCards.push(...response.data);
      totalCount = response.totalCount;
      currentPage++;

      console.log(
        `[ScrydexApiService] Cards page ${response.page}: ${response.data.length} items, ${allCards.length}/${totalCount} total`
      );

      // Safety: break if we got an empty page
      if (response.data.length === 0) break;
    }

    console.log(
      `[ScrydexApiService] Retrieved all ${allCards.length}/${totalCount} cards for expansion ${expansionId}`
    );

    return allCards;
  }

  async getCard(
    cardId: string,
    includePrices: boolean = false
  ): Promise<ScrydexCard | null> {
    const cacheKey = `${cardId}-prices:${includePrices}`;

    if (
      this.cardDetailCache[cacheKey]?.data &&
      this.isCacheValid(
        this.cardDetailCache[cacheKey].timestamp,
        includePrices ? this.PRICING_CACHE_TTL : this.CARD_CACHE_TTL
      )
    ) {
      console.log(
        `[ScrydexApiService] Returning cached card ${cardId} (includePrices: ${includePrices})`
      );
      return this.cardDetailCache[cacheKey].data;
    }

    try {
      const includeParam = includePrices ? '?include=prices' : '';
      console.log(
        `[ScrydexApiService] Fetching card ${cardId}${includePrices ? ' with prices' : ''}`
      );

      const response = await this.fetchWithRetry<{ data: ScrydexCard }>(
        `${this.baseUrl}/cards/${cardId}${includeParam}`
      );

      this.cardDetailCache[cacheKey] = {
        data: response.data,
        timestamp: Date.now(),
      };

      return response.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        console.log(`[ScrydexApiService] Card ${cardId} not found`);
        return null;
      }
      console.error(
        `[ScrydexApiService] Error fetching card ${cardId}:`,
        error
      );
      throw error;
    }
  }

  async searchCards(
    query: string,
    options: SearchOptions = {}
  ): Promise<ScrydexPaginatedResponse<ScrydexCard>> {
    const { page = 1, pageSize = 25, language = 'en' } = options;

    try {
      console.log(
        `[ScrydexApiService] Searching cards: "${query}" (page ${page})`
      );

      const params = new URLSearchParams({
        q: query,
        page: String(page),
        page_size: String(pageSize),
      });

      const response = await this.fetchPaginated<ScrydexCard>(
        `${this.baseUrl}/${language}/cards/search?${params}`
      );

      console.log(
        `[ScrydexApiService] Search returned ${response.data.length} of ${response.totalCount} results`
      );

      return response;
    } catch (error) {
      console.error(
        `[ScrydexApiService] Error searching cards for "${query}":`,
        error
      );
      throw error;
    }
  }

  // ─── Listings endpoint ────────────────────────────────────────────────────────────

  async getCardListings(
    cardId: string,
    options: ListingOptions = {}
  ): Promise<ScrydexPaginatedResponse<ScrydexListing>> {
    const { page = 1, pageSize = 25, condition } = options;

    try {
      console.log(
        `[ScrydexApiService] Fetching listings for card ${cardId}`
      );

      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });

      if (condition) {
        params.set('condition', condition);
      }

      const response = await this.fetchPaginated<ScrydexListing>(
        `${this.baseUrl}/cards/${cardId}/listings?${params}`
      );

      console.log(
        `[ScrydexApiService] Retrieved ${response.data.length} listings for card ${cardId}`
      );

      return response;
    } catch (error) {
      console.error(
        `[ScrydexApiService] Error fetching listings for card ${cardId}:`,
        error
      );
      throw error;
    }
  }

  // ─── Usage / account endpoint ─────────────────────────────────────────────────────

  async getUsage(): Promise<ScrydexUsage | null> {
    try {
      console.log('[ScrydexApiService] Fetching API usage');

      // Note: usage endpoint is under /account/v1, not /pokemon/v1
      const response = await this.fetchWithRetry<{
        total_credits: number;
        remaining_credits: number;
        used_credits: number;
        overage_credit_rate: number;
      }>('https://api.scrydex.com/account/v1/usage');

      return {
        totalCredits: response.total_credits,
        remainingCredits: response.remaining_credits,
        usedCredits: response.used_credits,
        overageCreditRate: response.overage_credit_rate,
      };
    } catch (error) {
      console.error('[ScrydexApiService] Error fetching usage:', error);
      return null;
    }
  }
}

// ─── Mapping helpers (Scrydex API → internal types) ──────────────────────────────────

function mapTrendData(
  apiTrend?: { price_change: number; percent_change: number }
): TrendData | undefined {
  if (!apiTrend) return undefined;
  return {
    priceChange: apiTrend.price_change,
    percentChange: apiTrend.percent_change,
  };
}

export function mapScrydexPriceToVariantPrice(price: ScrydexPrice): VariantPrice {
  const trends: PriceTrends | undefined = price.trends
    ? {
        days1: mapTrendData(price.trends.days_1),
        days7: mapTrendData(price.trends.days_7),
        days14: mapTrendData(price.trends.days_14),
        days30: mapTrendData(price.trends.days_30),
        days90: mapTrendData(price.trends.days_90),
        days180: mapTrendData(price.trends.days_180),
      }
    : undefined;

  return {
    condition: price.condition,
    type: price.type,
    company: price.company,
    grade: price.grade,
    isPerfect: price.is_perfect,
    isError: price.is_error,
    isSigned: price.is_signed,
    low: price.low,
    mid: price.mid,
    high: price.high,
    market: price.market,
    currency: price.currency,
    trends,
  };
}

export function mapScrydexVariantToCardVariant(variant: ScrydexVariant): CardVariant {
  return {
    name: variant.name,
    images: variant.images?.map(
      (img): CardImage => ({
        type: img.type,
        small: img.small,
        medium: img.medium,
        large: img.large,
      })
    ),
    prices: (variant.prices ?? []).map(mapScrydexPriceToVariantPrice),
  };
}

// ─── Singleton accessor ────────────────────────────────────────────────────────────────

let scrydexApiServiceInstance: ScrydexApiService | null = null;

export function getScrydexApiService(): ScrydexApiService {
  if (!scrydexApiServiceInstance) {
    const config = getConfig();
    scrydexApiServiceInstance = new ScrydexApiService(
      config.scrydexApiKey,
      config.scrydexTeamId,
      config.scrydexApiBaseUrl
    );
  }
  return scrydexApiServiceInstance;
}
