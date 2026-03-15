/**
 * IndexedDB Service - Client-side caching for sets, cards, and pricing
 */

import type { PokemonSet, PokemonCard, PricingResult } from '$lib/types';
import { createContextLogger } from './logger';

const log = createContextLogger('db');

const DB_NAME = 'poke-data-db';
const DB_VERSION = 3;

// Store names
const STORE_NAMES = {
  SET_LIST: 'setList',
  CARDS_BY_SET: 'cardsBySet',
  CARD_PRICING: 'cardPricing',
  CURRENT_SETS: 'currentSets',
  CURRENT_SET_CARDS: 'currentSetCards',
  CONFIG: 'config',
} as const;

// Cache durations (in milliseconds)
const CACHE_DURATION = {
  SETS: 24 * 60 * 60 * 1000, // 24 hours
  CARDS: 24 * 60 * 60 * 1000, // 24 hours
  PRICING: 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Open or create the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      log.error('Failed to open database');
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      log.debug('Database opened successfully');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      log.debug(`Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`);

      // Create stores if they don't exist
      const storeNames = Object.values(STORE_NAMES);
      for (const store of storeNames) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id', autoIncrement: true });
        }
      }
    };
  });
}

/**
 * Get all records from a store
 */
async function getAllFromStore<T>(
  storeName: string,
  query?: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = query ? store.getAll(query) : store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get a single record from a store
 */
async function getFromStore<T>(
  storeName: string,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Put a record into a store
 */
async function putInStore<T>(storeName: string, value: T): Promise<IDBValidKey> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      log.debug(`Saved record to store: ${storeName}`);
      resolve(request.result);
    };
  });
}

/**
 * Clear all records from a store
 */
async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      log.debug(`Cleared store: ${storeName}`);
      resolve();
    };
  });
}

/**
 * Database service - main export
 */
export const db = {
  /**
   * Save the list of all sets
   */
  async saveSetList(sets: PokemonSet[]): Promise<void> {
    await clearStore(STORE_NAMES.SET_LIST);
    for (const set of sets) {
      await putInStore(STORE_NAMES.SET_LIST, {
        ...set,
        cacheTime: Date.now(),
      });
    }
    log.info(`Saved ${sets.length} sets to cache`);
  },

  /**
   * Get the cached set list
   */
  async getSetList(): Promise<PokemonSet[] | null> {
    try {
      const sets = await getAllFromStore<PokemonSet & { cacheTime: number }>(
        STORE_NAMES.SET_LIST
      );

      if (!sets.length) return null;

      // Check if cache is still valid
      const cacheTime = sets[0].cacheTime;
      if (Date.now() - cacheTime > CACHE_DURATION.SETS) {
        log.debug('Set list cache expired');
        return null;
      }

      log.debug(`Retrieved ${sets.length} sets from cache`);
      return sets;
    } catch (err) {
      log.error('Error retrieving set list from cache:', err);
      return null;
    }
  },

  /**
   * Save cards for a specific set
   */
  async saveCardsForSet(setId: string | number, cards: PokemonCard[]): Promise<void> {
    for (const card of cards) {
      await putInStore(STORE_NAMES.CARDS_BY_SET, {
        setId,
        card,
        cacheTime: Date.now(),
        id: `${setId}_${card.id}`,
      });
    }
    log.info(`Saved ${cards.length} cards for set ${setId}`);
  },

  /**
   * Get cached cards for a specific set
   */
  async getCardsForSet(setId: string | number): Promise<PokemonCard[] | null> {
    try {
      const records = await getAllFromStore<{
        setId: string | number;
        card: PokemonCard;
        cacheTime: number;
      }>(STORE_NAMES.CARDS_BY_SET);

      const cardsForSet = records.filter((r) => r.setId === setId);

      if (!cardsForSet.length) return null;

      // Check if cache is still valid
      const cacheTime = cardsForSet[0].cacheTime;
      if (Date.now() - cacheTime > CACHE_DURATION.CARDS) {
        log.debug(`Card cache expired for set ${setId}`);
        return null;
      }

      const cards = cardsForSet.map((r) => r.card);
      log.debug(`Retrieved ${cards.length} cards for set ${setId} from cache`);
      return cards;
    } catch (err) {
      log.error(`Error retrieving cards for set ${setId}:`, err);
      return null;
    }
  },

  /**
   * Save pricing data for a card
   */
  async saveCardPricing(
    setId: string | number,
    cardId: string | number,
    pricing: PricingResult
  ): Promise<void> {
    await putInStore(STORE_NAMES.CARD_PRICING, {
      id: `${setId}_${cardId}`,
      setId,
      cardId,
      pricing,
      cacheTime: Date.now(),
    });
    log.debug(`Saved pricing for card ${cardId} in set ${setId}`);
  },

  /**
   * Get cached pricing for a card
   */
  async getCardPricing(
    setId: string | number,
    cardId: string | number
  ): Promise<PricingResult | null> {
    try {
      const key = `${setId}_${cardId}`;
      const record = await getFromStore<{
        pricing: PricingResult;
        cacheTime: number;
      }>(STORE_NAMES.CARD_PRICING, key);

      if (!record) return null;

      // Check if cache is still valid
      if (Date.now() - record.cacheTime > CACHE_DURATION.PRICING) {
        log.debug(`Pricing cache expired for card ${cardId}`);
        return null;
      }

      log.debug(`Retrieved pricing for card ${cardId} from cache`);
      return record.pricing;
    } catch (err) {
      log.error(`Error retrieving pricing for card ${cardId}:`, err);
      return null;
    }
  },

  /**
   * Save set list timestamp
   */
  async saveSetListTimestamp(timestamp: number): Promise<void> {
    await putInStore(STORE_NAMES.CONFIG, {
      id: 'setListTimestamp',
      value: timestamp,
    });
  },

  /**
   * Get set list timestamp
   */
  async getSetListTimestamp(): Promise<number | null> {
    try {
      const record = await getFromStore<{ value: number }>(
        STORE_NAMES.CONFIG,
        'setListTimestamp'
      );
      return record?.value ?? null;
    } catch (err) {
      log.error('Error retrieving set list timestamp:', err);
      return null;
    }
  },

  /**
   * Clear all cached data
   */
  async clearAllData(): Promise<void> {
    try {
      for (const store of Object.values(STORE_NAMES)) {
        await clearStore(store);
      }
      log.info('Cleared all cached data');
    } catch (err) {
      log.error('Error clearing all data:', err);
    }
  },

  /**
   * Clean up expired pricing data
   */
  async cleanupExpiredPricingData(): Promise<number> {
    try {
      const records = await getAllFromStore<{
        id: string;
        cacheTime: number;
      }>(STORE_NAMES.CARD_PRICING);

      let deletedCount = 0;
      const now = Date.now();

      for (const record of records) {
        if (now - record.cacheTime > CACHE_DURATION.PRICING) {
          const db = await openDatabase();
          await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAMES.CARD_PRICING, 'readwrite');
            const store = transaction.objectStore(STORE_NAMES.CARD_PRICING);
            const request = store.delete(record.id);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
          });
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        log.info(`Cleaned up ${deletedCount} expired pricing records`);
      }

      return deletedCount;
    } catch (err) {
      log.error('Error cleaning up expired pricing data:', err);
      return 0;
    }
  },
};
