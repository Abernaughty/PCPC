import type { EnhancedPriceData } from '../models/types';
import { getConfig } from '../config';

export interface PokeDataSet {
  code: string | null;
  id: number;
  language: 'ENGLISH' | 'JAPANESE';
  name: string;
  release_date: string;
}

interface PokeDataCard {
  id: number;
  language: string;
  name: string;
  num: string;
  release_date: string;
  secret: boolean;
  set_code: string | null;
  set_id: number;
  set_name: string;
}

interface PokeDataPricing {
  id: number;
  language: string;
  name: string;
  num: string;
  pricing: Record<
    string,
    {
      currency: string;
      value: number;
    }
  >;
}

export interface IPokeDataApiService {
  getAllSets(): Promise<PokeDataSet[]>;
  getSetIdByCode(setCode: string): Promise<number | null>;
  getCardsInSet(setId: number): Promise<PokeDataCard[]>;
  getCardsInSetByCode(setCode: string): Promise<PokeDataCard[]>;
  getCardIdBySetAndNumber(setId: number, cardNumber: string): Promise<number | null>;
  getCardIdBySetCodeAndNumber(setCode: string, cardNumber: string): Promise<number | null>;
  getCardPricingById(pokeDataId: number): Promise<any>;
  getCardPricing(cardId: string, pokeDataId?: number): Promise<EnhancedPriceData | null>;
  getFullCardDetailsById(pokeDataId: number): Promise<any>;
  checkCreditsRemaining(): Promise<{ creditsRemaining: number; status: string } | null>;
}

export class PokeDataApiService implements IPokeDataApiService {
  private apiKey: string;
  private baseUrl: string;
  private cacheTTL: number = 24 * 60 * 60 * 1000;

  private setsCache: {
    data: PokeDataSet[] | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };

  private cardsCache: Record<
    number,
    {
      data: PokeDataCard[] | null;
      timestamp: number;
    }
  > = {};

  private setCodeToIdMap: Record<string, number> = {};

  constructor(apiKey: string, baseUrl: string = 'https://www.pokedata.io/v0') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    console.log(`[PokeDataApiService] Initializing...`);
    console.log(`[PokeDataApiService] Base URL: ${this.baseUrl}`);
    console.log(
      `[PokeDataApiService] API Key: ${this.apiKey ? `SET (${this.apiKey.substring(0, 20)}...)` : 'MISSING'}`
    );
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTTL;
  }

  async getAllSets(): Promise<PokeDataSet[]> {
    const startTime = Date.now();

    if (this.setsCache.data && this.isCacheValid(this.setsCache.timestamp)) {
      console.log(
        `[PokeDataApiService] Returning cached sets (${this.setsCache.data.length} sets)`
      );
      return this.setsCache.data;
    }

    try {
      console.log('[PokeDataApiService] Fetching all sets from PokeData API');

      const response = await fetch(`${this.baseUrl}/sets`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`PokeData API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as PokeDataSet[];
      const duration = Date.now() - startTime;

      console.log(
        `[PokeDataApiService] Retrieved ${data.length} sets from PokeData API (${duration}ms)`
      );

      this.setsCache = {
        data,
        timestamp: Date.now(),
      };

      data.forEach((set) => {
        if (set.code) {
          this.setCodeToIdMap[set.code] = set.id;
        }
      });

      return data;
    } catch (error) {
      console.error('[PokeDataApiService] Error fetching sets:', error);
      throw error;
    }
  }

  async getSetIdByCode(setCode: string): Promise<number | null> {
    if (this.setCodeToIdMap[setCode]) {
      return this.setCodeToIdMap[setCode];
    }

    try {
      const sets = await this.getAllSets();
      const set = sets.find((s) => s.code === setCode);
      return set ? set.id : null;
    } catch (error) {
      console.error(`[PokeDataApiService] Error getting set ID for code ${setCode}:`, error);
      return null;
    }
  }

  async getCardsInSet(setId: number): Promise<PokeDataCard[]> {
    if (
      this.cardsCache[setId]?.data &&
      this.isCacheValid(this.cardsCache[setId].timestamp)
    ) {
      console.log(
        `[PokeDataApiService] Returning cached cards for set ${setId} (${this.cardsCache[setId].data?.length} cards)`
      );
      return this.cardsCache[setId].data || [];
    }

    try {
      console.log(`[PokeDataApiService] Fetching cards for set ${setId}`);

      const response = await fetch(`${this.baseUrl}/sets/${setId}/cards`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`PokeData API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as PokeDataCard[];

      console.log(`[PokeDataApiService] Retrieved ${data.length} cards for set ${setId}`);

      if (!this.cardsCache[setId]) {
        this.cardsCache[setId] = { data: null, timestamp: 0 };
      }

      this.cardsCache[setId] = {
        data,
        timestamp: Date.now(),
      };

      return data;
    } catch (error) {
      console.error(`[PokeDataApiService] Error fetching cards for set ${setId}:`, error);
      throw error;
    }
  }

  async getCardsInSetByCode(setCode: string): Promise<PokeDataCard[]> {
    try {
      const setId = await this.getSetIdByCode(setCode);
      if (!setId) {
        console.warn(`[PokeDataApiService] Set code ${setCode} not found`);
        return [];
      }
      return this.getCardsInSet(setId);
    } catch (error) {
      console.error(
        `[PokeDataApiService] Error fetching cards for set code ${setCode}:`,
        error
      );
      throw error;
    }
  }

  async getCardIdBySetAndNumber(
    setId: number,
    cardNumber: string
  ): Promise<number | null> {
    try {
      const cards = await this.getCardsInSet(setId);
      const card = cards.find((c) => c.num === cardNumber);
      return card ? card.id : null;
    } catch (error) {
      console.error(
        `[PokeDataApiService] Error getting card ID for set ${setId}, number ${cardNumber}:`,
        error
      );
      return null;
    }
  }

  async getCardIdBySetCodeAndNumber(
    setCode: string,
    cardNumber: string
  ): Promise<number | null> {
    try {
      const cards = await this.getCardsInSetByCode(setCode);
      const card = cards.find((c) => c.num === cardNumber);
      return card ? card.id : null;
    } catch (error) {
      console.error(
        `[PokeDataApiService] Error getting card ID for set ${setCode}, number ${cardNumber}:`,
        error
      );
      return null;
    }
  }

  async getCardPricingById(pokeDataId: number): Promise<any> {
    try {
      console.log(`[PokeDataApiService] Fetching pricing for card ${pokeDataId}`);

      const response = await fetch(`${this.baseUrl}/cards/${pokeDataId}/pricing`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`[PokeDataApiService] No pricing found for card ${pokeDataId}`);
          return null;
        }
        throw new Error(`PokeData API returned ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as PokeDataPricing;
      return data;
    } catch (error) {
      console.error(`[PokeDataApiService] Error fetching pricing for card ${pokeDataId}:`, error);
      return null;
    }
  }

  async getCardPricing(
    cardId: string,
    pokeDataId?: number
  ): Promise<EnhancedPriceData | null> {
    try {
      let pricingData: any = null;

      if (pokeDataId) {
        pricingData = await this.getCardPricingById(pokeDataId);
      } else {
        const match = cardId.match(/(\d+)$/);
        if (match) {
          const id = parseInt(match[1], 10);
          pricingData = await this.getCardPricingById(id);
        }
      }

      if (!pricingData) {
        return null;
      }

      return this.mapApiPricingToEnhancedPriceData(pricingData);
    } catch (error) {
      console.error(
        `[PokeDataApiService] Error fetching card pricing for ${cardId}:`,
        error
      );
      return null;
    }
  }

  async getFullCardDetailsById(pokeDataId: number): Promise<any> {
    try {
      console.log(`[PokeDataApiService] Fetching full card details for ${pokeDataId}`);

      const response = await fetch(`${this.baseUrl}/cards/${pokeDataId}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`PokeData API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `[PokeDataApiService] Error fetching full card details for ${pokeDataId}:`,
        error
      );
      return null;
    }
  }

  async checkCreditsRemaining(): Promise<{ creditsRemaining: number; status: string } | null> {
    try {
      console.log('[PokeDataApiService] Checking remaining credits');

      const response = await fetch(`${this.baseUrl}/account`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.warn(
          `[PokeDataApiService] Failed to check credits: ${response.status}`
        );
        return null;
      }

      const data = (await response.json()) as any;
      return {
        creditsRemaining: data.creditsRemaining || 0,
        status: data.status || 'unknown',
      };
    } catch (error) {
      console.error('[PokeDataApiService] Error checking credits:', error);
      return null;
    }
  }

  private mapApiPricingToEnhancedPriceData(pricingData: PokeDataPricing): EnhancedPriceData {
    const enhanced: EnhancedPriceData = {};

    if (pricingData.pricing) {
      Object.entries(pricingData.pricing).forEach(([key, value]) => {
        if (key.startsWith('psa_')) {
          if (!enhanced.psaGrades) enhanced.psaGrades = {};
          const grade = key.replace('psa_', '');
          enhanced.psaGrades[grade] = { value: value.value };
        } else if (key.startsWith('cgc_')) {
          if (!enhanced.cgcGrades) enhanced.cgcGrades = {};
          const grade = key.replace('cgc_', '');
          enhanced.cgcGrades[grade] = { value: value.value };
        } else if (key === 'ebay_raw') {
          enhanced.ebayRaw = { value: value.value };
        }
      });
    }

    return enhanced;
  }
}

let pokeDataApiServiceInstance: PokeDataApiService | null = null;

export function getPokeDataApiService(): PokeDataApiService {
  if (!pokeDataApiServiceInstance) {
    const config = getConfig();
    pokeDataApiServiceInstance = new PokeDataApiService(
      config.pokeDataApiKey,
      config.pokeDataApiBaseUrl
    );
  }
  return pokeDataApiServiceInstance;
}
