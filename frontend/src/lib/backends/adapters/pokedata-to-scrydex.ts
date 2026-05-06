/**
 * PokeData → Scrydex response shape adapter.
 *
 * TEMPORARY (Phase 1 only). Path B's Azure Functions still return PokeData-
 * shaped data, but the frontend was migrated to Scrydex shapes when it left
 * maber-web. This adapter is the bridge so the live toggle can return real
 * data from both paths in Phase 1 without blocking on the Functions
 * migration.
 *
 * Phase 2 migrates the Functions code to Scrydex schema, after which the
 * adapter is unnecessary and is deleted along with this file.
 *
 * Limitations (acknowledged for the portfolio demo):
 *   - PokeData has no per-variant pricing model, so Path B card responses
 *     will show empty `variants[]` and the UI will render "no pricing
 *     available". This is the expected Phase 1 behavior.
 *   - PokeData lacks several Scrydex metadata fields (series, total,
 *     printedTotal, isOnlineOnly, logo, symbol). They surface as undefined.
 */

import type { PokemonSet, PokemonCard, ApiResponse } from '$lib/types';

interface PokeDataSetListPayload {
  sets?: Array<Record<string, unknown>>;
  pagination?: unknown;
}

interface PokeDataCardListPayload {
  cards?: Array<Record<string, unknown>>;
  pagination?: unknown;
}

/** Convert PokeData language string ("ENGLISH"/"JAPANESE") to Scrydex code ("EN"/"JP"). */
function pokeDataLanguageToCode(language: unknown): string | undefined {
  if (typeof language !== 'string') return undefined;
  if (language === 'JAPANESE') return 'JP';
  if (language === 'ENGLISH') return 'EN';
  return undefined;
}

/** Reshape one PokeData set into a frontend `PokemonSet`. */
function adaptSet(raw: Record<string, unknown>): PokemonSet {
  return {
    id: raw.id !== undefined ? String(raw.id) : '',
    code: typeof raw.code === 'string' ? raw.code : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    series: '',
    releaseDate:
      typeof raw.release_date === 'string'
        ? raw.release_date
        : typeof raw.releaseDate === 'string'
          ? raw.releaseDate
          : undefined,
    language: typeof raw.language === 'string' ? raw.language : undefined,
    languageCode: pokeDataLanguageToCode(raw.language),
    isOnlineOnly: false,
  };
}

/** Reshape one PokeData card into a frontend `PokemonCard` (no pricing). */
function adaptCard(raw: Record<string, unknown>): PokemonCard {
  const id = raw.id !== undefined ? String(raw.id) : '';
  const number =
    typeof raw.cardNumber === 'string'
      ? raw.cardNumber
      : typeof raw.number === 'string'
        ? raw.number
        : undefined;

  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    number,
    cardNumber: number,
    rarity: typeof raw.rarity === 'string' ? raw.rarity : undefined,
    artist: typeof raw.artist === 'string' ? raw.artist : undefined,
    images: [],
    variants: [],
  };
}

/**
 * Adapt a Path B response envelope. Returns the same `ApiResponse<T>` shape
 * the frontend already consumes; only `data` is reshaped.
 *
 * `endpointHint` selects which adapter to apply. We use a hint rather than
 * URL parsing because the canonical path includes query strings and the
 * mapping is endpoint-driven, not URL-driven.
 */
export function adaptPathBEnvelope<T>(
  envelope: ApiResponse<unknown>,
  endpointHint: 'sets' | 'cards-by-set' | 'card-info' | 'health' | 'passthrough'
): ApiResponse<T> {
  if (envelope.error || envelope.data === undefined) {
    return envelope as ApiResponse<T>;
  }

  switch (endpointHint) {
    case 'sets': {
      const payload = envelope.data as PokeDataSetListPayload;
      const adapted = {
        sets: (payload.sets ?? []).map(adaptSet),
        pagination: payload.pagination,
      };
      return { ...envelope, data: adapted as unknown as T };
    }

    case 'cards-by-set': {
      const payload = envelope.data as PokeDataCardListPayload;
      const adapted = {
        cards: (payload.cards ?? []).map(adaptCard),
        pagination: payload.pagination,
      };
      return { ...envelope, data: adapted as unknown as T };
    }

    case 'card-info': {
      // PokeData card detail does not match Scrydex PricingResult; return
      // an empty pricing result so the UI degrades to "no data" rather than
      // crashing on missing variants. Phase 2 replaces this with real data.
      return {
        ...envelope,
        data: { variants: [], metadata: { fromCache: false } } as unknown as T,
      };
    }

    case 'health':
    case 'passthrough':
      return envelope as ApiResponse<T>;
  }
}
