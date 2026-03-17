/**
 * Sets Store - Pokémon set data management using Svelte 5 runes
 */

import { browser } from '$app/environment';
import type { PokemonSet, GroupedSets } from '$lib/types';
import { api } from '$lib/services/api';
import { db } from '$lib/services/db';
import { expansionMapper } from '$lib/services/expansionMapper';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('setStore');

interface SetsStore {
  availableSets: PokemonSet[];
  groupedSetsForDropdown: GroupedSets[];
  selectedSet: PokemonSet | null;
  isLoadingSets: boolean;
  loadSets(forceRefresh?: boolean): Promise<void>;
  selectSet(set: PokemonSet): void;
}

/**
 * Create the sets store with Svelte 5 runes
 */
function createSetsStore(): SetsStore {
  let availableSets: PokemonSet[] = $state([]);
  let groupedSetsForDropdown: GroupedSets[] = $state([]);
  let selectedSet: PokemonSet | null = $state(null);
  let isLoadingSets: boolean = $state(false);

  /**
   * Load sets from API or cache
   */
  async function loadSets(forceRefresh = false): Promise<void> {
    if (isLoadingSets) return;

    isLoadingSets = true;
    log.info('Loading sets...');

    try {
      let sets: PokemonSet[] | null = null;

      // Try cache first if not forcing refresh
      if (!forceRefresh && browser) {
        sets = await db.getSetList();
        if (sets) {
          log.info(`Retrieved ${sets.length} sets from cache`);
        }
      }

      // Fetch from API if not in cache or forced refresh
      if (!sets) {
        sets = await api.getSets(forceRefresh);
        log.info(`Retrieved ${sets.length} sets from API`);

        // Cache the sets
        if (browser) {
          try {
            await db.saveSetList(sets);
          } catch (err) {
            log.warn('Failed to cache sets:', err);
          }
        }
      }

      // Update store
      availableSets = sets;

      // Group sets by expansion
      const grouped = expansionMapper.groupSetsByExpansion(sets);
      groupedSetsForDropdown = expansionMapper.prepareGroupedSetsForDropdown(grouped);

      log.info(
        `Sets loaded and grouped into ${groupedSetsForDropdown.length} expansions`
      );
    } catch (err) {
      log.error('Failed to load sets:', err);
      throw err;
    } finally {
      isLoadingSets = false;
    }
  }

  /**
   * Select a set and update the store
   */
  async function selectSet(set: PokemonSet): Promise<void> {
    selectedSet = set;
    log.debug(`Selected set: ${set.name} (${set.code})`);

    // Trigger card loading for the selected set
    // Import cardsStore at the top of the file to use this
    const { cardsStore } = await import('./cards.svelte');
    await cardsStore.loadCardsForSet(set.id);
  }

  return {
    get availableSets() {
      return availableSets;
    },

    get groupedSetsForDropdown() {
      return groupedSetsForDropdown;
    },

    get selectedSet() {
      return selectedSet;
    },

    get isLoadingSets() {
      return isLoadingSets;
    },

    loadSets,
    selectSet,
  };
}

// Export singleton instance
export const setsStore = createSetsStore();
