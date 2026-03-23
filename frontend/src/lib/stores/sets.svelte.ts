/**
 * Sets Store - Pok\u00e9mon set data management using Svelte 5 runes
 *
 * Supports language filtering (EN / JP / Both) and online-only set
 * visibility. Preferences are persisted to localStorage.
 */

import { browser } from '$app/environment';
import type { PokemonSet, GroupedSets } from '$lib/types';
import { api } from '$lib/services/api';
import { db } from '$lib/services/db';
import { expansionMapper } from '$lib/services/expansionMapper';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('setStore');

/** Language filter options */
export type LanguageFilter = 'en' | 'jp' | 'both';

const PREFS_KEY = 'pcpc_search_prefs';

interface SearchPrefs {
  language: LanguageFilter;
  showOnlineOnly: boolean;
}

function loadPrefs(): SearchPrefs {
  if (!browser) return { language: 'en', showOnlineOnly: false };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        language: parsed.language ?? 'en',
        showOnlineOnly: parsed.showOnlineOnly ?? false,
      };
    }
  } catch {
    // ignore parse errors
  }
  return { language: 'en', showOnlineOnly: false };
}

function savePrefs(prefs: SearchPrefs): void {
  if (!browser) return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

interface SetsStore {
  availableSets: PokemonSet[];
  groupedSetsForDropdown: GroupedSets[];
  selectedSet: PokemonSet | null;
  isLoadingSets: boolean;
  language: LanguageFilter;
  showOnlineOnly: boolean;
  loadSets(forceRefresh?: boolean): Promise<void>;
  selectSet(set: PokemonSet): void;
  clearSet(): void;
  setLanguage(lang: LanguageFilter): Promise<void>;
  setShowOnlineOnly(show: boolean): void;
}

/**
 * Create the sets store with Svelte 5 runes
 */
function createSetsStore(): SetsStore {
  const prefs = loadPrefs();

  let availableSets: PokemonSet[] = $state([]);
  let groupedSetsForDropdown: GroupedSets[] = $state([]);
  let selectedSet: PokemonSet | null = $state(null);
  let isLoadingSets: boolean = $state(false);
  let language: LanguageFilter = $state(prefs.language);
  let showOnlineOnly: boolean = $state(prefs.showOnlineOnly);

  /**
   * Filter sets based on current showOnlineOnly preference
   * and rebuild grouped dropdown data.
   */
  function rebuildGroupedSets(sets: PokemonSet[]): void {
    const filtered = showOnlineOnly
      ? sets
      : sets.filter((s) => !s.isOnlineOnly);

    const grouped = expansionMapper.groupSetsByExpansion(filtered);
    groupedSetsForDropdown = expansionMapper.prepareGroupedSetsForDropdown(grouped);

    log.info(
      `Sets filtered and grouped into ${groupedSetsForDropdown.length} expansions (${filtered.length} sets, showOnlineOnly: ${showOnlineOnly})`
    );
  }

  /**
   * Load sets from API or cache
   */
  async function loadSets(forceRefresh = false): Promise<void> {
    if (isLoadingSets) return;

    isLoadingSets = true;
    log.info(`Loading sets (language: ${language})...`);

    try {
      let sets: PokemonSet[] | null = null;

      // Try cache first if not forcing refresh
      // Note: cache is language-agnostic (stores whatever was last fetched).
      // When language changes, we force a fresh fetch.
      if (!forceRefresh && browser) {
        sets = await db.getSetList();
        if (sets) {
          log.info(`Retrieved ${sets.length} sets from cache`);
        }
      }

      // Fetch from API if not in cache or forced refresh
      if (!sets) {
        sets = await api.getSets(forceRefresh, language);
        log.info(`Retrieved ${sets.length} sets from API (language: ${language})`);

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
      rebuildGroupedSets(sets);
    } catch (err) {
      log.error('Failed to load sets:', err);
      throw err;
    } finally {
      isLoadingSets = false;
    }
  }

  /**
   * Select a set and trigger card loading.
   * Passes the set's expected total to the card store so it can
   * detect and invalidate stale partial caches in IndexedDB.
   */
  async function selectSet(set: PokemonSet): Promise<void> {
    selectedSet = set;
    log.debug(`Selected set: ${set.name} (${set.code})`);

    // Pass expected total for stale-cache detection
    const expectedTotal = set.total ?? set.cardCount ?? undefined;
    const { cardsStore } = await import('./cards.svelte');
    await cardsStore.loadCardsForSet(set.id, expectedTotal);
  }

  /**
   * Clear the selected set and reset dependent state
   */
  function clearSet(): void {
    selectedSet = null;
    log.debug('Cleared selected set');
  }

  /**
   * Change the language filter and reload sets.
   * Clears the selected set and cards since they may not exist
   * in the new language.
   */
  async function setLanguage(lang: LanguageFilter): Promise<void> {
    if (lang === language) return;

    language = lang;
    savePrefs({ language, showOnlineOnly });
    log.info(`Language changed to: ${lang}`);

    // Clear selected set and cards since they may not exist in the new language
    selectedSet = null;
    try {
      const { cardsStore } = await import('./cards.svelte');
      cardsStore.resetCards();
    } catch {
      // cardsStore may not be loaded yet
    }

    // Force refresh from API with new language
    await loadSets(true);
  }

  /**
   * Toggle online-only set visibility.
   * This is a client-side filter \u2014 no API re-fetch needed.
   */
  function setShowOnlineOnly(show: boolean): void {
    showOnlineOnly = show;
    savePrefs({ language, showOnlineOnly });
    log.info(`Show online-only sets: ${show}`);

    // Re-filter the existing sets
    rebuildGroupedSets(availableSets);
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

    get language() {
      return language;
    },

    get showOnlineOnly() {
      return showOnlineOnly;
    },

    loadSets,
    selectSet,
    clearSet,
    setLanguage,
    setShowOnlineOnly,
  };
}

// Export singleton instance
export const setsStore = createSetsStore();
