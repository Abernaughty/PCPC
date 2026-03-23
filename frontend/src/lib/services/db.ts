/**
 * IndexedDB Service - Client-side caching for sets, cards, and pricing
 *
 * Uses batched transactions for write operations to minimize I/O overhead.
 * Each bulk write (sets, cards) opens the database once and issues all
 * puts within a single transaction, rather than opening N connections
 * for N records.
 *
 * Cache TTLs are tuned to data volatility:
 * - Sets/Cards: 7 days (static post-release, new sets launch ~quarterly)
 * - Pricing: 24 hours (prices fluctuate but not minute-to-minute)
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
  SETS: 7 * 24 * 60 * 60 * 1000,    // 7 days
  CARDS: 7 * 24 * 60 * 60 * 1000,   // 7 days
  PRICING: 24 * 60 * 60 * 1000,     // 24 hours
} as const;

// ----------------------------------------------------------------
// Low-level helpers
// ----------------------------------------------------------------

/**
 * Open or create the IndexedDB database.
 * All helpers below open the DB themselves so callers don't manage
 * connection lifecycle.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      log.error('Failed to open database');
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      log.debug(`Upgrading database from version ${event.oldVersion} to ${DB_VERSION}`);

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
 * Get all records from a store in a single read transaction.
 */
async function getAllFromStore<T>(
  storeName: string,
  query?: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = query ? store.getAll(query) : store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Get a single record from a store.
 */
async function getFromStore<T>(
  storeName: string,
  key: IDBValidKey
): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Put a single record into a store.
 * Use for one-off writes (e.g. pricing, config). For bulk writes
 * prefer batchPutInStore or clearAndBatchPut.
 */
async function putInStore<T>(storeName: string, value: T): Promise<IDBValidKey> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Batch-put multiple records into a store in a single transaction.
 * Opens the database once and issues all puts within one readwrite
 * transaction, letting IndexedDB commit them atomically.
 *
 * This is the core optimisation for issue #4 — avoids N separate
 * openDatabase() + transaction cycles for N records.
 */
async function batchPutInStore<T>(storeName: string, values: T[]): Promise<void> {
  if (values.length === 0) return;

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const value of values) {
      store.put(value);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transaction aborted on ${storeName}`));
  });
}

/**
 * Clear all records in a store then batch-put new records, all within
 * a single transaction. Used by saveSetList where we want an atomic
 * replace of the entire store contents.
 */
async function clearAndBatchPut<T>(storeName: string, values: T[]): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    // Clear first — the puts below execute within the same transaction
    store.clear();

    for (const value of values) {
      store.put(value);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transaction aborted on ${storeName}`));
  });
}

/**
 * Delete specific records by ID then batch-put new records, all
 * within a single transaction. Used by saveCardsForSet where we
 * need to remove stale entries for one set before inserting fresh ones.
 */
async function deleteIdsAndBatchPut<T>(
  storeName: string,
  idsToDelete: IDBValidKey[],
  values: T[]
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const id of idsToDelete) {
      store.delete(id);
    }

    for (const value of values) {
      store.put(value);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transaction aborted on ${storeName}`));
  });
}

/**
 * Delete specific records from a store by their IDs in a single transaction.
 */
async function deleteFromStore(storeName: string, ids: IDBValidKey[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const id of ids) {
      store.delete(id);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error(`Transaction aborted on ${storeName}`));
  });
}

/**
 * Clear all records from a store.
 */
async function clearStore(storeName: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ----------------------------------------------------------------
// Public database service
// ----------------------------------------------------------------

export const db = {
  /**
   * Save the list of all sets.
   * Clears the store and writes all sets in a single atomic transaction.
   */
  async saveSetList(sets: PokemonSet[]): Promise<void> {
    const now = Date.now();
    const records = sets.map((set) => ({ ...set, cacheTime: now }));
    await clearAndBatchPut(STORE_NAMES.SET_LIST, records);
    log.info(`Saved ${sets.length} sets to cache (1 transaction)`);
  },

  /**
   * Get the cached set list.
   */
  async getSetList(): Promise<PokemonSet[] | null> {
    try {
      const sets = await getAllFromStore<PokemonSet & { cacheTime: number }>(
        STORE_NAMES.SET_LIST
      );

      if (!sets.length) return null;

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
   * Save cards for a specific set.
   * Clears any existing cached cards for this set then writes the
   * fresh batch — all in a single atomic transaction.
   */
  async saveCardsForSet(setId: string | number, cards: PokemonCard[]): Promise<void> {
    const now = Date.now();

    // Build the new records
    const records = cards.map((card) => ({
      setId,
      card,
      cacheTime: now,
      id: `${setId}_${card.id}`,
    }));

    // Find stale IDs to delete (cards for this set from a previous cache)
    let staleIds: IDBValidKey[] = [];
    try {
      const existing = await getAllFromStore<{ id: string; setId: string | number }>(
        STORE_NAMES.CARDS_BY_SET
      );
      staleIds = existing
        .filter((r) => r.setId === setId)
        .map((r) => r.id);
    } catch (err) {
      log.warn(`Failed to read stale cards for set ${setId}, proceeding with save:`, err);
    }

    // Delete stale + insert fresh in one transaction
    if (staleIds.length > 0) {
      log.debug(`Replacing ${staleIds.length} stale cards with ${records.length} fresh cards for set ${setId}`);
      await deleteIdsAndBatchPut(STORE_NAMES.CARDS_BY_SET, staleIds, records);
    } else {
      await batchPutInStore(STORE_NAMES.CARDS_BY_SET, records);
    }

    log.info(`Saved ${cards.length} cards for set ${setId} (1 transaction)`);
  },

  /**
   * Get cached cards for a specific set.
   * If expectedTotal is provided and the cached count is lower,
   * treats the cache as stale and returns null.
   */
  async getCardsForSet(setId: string | number, expectedTotal?: number): Promise<PokemonCard[] | null> {
    try {
      const records = await getAllFromStore<{
        setId: string | number;
        card: PokemonCard;
        cacheTime: number;
      }>(STORE_NAMES.CARDS_BY_SET);

      const cardsForSet = records.filter((r) => r.setId === setId);

      if (!cardsForSet.length) return null;

      const cacheTime = cardsForSet[0].cacheTime;
      if (Date.now() - cacheTime > CACHE_DURATION.CARDS) {
        log.debug(`Card cache expired for set ${setId}`);
        return null;
      }

      if (expectedTotal && expectedTotal > 0 && cardsForSet.length < expectedTotal) {
        log.debug(
          `Card cache for set ${setId} has ${cardsForSet.length} cards but expected ${expectedTotal}. Treating as stale.`
        );
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
   * Save pricing data for a single card.
   * Single-record write — putInStore is appropriate here.
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
   * Get cached pricing for a card.
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
   * Save set list timestamp.
   */
  async saveSetListTimestamp(timestamp: number): Promise<void> {
    await putInStore(STORE_NAMES.CONFIG, {
      id: 'setListTimestamp',
      value: timestamp,
    });
  },

  /**
   * Get set list timestamp.
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
   * Clear all cached data.
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
   * Clean up expired pricing data in a single batched delete.
   */
  async cleanupExpiredPricingData(): Promise<number> {
    try {
      const records = await getAllFromStore<{
        id: string;
        cacheTime: number;
      }>(STORE_NAMES.CARD_PRICING);

      const now = Date.now();
      const expiredIds = records
        .filter((r) => now - r.cacheTime > CACHE_DURATION.PRICING)
        .map((r) => r.id);

      if (expiredIds.length > 0) {
        await deleteFromStore(STORE_NAMES.CARD_PRICING, expiredIds);
        log.info(`Cleaned up ${expiredIds.length} expired pricing records (1 transaction)`);
      }

      return expiredIds.length;
    } catch (err) {
      log.error('Error cleaning up expired pricing data:', err);
      return 0;
    }
  },
};
