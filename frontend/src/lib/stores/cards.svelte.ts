/**
 * Cards Store - Card data management using Svelte 5 runes
 * Reacts to selectedSet changes in setsStore
 */

import { browser } from '$app/environment';
import type { PokemonCard } from '$lib/types';
import { api } from '$lib/services/api';
import { db } from '$lib/services/db';
import { setsStore } from './sets.svelte';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('cardStore');

interface CardsStore {
  cardsInSet: PokemonCard[];
  selectedCard: PokemonCard | null;
  cardName: string;
  isLoadingCards: boolean;
  loadCardsForSet(setId: string | number): Promise<void>;
  selectCard(card: PokemonCard): void;
}

/**
 * Create the cards store with Svelte 5 runes
 */
function createCardsStore(): CardsStore {
  let cardsInSet: PokemonCard[] = $state([]);
  let selectedCard: PokemonCard | null = $state(null);
  let isLoadingCards: boolean = $state(false);

  /**
   * Derived: card name from selected card
   */
  let cardName = $derived(selectedCard?.name || '');

  /**
   * Load cards for a specific set
   */
  async function loadCardsForSet(setId: string | number): Promise<void> {
    if (isLoadingCards) return;

    isLoadingCards = true;
    log.info(`Loading cards for set ${setId}...`);

    try {
      let cards: PokemonCard[] | null = null;

      // Try cache first
      if (browser) {
        cards = await db.getCardsForSet(setId);
        if (cards) {
          log.info(`Retrieved ${cards.length} cards from cache`);
        }
      }

      // Fetch from API if not in cache
      if (!cards) {
        cards = await api.getCardsForSet(setId);
        log.info(`Retrieved ${cards.length} cards from API`);

        // Cache the cards
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
   * Effect: React to selectedSet changes and load cards
   */
  if (browser) {
    $effect(() => {
      const selectedSet = setsStore.selectedSet;
      if (selectedSet) {
        loadCardsForSet(selectedSet.id).catch((err) => {
          log.error(`Failed to auto-load cards: ${err}`);
        });
      } else {
        cardsInSet = [];
        selectedCard = null;
      }
    });
  }

  return {
    get cardsInSet() {
      return cardsInSet;
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

    loadCardsForSet,
    selectCard,
  };
}

// Export singleton instance
export const cardsStore = createCardsStore();
