/**
 * API Service - Frontend calls to SvelteKit API routes
 */

import type {
  PokemonSet,
  PokemonCard,
  PricingResult,
  ApiResponse,
} from '$lib/types';
import { logger } from './logger';

const API_BASE = '/api';

/**
 * Generic API fetch wrapper with error handling
 */
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  logger.debug(`API request: ${url}`);

  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: 'Unknown error' }));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      logger.error(`API error (${response.status}):`, errorMsg);
      throw new Error(errorMsg);
    }

    const result: ApiResponse<T> = await response.json();

    if (result.error) {
      logger.error('API returned error:', result.error);
      throw new Error(result.error);
    }

    logger.debug(`API response received for ${path}`);
    return result.data as T;
  } catch (err) {
    logger.error(`API fetch failed for ${path}:`, err);
    throw err;
  }
}

export const api = {
  /**
   * Get all Pok\u00e9mon sets.
   * @param forceRefresh - Bypass server cache
   * @param language - Language filter: 'en', 'jp', or 'both'
   */
  async getSets(forceRefresh = false, language = 'en'): Promise<PokemonSet[]> {
    const params = new URLSearchParams();
    if (forceRefresh) params.set('forceRefresh', 'true');
    params.set('all', 'true');

    if (language === 'both') {
      // Fetch EN and JP in parallel, merge results
      params.set('language', 'en');
      const enPromise = fetchApi<{ sets: PokemonSet[] }>(
        `/sets?${params.toString()}`
      );

      params.set('language', 'jp');
      const jpPromise = fetchApi<{ sets: PokemonSet[] }>(
        `/sets?${params.toString()}`
      );

      const [enResult, jpResult] = await Promise.all([enPromise, jpPromise]);
      return [...enResult.sets, ...jpResult.sets];
    }

    params.set('language', language);
    const result = await fetchApi<{ sets: PokemonSet[] }>(
      `/sets?${params.toString()}`
    );
    return result.sets;
  },

  /**
   * Get cards for a specific set.
   * Cards now include pricing data from the list fetch (?include=prices).
   */
  async getCardsForSet(setId: string): Promise<PokemonCard[]> {
    const result = await fetchApi<{ cards: PokemonCard[]; pagination: any }>(
      `/sets/${setId}/cards?pageSize=500`
    );
    return result.cards;
  },

  /**
   * Get full card data including pricing for a specific card.
   * The card detail route returns the full card with variants/pricing inline.
   * This is now a fallback for deep-link entry and global search —
   * the primary flow gets pricing from the card list fetch.
   */
  async getCardPricing(
    setId: string,
    cardId: string
  ): Promise<PricingResult> {
    return fetchApi<PricingResult>(`/sets/${setId}/cards/${cardId}`);
  },
};
