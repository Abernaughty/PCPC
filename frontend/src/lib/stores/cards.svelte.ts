/**
 * Cards Store - Card data management using Svelte 5 runes
 *
 * Card loading is triggered imperatively by setsStore.selectSet(),
 * NOT via a reactive $effect. This avoids an infinite loop where
 * $effect -> loadCardsForSet -> mutate $state -> re-trigger $effect.
 *
 * Cards now include pricing data from the list fetch (?include=prices),
 * enabling client-side price sorting and instant pricing display.
 */

import { browser } from '$app/environment';
import type { PokemonCard } from '$lib/types';
import { api } from '$lib/services/api';
import { db } from '$lib/services/db';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('cardStore');

/** Sort modes for card list */
export type CardSortMode = 'number' | 'name' | 'rarity' | 'priceDesc' | 'priceAsc';

/** Rarity sort order: higher index = rarer */
const RARITY_SORT_ORDER: Record<string, number> = {
  'Common': 0,
  'Uncommon': 1,
  'Rare': 2,
  'Holo Rare': 3,
  'Ultra Rare': 4,
  'Full Art': 5,
  'Special Art Rare': 6,
  'Hyper Rare': 7,
  'Secret Rare': 8,
  'Illustration Rare': 5,
  'Special Illustration Rare': 6,
  'Double Rare': 3,
  'ACE SPEC Rare': 5,
  'Shiny Rare': 4,
  'Shiny Ultra Rare': 5,
};

/**
 * Get the NM market price for a card's first variant.
 * Used as the sort key for price-based sorting.
 */
function getNmMarketPrice(card: PokemonCard): number {
  if (!card.variants || card.variants.length === 0) return 0;

  for (const variant of card.variants) {
    if (!variant.prices) continue;
    const nmRaw = variant.prices.find(
      (p) => p.type === 'raw' && p.condition === 'NM'
    );
    if (nmRaw) return nmRaw.market;

    // Fall back to any raw price
    const anyRaw = variant.prices.find((p) => p.type === 'raw');
    if (anyRaw) return anyRaw.market;
  }

  return 0;
}

/**
 * Sort cards by the given mode.
 */
function sortCards(cards: PokemonCard[], mode: CardSortMode): PokemonCard[] {
  const sorted = [...cards];

  switch (mode) {
    case 'number':
      sorted.sort((a, b) => {
        const numA = parseInt(a.number ?? a.cardNumber ?? '0', 10) || 0;
        const numB = parseInt(b.number ?? b.cardNumber ?? '0', 10) || 0;
        return numA - numB;
      });
      break;

    case 'name':
      sorted.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
      break;

    case 'rarity':
      sorted.sort((a, b) => {
        const orderA = RARITY_SORT_ORDER[a.rarity ?? ''] ?? -1;
        const orderB = RARITY_SORT_ORDER[b.rarity ?? ''] ?? -1;
        return orderB - orderA; // rarest first
      });
      break;

    case 'priceDesc':
      sorted.sort((a, b) => getNmMarketPrice(b) - getNmMarketPrice(a));
      break;

    case 'priceAsc':
      sorted.sort((a, b) => getNmMarketPrice(a) - getNmMarketPrice(b));
      break;
  }

  return sorted;
}

interface CardsStore {
  cardsInSet: PokemonCard[];
  sortedCards: PokemonCard[];
  selectedCard: PokemonCard | null;
  cardName: string;
  isLoadingCards: boolean;
  sortMode: CardSortMode;
  loadCardsForSet(setId: string, expectedTotal?: number): Promise<void>;
  selectCard(card: PokemonCard): void;
  setSortMode(mode: CardSortMode): void;
  resetCards(): void;
}

/**
 * Create the cards store with Svelte 5 runes
 */
function createCardsStore(): CardsStore {
  let cardsInSet = $state<PokemonCard[]>([]);
  let selectedCard = $state<PokemonCard | null>(null);
  let isLoadingCards = $state<boolean>(false);
  let sortMode = $state<CardSortMode>('number');

  /**
   * Derived: card name from selected card
   */
  let cardName: string = $derived(selectedCard?.name || '');

  /**
   * Derived: sorted card list based on current sort mode
   */
  let sortedCards: PokemonCard[] = $derived(sortCards(cardsInSet, sortMode));

  /**
   * Load cards for a specific set.
   * Called imperatively from setsStore.selectSet() — not from a reactive $effect.
   * Cards now include pricing data from the list fetch.
   * @param setId - The set ID to load cards for
   * @param expectedTotal - The expected number of cards in the set (from set metadata).
   *                        Used to detect stale partial data in IndexedDB cache.
   */
  async function loadCardsForSet(setId: string, expectedTotal?: number): Promise<void> {
    if (isLoadingCards) return;

    isLoadingCards = true;
    log.info(`Loading cards for set ${setId}...`);

    try {
      let cards: PokemonCard[] | null = null;

      // Try cache first, passing expectedTotal for stale-data detection
      if (browser) {
        cards = await db.getCardsForSet(setId, expectedTotal);
        if (cards) {
          log.info(`Retrieved ${cards.length} cards from cache`);
        }
      }

      // Fetch from API if not in cache
      if (!cards) {
        cards = await api.getCardsForSet(setId);
        log.info(`Retrieved ${cards.length} cards from API`);

        // Cache the cards (now includes pricing data)
        if (browser) {
          try {
            await db.saveCardsForSet(setId, cards);
          } catch (err) {
            log.warn('Failed to cache cards:', err);
          }
        }
      }

      // Update store
      cardsInSet = cards;
      selectedCard = null; // Reset selected card when loading new set
      log.info(`Loaded ${cards.length} cards for set ${setId}`);
    } catch (err) {
      log.error(`Failed to load cards for set ${setId}:`, err);
      throw err;
    } finally {
      isLoadingCards = false;
    }
  }

  /**
   * Select a card and update the store
   */
  function selectCard(card: PokemonCard): void {
    selectedCard = card;
    log.debug(`Selected card: ${card.name}`);
  }

  /**
   * Set the sort mode for the card list
   */
  function setSortMode(mode: CardSortMode): void {
    sortMode = mode;
    log.debug(`Sort mode changed to: ${mode}`);
  }

  /**
   * Reset cards state
   */
  function resetCards() {
    cardsInSet = [];
    selectedCard = null;
    sortMode = 'number';
  }

  return {
    get cardsInSet() {
      return cardsInSet;
    },

    get sortedCards() {
      return sortedCards;
    },

    get selectedCard() {
      return selectedCard;
    },

    get cardName() {
      return cardName;
    },

    get isLoadingCards() {
      return isLoadingCards;
    },

    get sortMode() {
      return sortMode;
    },

    loadCardsForSet,
    selectCard,
    setSortMode,
    resetCards,
  };
}

// Export singleton instance
export const cardsStore = createCardsStore();
