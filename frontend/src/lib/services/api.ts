/**
 * API Service - Frontend calls to the active backend.
 *
 * The active backend is owned by `backendStore` (see $lib/backends). This
 * service builds canonical paths (e.g. `/sets?language=en`) and hands them
 * to the active backend's fetcher. Each backend is responsible for
 * translating the canonical path into its own URL and reshaping responses
 * into the canonical Scrydex envelope before returning.
 *
 * That seam is what lets `?backend=vercel|azure` swap implementations
 * without any other consumer noticing.
 */

import type {
  PokemonSet,
  PokemonCard,
  PricingResult,
  ApiResponse,
} from '$lib/types';
import { backendStore } from '$lib/backends';
import { logger } from './logger';

/**
 * Map our LanguageFilter values to Scrydex API language codes.
 * Our UI uses 'jp' but Scrydex API expects 'ja' for Japanese.
 */
function mapLanguageCode(lang: string): string {
  if (lang === 'jp') return 'ja';
  return lang;
}

/**
 * Generic API fetch wrapper with error handling.
 *
 * Routes through whichever `BackendDefinition` is currently active in
 * `backendStore`. The path is canonical (Scrydex-shape, Scrydex query
 * params); each backend's fetcher handles its own translation.
 */
async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const backend = backendStore.active;
  logger.debug(`API request via ${backend.id}: ${path}`);

  try {
    const result: ApiResponse<T> = await backend.fetcher.fetch<T>(path, options);

    if (result.error) {
      logger.error('API returned error:', result.error);
      throw new Error(result.error);
    }

    if (result.data === undefined) {
      throw new Error('API returned empty payload');
    }

    logger.debug(`API response received for ${path} via ${backend.id}`);
    return result.data;
  } catch (err) {
    logger.error(`API fetch failed for ${path} via ${backend.id}:`, err);
    throw err;
  }
}

export const api = {
  /**
   * Get all Pokémon sets.
   * @param forceRefresh - Bypass server cache
   * @param language - Language filter: 'en', 'jp', or 'both'
   */
  async getSets(forceRefresh = false, language = 'en'): Promise<PokemonSet[]> {
    const params = new URLSearchParams();
    if (forceRefresh) params.set('forceRefresh', 'true');
    params.set('all', 'true');

    if (language === 'both') {
      // Fetch EN and JP in parallel, merge results
      const enParams = new URLSearchParams(params);
      enParams.set('language', 'en');
      const enPromise = fetchApi<{ sets: PokemonSet[] }>(
        `/sets?${enParams.toString()}`
      );

      const jaParams = new URLSearchParams(params);
      jaParams.set('language', mapLanguageCode('jp'));
      const jaPromise = fetchApi<{ sets: PokemonSet[] }>(
        `/sets?${jaParams.toString()}`
      );

      const [enResult, jaResult] = await Promise.all([enPromise, jaPromise]);
      return [...enResult.sets, ...jaResult.sets];
    }

    params.set('language', mapLanguageCode(language));
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
