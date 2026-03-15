/**
 * API Service - Frontend calls to SvelteKit API routes
 */

import type {
  PokemonSet,
  PokemonCard,
  PricingResult,
  ApiResponse,
  PaginatedResponse,
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
   * Get all Pokémon sets
   */
  async getSets(forceRefresh = false): Promise<PokemonSet[]> {
    const params = new URLSearchParams();
    if (forceRefresh) params.set('forceRefresh', 'true');
    params.set('all', 'true');

    const result = await fetchApi<{ sets: PokemonSet[] }>(
      `/sets?${params.toString()}`
    );
    return result.sets;
  },

  /**
   * Get cards for a specific set
   */
  async getCardsForSet(setId: string | number): Promise<PokemonCard[]> {
    const result = await fetchApi<PaginatedResponse<PokemonCard>>(
      `/sets/${setId}/cards?pageSize=500`
    );
    return result.items;
  },

  /**
   * Get pricing data for a specific card
   */
  async getCardPricing(
    setId: string | number,
    cardId: string | number
  ): Promise<PricingResult> {
    return fetchApi<PricingResult>(`/sets/${setId}/cards/${cardId}`);
  },
};
