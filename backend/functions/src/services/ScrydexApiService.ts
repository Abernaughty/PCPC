import type {
  ScrydexExpansion,
  ScrydexCard,
  ScrydexPaginatedResponse,
  ScrydexRawPaginatedResponse,
  ScrydexUsage,
  ScrydexListing,
} from "@pcpc/shared";

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

export const CARD_LIST_SELECT_FIELDS = [
  "id",
  "name",
  "number",
  "printed_number",
  "rarity",
  "rarity_code",
  "artist",
  "images",
  "variants",
  "expansion",
  "language",
  "language_code",
].join(",");

/**
 * Normalize Scrydex language_code to PCPC display code.
 * API returns 'JA' for Japanese, but we display 'JP' as the common abbreviation.
 */
export function normalizeLanguageCode(code?: string): string {
  if (!code) return "EN";
  const upper = code.toUpperCase();
  if (upper === "JA") return "JP";
  return upper;
}

export function mapPaginatedResponse<T>(
  raw: ScrydexRawPaginatedResponse<T>
): ScrydexPaginatedResponse<T> {
  return {
    data: raw.data ?? [],
    page: raw.page ?? 0,
    pageSize: raw.page_size ?? 0,
    count: raw.count ?? raw.data?.length ?? 0,
    totalCount: raw.total_count ?? 0,
  };
}

/**
 * Scrydex API client for the Azure Functions backend.
 *
 * Mirrors frontend/src/lib/server/services/scrydexApi.ts. The two
 * implementations diverge only in env loading (process.env here,
 * SvelteKit $env on the frontend). Until a Phase 2.5 refactor lifts
 * the client into @pcpc/shared, keep changes mirrored.
 */
export class ScrydexApiService implements IScrydexApiService {
  private apiKey: string;
  private teamId: string;
  private baseUrl: string;

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

  private readonly EXPANSION_CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly CARD_CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly PRICING_CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly LISTING_CACHE_TTL = 4 * 60 * 60 * 1000;

  constructor(
    apiKey: string,
    teamId: string,
    baseUrl: string = "https://api.scrydex.com/pokemon/v1"
  ) {
    this.apiKey = apiKey;
    this.teamId = teamId;
    this.baseUrl = baseUrl;
    console.log("[ScrydexApiService] Initializing...");
    console.log(`[ScrydexApiService] Base URL: ${this.baseUrl}`);
    console.log(
      `[ScrydexApiService] API Key: ${
        this.apiKey ? `SET (${this.apiKey.substring(0, 8)}...)` : "MISSING"
      }`
    );
    console.log(
      `[ScrydexApiService] Team ID: ${
        this.teamId ? `SET (${this.teamId.substring(0, 8)}...)` : "MISSING"
      }`
    );
  }

  private getHeaders(): Record<string, string> {
    return {
      "X-Api-Key": this.apiKey,
      "X-Team-ID": this.teamId,
      "Content-Type": "application/json",
    };
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
          const retryAfter = parseInt(
            response.headers.get("retry-after") || "1",
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
    throw (
      lastError ||
      new Error(`Scrydex API request failed after ${maxRetries} retries`)
    );
  }

  private async fetchPaginated<T>(
    url: string
  ): Promise<ScrydexPaginatedResponse<T>> {
    const raw = await this.fetchWithRetry<ScrydexRawPaginatedResponse<T>>(url);
    return mapPaginatedResponse(raw);
  }

  async getAllExpansions(language: string = "en"): Promise<ScrydexExpansion[]> {
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
      throw new Error(
        "Scrydex API key not configured. Set SCRYDEX_API_KEY in environment."
      );
    }

    const startTime = Date.now();
    try {
      console.log(
        `[ScrydexApiService] Fetching all expansions (language: ${language})`
      );
      const allExpansions: ScrydexExpansion[] = [];
      let currentPage = 1;
      const fetchPageSize = 100;

      while (true) {
        const response = await this.fetchPaginated<ScrydexExpansion>(
          `${this.baseUrl}/${language}/expansions?page=${currentPage}&page_size=${fetchPageSize}`
        );
        allExpansions.push(...response.data);
        currentPage++;
        console.log(
          `[ScrydexApiService] Expansions page ${
            response.page || currentPage - 1
          }: ${response.data.length} items, ${allExpansions.length} total so far`
        );
        if (response.data.length === 0 || response.data.length < fetchPageSize)
          break;
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
      console.error(
        "[ScrydexApiService] Error fetching expansions:",
        error
      );
      throw error;
    }
  }

  async getExpansion(expansionId: string): Promise<ScrydexExpansion | null> {
    try {
      console.log(`[ScrydexApiService] Fetching expansion ${expansionId}`);
      const response = await this.fetchWithRetry<{ data: ScrydexExpansion }>(
        `${this.baseUrl}/expansions/${expansionId}`
      );
      return response.data;
    } catch (error) {
      if ((error as Error).message.includes("404")) {
        console.log(`[ScrydexApiService] Expansion ${expansionId} not found`);
        return null;
      }
      console.error(
        `[ScrydexApiService] Error fetching expansion ${expansionId}:`,
        error
      );
      throw error;
    }
  }

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
        `[ScrydexApiService] Retrieved ${response.data.length} cards for expansion ${expansionId} (page ${
          response.page || page
        }, totalCount ${response.totalCount || "n/a"})`
      );
      this.cardsCache[cacheKey] = { data: response, timestamp: Date.now() };
      return response;
    } catch (error) {
      console.error(
        `[ScrydexApiService] Error fetching cards for expansion ${expansionId}:`,
        error
      );
      throw error;
    }
  }

  async getAllCardsInExpansion(expansionId: string): Promise<ScrydexCard[]> {
    const allCards: ScrydexCard[] = [];
    let currentPage = 1;
    const fetchPageSize = 100;
    console.log(
      `[ScrydexApiService] Fetching ALL cards for expansion ${expansionId}`
    );

    while (true) {
      const response = await this.getCardsInExpansion(
        expansionId,
        currentPage,
        fetchPageSize
      );
      allCards.push(...response.data);
      currentPage++;
      console.log(
        `[ScrydexApiService] Cards page ${
          response.page || currentPage - 1
        }: ${response.data.length} items, ${allCards.length} total so far`
      );
      if (response.data.length === 0 || response.data.length < fetchPageSize)
        break;
    }

    console.log(
      `[ScrydexApiService] Retrieved all ${allCards.length} cards for expansion ${expansionId}`
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
      const includeParam = includePrices ? "?include=prices" : "";
      console.log(
        `[ScrydexApiService] Fetching card ${cardId}${
          includePrices ? " with prices" : ""
        }`
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
      if ((error as Error).message.includes("404")) {
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
    const { page = 1, pageSize = 25, language = "en" } = options;
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
      if (condition) params.set("condition", condition);
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

  async getUsage(): Promise<ScrydexUsage | null> {
    try {
      console.log("[ScrydexApiService] Fetching API usage");
      const response = await this.fetchWithRetry<{
        total_credits: number;
        remaining_credits: number;
        used_credits: number;
        overage_credit_rate: number;
      }>("https://api.scrydex.com/account/v1/usage");
      return {
        totalCredits: response.total_credits,
        remainingCredits: response.remaining_credits,
        usedCredits: response.used_credits,
        overageCreditRate: response.overage_credit_rate,
      };
    } catch (error) {
      console.error("[ScrydexApiService] Error fetching usage:", error);
      return null;
    }
  }
}
