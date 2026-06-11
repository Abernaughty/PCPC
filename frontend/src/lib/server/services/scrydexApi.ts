import type {
  CardImage,
  CardVariant,
  VariantPrice,
  PriceTrends,
  TrendData,
  ScrydexCard,
  ScrydexExpansion,
  ScrydexListing,
  ScrydexPaginatedResponse,
  ScrydexPrice,
  ScrydexRawPaginatedResponse,
  ScrydexUsage,
  ScrydexVariant,
} from '@pcpc/shared';
import { getConfig } from '../config';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('ScrydexApiService');

// Re-export the canonical types here so existing call sites that
// import them from this module continue to work.
export type {
  ScrydexCard,
  ScrydexExpansion,
  ScrydexImage,
  ScrydexListing,
  ScrydexPaginatedResponse,
  ScrydexPrice,
  ScrydexUsage,
  ScrydexVariant,
} from '@pcpc/shared';

function mapPaginatedResponse<T>(raw: ScrydexRawPaginatedResponse<T>): ScrydexPaginatedResponse<T> {
  return {
    data: raw.data ?? [],
    page: raw.page ?? 0,
    pageSize: raw.page_size ?? 0,
    count: raw.count ?? (raw.data?.length ?? 0),
    totalCount: raw.total_count ?? 0,
  };
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

/**
 * Normalize Scrydex language_code to PCPC display code.
 * API returns 'JA' for Japanese, but we display 'JP' as the common abbreviation.
 */
export function normalizeLanguageCode(code?: string): string {
  if (!code) return 'EN';
  const upper = code.toUpperCase();
  if (upper === 'JA') return 'JP';
  return upper;
}

// ─── Service interface ────────────────────────────────────────────────────────────────

export interface IScrydexApiService {
  getAllExpansions(language?: string): Promise<ScrydexExpansion[]>;
  getExpansion(expansionId: string): Promise<ScrydexExpansion | null>;
  getCardsInExpansion(expansionId: string, page?: number, pageSize?: number): Promise<ScrydexPaginatedResponse<ScrydexCard>>;
  getAllCardsInExpansion(expansionId: string): Promise<ScrydexCard[]>;
  getCard(cardId: string, includePrices?: boolean): Promise<ScrydexCard | null>;
  searchCards(query: string, options?: SearchOptions): Promise<ScrydexPaginatedResponse<ScrydexCard>>;
  getCardListings(cardId: string, options?: ListingOptions): Promise<ScrydexPaginatedResponse<ScrydexListing>>;
  getUsage(): Promise<ScrydexUsage | null>;
}

// ─── Implementation ───────────────────────────────────────────────────────────────────

export class ScrydexApiService implements IScrydexApiService {
  private apiKey: string;
  private teamId: string;
  private baseUrl: string;

  private expansionsCache: Record<string, { data: ScrydexExpansion[]; timestamp: number }> = {};
  private cardsCache: Record<string, { data: ScrydexPaginatedResponse<ScrydexCard> | null; timestamp: number }> = {};
  private cardDetailCache: Record<string, { data: ScrydexCard | null; timestamp: number }> = {};

  private readonly EXPANSION_CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly CARD_CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly PRICING_CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly LISTING_CACHE_TTL = 4 * 60 * 60 * 1000;

  constructor(apiKey: string, teamId: string, baseUrl: string = 'https://api.scrydex.com/pokemon/v1') {
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.baseUrl = baseUrl;
    log.info(
      `Initializing (base URL: ${this.baseUrl}, API key ${this.apiKey ? 'set' : 'MISSING'}, team ID ${this.teamId ? 'set' : 'MISSING'})`
    );
  }

  private getHeaders(): Record<string, string> {
    return { 'X-Api-Key': this.apiKey, 'X-Team-ID': this.teamId, 'Content-Type': 'application/json' };
  }

  private isCacheValid(timestamp: number, ttl: number): boolean {
    return Date.now() - timestamp < ttl;
  }

  private async fetchWithRetry<T>(url: string, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, { headers: this.getHeaders() });
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
          log.warn(`Rate limited (429), waiting ${retryAfter}s before retry ${attempt}/${maxRetries}...`);
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        if (!response.ok) throw new Error(`Scrydex API returned ${response.status}: ${response.statusText}`);
        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        log.warn(`Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
        if (attempt < maxRetries) {
          const backoff = 1000 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
    throw lastError || new Error(`Scrydex API request failed after ${maxRetries} retries`);
  }

  private async fetchPaginated<T>(url: string): Promise<ScrydexPaginatedResponse<T>> {
    const raw = await this.fetchWithRetry<ScrydexRawPaginatedResponse<T>>(url);
    return mapPaginatedResponse(raw);
  }

  // ─── Expansion endpoints ───

  async getAllExpansions(language: string = 'en'): Promise<ScrydexExpansion[]> {
    const cached = this.expansionsCache[language];
    if (cached?.data && this.isCacheValid(cached.timestamp, this.EXPANSION_CACHE_TTL)) {
      log.debug(`Returning cached expansions for '${language}' (${cached.data.length} expansions)`);
      return cached.data;
    }
    if (!this.apiKey) throw new Error('Scrydex API key not configured. Please set SCRYDEX_API_KEY in your .env file');

    const startTime = Date.now();
    try {
      const allExpansions: ScrydexExpansion[] = [];
      let currentPage = 1;
      const fetchPageSize = 100;

      while (true) {
        const response = await this.fetchPaginated<ScrydexExpansion>(
          `${this.baseUrl}/${language}/expansions?page=${currentPage}&page_size=${fetchPageSize}`
        );
        allExpansions.push(...response.data);
        currentPage++;
        if (response.data.length === 0 || response.data.length < fetchPageSize) break;
      }

      const duration = Date.now() - startTime;
      log.info(`Retrieved ${allExpansions.length} expansions for '${language}' (${duration}ms)`);
      this.expansionsCache[language] = { data: allExpansions, timestamp: Date.now() };
      return allExpansions;
    } catch (error) {
      log.error('Error fetching expansions:', error);
      throw error;
    }
  }

  async getExpansion(expansionId: string): Promise<ScrydexExpansion | null> {
    try {
      const response = await this.fetchWithRetry<{ data: ScrydexExpansion }>(`${this.baseUrl}/expansions/${expansionId}`);
      return response.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) { log.debug(`Expansion ${expansionId} not found`); return null; }
      log.error(`Error fetching expansion ${expansionId}:`, error);
      throw error;
    }
  }

  // ─── Card endpoints ───

  async getCardsInExpansion(expansionId: string, page: number = 1, pageSize: number = 100): Promise<ScrydexPaginatedResponse<ScrydexCard>> {
    const cacheKey = `${expansionId}-p${page}-s${pageSize}`;
    if (this.cardsCache[cacheKey]?.data && this.isCacheValid(this.cardsCache[cacheKey].timestamp, this.CARD_CACHE_TTL)) {
      log.debug(`Returning cached cards for expansion ${expansionId} (page ${page})`);
      return this.cardsCache[cacheKey].data!;
    }
    try {
      const url = `${this.baseUrl}/expansions/${expansionId}/cards?page=${page}&page_size=${pageSize}&select=${CARD_LIST_SELECT_FIELDS}&include=prices`;
      const response = await this.fetchPaginated<ScrydexCard>(url);
      log.debug(`Retrieved ${response.data.length} cards for expansion ${expansionId} (page ${response.page || page}, totalCount ${response.totalCount || 'n/a'})`);
      this.cardsCache[cacheKey] = { data: response, timestamp: Date.now() };
      return response;
    } catch (error) {
      log.error(`Error fetching cards for expansion ${expansionId}:`, error);
      throw error;
    }
  }

  async getAllCardsInExpansion(expansionId: string): Promise<ScrydexCard[]> {
    const allCards: ScrydexCard[] = [];
    let currentPage = 1;
    const fetchPageSize = 100;

    while (true) {
      const response = await this.getCardsInExpansion(expansionId, currentPage, fetchPageSize);
      allCards.push(...response.data);
      currentPage++;
      if (response.data.length === 0 || response.data.length < fetchPageSize) break;
    }

    log.info(`Retrieved all ${allCards.length} cards for expansion ${expansionId}`);
    return allCards;
  }

  async getCard(cardId: string, includePrices: boolean = false): Promise<ScrydexCard | null> {
    const cacheKey = `${cardId}-prices:${includePrices}`;
    if (this.cardDetailCache[cacheKey]?.data && this.isCacheValid(this.cardDetailCache[cacheKey].timestamp, includePrices ? this.PRICING_CACHE_TTL : this.CARD_CACHE_TTL)) {
      log.debug(`Returning cached card ${cardId} (includePrices: ${includePrices})`);
      return this.cardDetailCache[cacheKey].data;
    }
    try {
      const includeParam = includePrices ? '?include=prices' : '';
      const response = await this.fetchWithRetry<{ data: ScrydexCard }>(`${this.baseUrl}/cards/${cardId}${includeParam}`);
      this.cardDetailCache[cacheKey] = { data: response.data, timestamp: Date.now() };
      return response.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) { log.debug(`Card ${cardId} not found`); return null; }
      log.error(`Error fetching card ${cardId}:`, error);
      throw error;
    }
  }

  async searchCards(query: string, options: SearchOptions = {}): Promise<ScrydexPaginatedResponse<ScrydexCard>> {
    const { page = 1, pageSize = 25, language = 'en' } = options;
    try {
      const params = new URLSearchParams({ q: query, page: String(page), page_size: String(pageSize) });
      const response = await this.fetchPaginated<ScrydexCard>(`${this.baseUrl}/${language}/cards/search?${params}`);
      log.debug(`Search returned ${response.data.length} of ${response.totalCount} results`);
      return response;
    } catch (error) {
      log.error(`Error searching cards for "${query}":`, error);
      throw error;
    }
  }

  // ─── Listings endpoint ───

  async getCardListings(cardId: string, options: ListingOptions = {}): Promise<ScrydexPaginatedResponse<ScrydexListing>> {
    const { page = 1, pageSize = 25, condition } = options;
    try {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (condition) params.set('condition', condition);
      const response = await this.fetchPaginated<ScrydexListing>(`${this.baseUrl}/cards/${cardId}/listings?${params}`);
      log.debug(`Retrieved ${response.data.length} listings for card ${cardId}`);
      return response;
    } catch (error) {
      log.error(`Error fetching listings for card ${cardId}:`, error);
      throw error;
    }
  }

  // ─── Usage endpoint ───

  async getUsage(): Promise<ScrydexUsage | null> {
    try {
      const response = await this.fetchWithRetry<{ total_credits: number; remaining_credits: number; used_credits: number; overage_credit_rate: number }>('https://api.scrydex.com/account/v1/usage');
      return { totalCredits: response.total_credits, remainingCredits: response.remaining_credits, usedCredits: response.used_credits, overageCreditRate: response.overage_credit_rate };
    } catch (error) {
      log.error('Error fetching usage:', error);
      return null;
    }
  }
}

// ─── Mapping helpers ───

function mapTrendData(apiTrend?: { price_change: number; percent_change: number }): TrendData | undefined {
  if (!apiTrend) return undefined;
  return { priceChange: apiTrend.price_change, percentChange: apiTrend.percent_change };
}

export function mapScrydexPriceToVariantPrice(price: ScrydexPrice): VariantPrice {
  const trends: PriceTrends | undefined = price.trends ? {
    days1: mapTrendData(price.trends.days_1), days7: mapTrendData(price.trends.days_7),
    days14: mapTrendData(price.trends.days_14), days30: mapTrendData(price.trends.days_30),
    days90: mapTrendData(price.trends.days_90), days180: mapTrendData(price.trends.days_180),
  } : undefined;
  return {
    condition: price.condition, type: price.type, company: price.company, grade: price.grade,
    isPerfect: price.is_perfect, isError: price.is_error, isSigned: price.is_signed,
    low: price.low, mid: price.mid, high: price.high, market: price.market,
    currency: price.currency, trends,
  };
}

export function mapScrydexVariantToCardVariant(variant: ScrydexVariant): CardVariant {
  return {
    name: variant.name,
    images: variant.images?.map((img): CardImage => ({ type: img.type, small: img.small, medium: img.medium, large: img.large })),
    prices: (variant.prices ?? []).map(mapScrydexPriceToVariantPrice),
  };
}

// ─── Singleton accessor ───

let scrydexApiServiceInstance: ScrydexApiService | null = null;

export function getScrydexApiService(): ScrydexApiService {
  if (!scrydexApiServiceInstance) {
    const config = getConfig();
    scrydexApiServiceInstance = new ScrydexApiService(config.scrydexApiKey, config.scrydexTeamId, config.scrydexApiBaseUrl);
  }
  return scrydexApiServiceInstance;
}
