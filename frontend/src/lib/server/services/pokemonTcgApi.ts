import { getConfig } from '../config';

export interface PokemonTcgSet {
  id: string;
  name: string;
  series: string;
  printedTotal: number;
  total: number;
  legalities?: Record<string, string>;
  ptcgoCode?: string;
  releaseDate: string;
  updatedAt: string;
  images?: {
    symbol?: string;
    logo?: string;
  };
}

export interface PokemonTcgCard {
  id: string;
  name: string;
  supertype: string;
  subtypes?: string[];
  hp?: string;
  types?: string[];
  evolvesFrom?: string;
  evolvesTo?: string[];
  rules?: string[];
  ancientTrait?: {
    name: string;
    text: string;
  };
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  attacks?: Array<{
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage?: string;
    text?: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;
  retreatCost?: string[];
  convertedRetreatCost?: number;
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    legalities?: Record<string, string>;
    ptcgoCode?: string;
    releaseDate: string;
    updatedAt: string;
    images?: {
      symbol?: string;
      logo?: string;
    };
  };
  number: string;
  artist?: string;
  rarity?: string;
  flavorText?: string;
  nationalPokedexNumbers?: number[];
  legalities?: Record<string, string>;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    updatedAt: string;
    prices?: Record<string, { low?: number; mid?: number; high?: number; market?: number }>;
  };
  cardmarket?: {
    url: string;
    updatedAt: string;
    prices?: {
      averageSellPrice?: number;
      lowPrice?: number;
      trendPrice?: number;
      germanProLow?: number;
      suggestedPrice?: number;
      reverseHoloSell?: number;
      reverseHoloLow?: number;
      reverseHoloTrend?: number;
      lowPriceExPlus?: number;
      avg1?: number;
      avg25?: number;
      avg1Foil?: number;
      avg25Foil?: number;
    };
  };
}

export interface IPokeMonTcgApiService {
  getAllSets(): Promise<PokemonTcgSet[]>;
  getSet(setId: string): Promise<PokemonTcgSet | null>;
  getCardsBySet(setId: string, page?: number, pageSize?: number): Promise<PokemonTcgCard[]>;
  getCard(cardId: string): Promise<PokemonTcgCard | null>;
  getCardPricing(cardId: string): Promise<any>;
}

export class PokemonTcgApiService implements IPokeMonTcgApiService {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(apiKey: string, baseUrl: string = 'https://api.pokemontcg.io/v2') {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;

    console.log(`[PokemonTcgApiService] Initializing...`);
    console.log(`[PokemonTcgApiService] Base URL: ${this.baseUrl}`);
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    return headers;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: this.getHeaders(),
        });

        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
            console.warn(
              `[PokemonTcgApiService] Rate limited, waiting ${retryAfter}s before retry...`
            );
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          throw new Error(
            `Pokemon TCG API returned ${response.status}: ${response.statusText}`
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[PokemonTcgApiService] Attempt ${attempt}/${this.maxRetries} failed:`,
          lastError.message
        );

        if (attempt < this.maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryDelay * Math.pow(2, attempt - 1))
          );
        }
      }
    }

    throw lastError || new Error('Unknown error in fetchWithRetry');
  }

  async getAllSets(): Promise<PokemonTcgSet[]> {
    try {
      console.log('[PokemonTcgApiService] Fetching all sets...');

      const url = `${this.baseUrl}/sets?q=legalities.unlimited:legal`;
      const response = await this.fetchWithRetry<{ data: PokemonTcgSet[] }>(url);

      console.log(
        `[PokemonTcgApiService] Retrieved ${response.data.length} sets`
      );
      return response.data;
    } catch (error) {
      console.error('[PokemonTcgApiService] Error fetching sets:', error);
      throw error;
    }
  }

  async getSet(setId: string): Promise<PokemonTcgSet | null> {
    try {
      console.log(`[PokemonTcgApiService] Fetching set ${setId}...`);

      const url = `${this.baseUrl}/sets/${setId}`;
      const response = await this.fetchWithRetry<{ data: PokemonTcgSet }>(url);

      return response.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        console.log(`[PokemonTcgApiService] Set ${setId} not found`);
        return null;
      }
      console.error(`[PokemonTcgApiService] Error fetching set ${setId}:`, error);
      throw error;
    }
  }

  async getCardsBySet(
    setId: string,
    page: number = 1,
    pageSize: number = 250
  ): Promise<PokemonTcgCard[]> {
    try {
      console.log(
        `[PokemonTcgApiService] Fetching cards for set ${setId} (page ${page}, pageSize ${pageSize})...`
      );

      const offset = (page - 1) * pageSize;
      const url =
        `${this.baseUrl}/cards?q=q=set.id:${setId}` +
        `&pageSize=${pageSize}&page=${page}`;

      const response = await this.fetchWithRetry<{ data: PokemonTcgCard[] }>(url);

      console.log(
        `[PokemonTcgApiService] Retrieved ${response.data.length} cards for set ${setId}`
      );
      return response.data;
    } catch (error) {
      console.error(
        `[PokemonTcgApiService] Error fetching cards for set ${setId}:`,
        error
      );
      throw error;
    }
  }

  async getCard(cardId: string): Promise<PokemonTcgCard | null> {
    try {
      console.log(`[PokemonTcgApiService] Fetching card ${cardId}...`);

      const url = `${this.baseUrl}/cards/${cardId}`;
      const response = await this.fetchWithRetry<{ data: PokemonTcgCard }>(url);

      return response.data;
    } catch (error) {
      if ((error as Error).message.includes('404')) {
        console.log(`[PokemonTcgApiService] Card ${cardId} not found`);
        return null;
      }
      console.error(`[PokemonTcgApiService] Error fetching card ${cardId}:`, error);
      throw error;
    }
  }

  async getCardPricing(cardId: string): Promise<any> {
    try {
      const card = await this.getCard(cardId);
      if (!card) {
        return null;
      }

      return {
        tcgplayer: card.tcgplayer || null,
        cardmarket: card.cardmarket || null,
      };
    } catch (error) {
      console.error(
        `[PokemonTcgApiService] Error fetching pricing for card ${cardId}:`,
        error
      );
      return null;
    }
  }
}

let pokemonTcgApiServiceInstance: PokemonTcgApiService | null = null;

export function getPokemonTcgApiService(): PokemonTcgApiService {
  if (!pokemonTcgApiServiceInstance) {
    const config = getConfig();
    pokemonTcgApiServiceInstance = new PokemonTcgApiService(
      config.pokemonTcgApiKey,
      config.pokemonTcgApiBaseUrl
    );
  }
  return pokemonTcgApiServiceInstance;
}
