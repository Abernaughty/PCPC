import { dbLogger } from '../loggerService';

/**
 * IndexedDB Storage Service
 * Provides persistent storage for set list and card data with enhanced logging
 */

// Database configuration
const DB_NAME = 'poke-data-db';
const DB_VERSION = 3; // Increment version for schema update
const STORES = {
  setList: 'setList',
  cardsBySet: 'cardsBySet',
  cardPricing: 'cardPricing',
  currentSets: 'currentSets',      // Store for current sets
  currentSetCards: 'currentSetCards', // Store for current set cards
  config: 'config'                 // Store for configuration
};

/**
 * Open the IndexedDB database
 * @returns {Promise<IDBDatabase>} The database instance
 */
export const openDatabase = () => {
  dbLogger.debug('Opening IndexedDB database:', DB_NAME, 'version:', DB_VERSION);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = (event) => {
      dbLogger.error('Error opening database:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      dbLogger.debug('Database opened successfully');
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      
      dbLogger.info(`Upgrading database from version ${oldVersion} to ${DB_VERSION}`);
      
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.setList)) {
        dbLogger.info('Creating setList store');
        db.createObjectStore(STORES.setList, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(STORES.cardsBySet)) {
        dbLogger.info('Creating cardsBySet store');
        db.createObjectStore(STORES.cardsBySet, { keyPath: 'setCode' });
      }
      
      // Create cardPricing store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.cardPricing)) {
        dbLogger.info('Creating cardPricing store');
        db.createObjectStore(STORES.cardPricing, { keyPath: 'id' });
      }
      
      // Create new stores for current sets
      if (!db.objectStoreNames.contains(STORES.currentSets)) {
        dbLogger.info('Creating currentSets store');
        db.createObjectStore(STORES.currentSets, { keyPath: 'code' });
      }
      
      if (!db.objectStoreNames.contains(STORES.currentSetCards)) {
        dbLogger.info('Creating currentSetCards store');
        db.createObjectStore(STORES.currentSetCards, { keyPath: 'setCode' });
      }
      
      // Create config store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.config)) {
        dbLogger.info('Creating config store');
        db.createObjectStore(STORES.config, { keyPath: 'id' });
      }
      
      dbLogger.success('Database upgrade completed successfully');
    };
  });
};

/**
 * Database Service for managing persistent storage of card data
 */
export const dbService = {
  /**
   * Save the set list to IndexedDB
   * @param {Array} setList - The array of set objects
   * @returns {Promise<void>}
   */
  async saveSetList(setList) {
    dbLogger.time('saveSetList');
    try {
      dbLogger.debug(`Saving set list with ${setList.length} sets`);
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.setList, 'readwrite');
      const store = transaction.objectStore(STORES.setList);
      
      // We'll store the entire set list as a single record
      const timestamp = Date.now();
      await store.put({
        id: 'pokemonSets',
        data: setList,
        timestamp: timestamp
      });
      
      dbLogger.logDbOperation('save', STORES.setList, 'pokemonSets', { count: setList.length, timestamp });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          dbLogger.success('Set list saved successfully');
          resolve();
        };
        transaction.onerror = (event) => {
          dbLogger.error('Transaction error while saving set list:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      dbLogger.error('Error saving set list:', error);
      throw error;
    } finally {
      dbLogger.timeEnd('saveSetList');
    }
  },
  
  /**
   * Get the set list from IndexedDB
   * @returns {Promise<Array>} The array of set objects
   */
  async getSetList() {
    dbLogger.time('getSetList');
    try {
      dbLogger.debug('Getting set list from IndexedDB');
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.setList, 'readonly');
      const store = transaction.objectStore(STORES.setList);
      
      const request = store.get('pokemonSets');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          // If we have the data in the cache, return it
          if (request.result && request.result.data) {
            const setCount = request.result.data.length;
            const timestamp = request.result.timestamp;
            const age = timestamp ? Math.round((Date.now() - timestamp) / (60 * 60 * 1000)) : 'unknown';
            
            dbLogger.debug(`Found set list in cache with ${setCount} sets, age: ${age} hours`);
            dbLogger.logDbOperation('get', STORES.setList, 'pokemonSets', { count: setCount, age: `${age} hours` });
            
            resolve(request.result.data);
          } else {
            // No data found
            dbLogger.debug('No set list found in cache');
            resolve(null);
          }
        };
        
        request.onerror = (event) => {
          dbLogger.error('Error retrieving set list from IndexedDB:', event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      dbLogger.error('Error getting set list:', error);
      throw error;
    } finally {
      dbLogger.timeEnd('getSetList');
    }
  },
  
  /**
   * Save cards for a specific set to IndexedDB
   * @param {string} setCode - The set code
   * @param {Array} cards - The array of card objects for the set
   * @returns {Promise<void>}
   */
  async saveCardsForSet(setCode, cards) {
    dbLogger.time(`saveCardsForSet-${setCode}`);
    try {
      // Use a fallback key if setCode is null or undefined
      const storageKey = setCode || 'unknown-set';
      
      dbLogger.debug(`Saving ${cards.length} cards for set ${storageKey}`);
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardsBySet, 'readwrite');
      const store = transaction.objectStore(STORES.cardsBySet);
      
      const timestamp = Date.now();
      await store.put({
        setCode: storageKey,
        cards,
        timestamp
      });
      
      dbLogger.logDbOperation('save', STORES.cardsBySet, storageKey, { count: cards.length, timestamp });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => {
          dbLogger.success(`Cards for set ${storageKey} saved successfully`);
          resolve();
        };
        transaction.onerror = (event) => {
          dbLogger.error(`Transaction error while saving cards for set ${storageKey}:`, event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      dbLogger.error(`Error saving cards for set ${setCode}:`, error);
      throw error;
    } finally {
      dbLogger.timeEnd(`saveCardsForSet-${setCode}`);
    }
  },
  
  /**
   * Get cards for a specific set from IndexedDB
   * @param {string} setCode - The set code
   * @returns {Promise<Array>} The array of card objects for the set
   */
  async getCardsForSet(setCode) {
    dbLogger.time(`getCardsForSet-${setCode}`);
    try {
      // Use a fallback key if setCode is null or undefined
      const storageKey = setCode || 'unknown-set';
      
      dbLogger.debug(`Getting cards for set ${storageKey} from IndexedDB`);
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardsBySet, 'readonly');
      const store = transaction.objectStore(STORES.cardsBySet);
      
      const request = store.get(storageKey);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          // If we have the data in the cache, return it
          if (request.result && request.result.cards) {
            const cardCount = request.result.cards.length;
            const timestamp = request.result.timestamp;
            const age = timestamp ? Math.round((Date.now() - timestamp) / (60 * 60 * 1000)) : 'unknown';
            
            dbLogger.debug(`Found ${cardCount} cards for set ${storageKey} in cache, age: ${age} hours`);
            dbLogger.logDbOperation('get', STORES.cardsBySet, storageKey, { count: cardCount, age: `${age} hours` });
            
            resolve(request.result.cards);
          } else {
            // No data found
            dbLogger.debug(`No cards found in cache for set ${storageKey}`);
            resolve(null);
          }
        };
        
        request.onerror = (event) => {
          dbLogger.error(`Error retrieving cards for set ${storageKey} from IndexedDB:`, event.target.error);
          reject(event.target.error);
        };
      });
    } catch (error) {
      dbLogger.error(`Error getting cards for set ${setCode}:`, error);
      throw error;
    } finally {
      dbLogger.timeEnd(`getCardsForSet-${setCode}`);
    }
  },
  
  /**
   * Save pricing data for a specific card to IndexedDB
   * @param {string} cardId - The card ID
   * @param {Object} pricingData - The pricing data for the card
   * @returns {Promise<void>}
   */
  async saveCardPricing(cardId, pricingData) {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardPricing, 'readwrite');
      const store = transaction.objectStore(STORES.cardPricing);
      
      await store.put({
        id: cardId,
        data: pricingData,
        timestamp: Date.now()
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error saving pricing data for card', { cardId, error });
      throw error;
    }
  },
  
  /**
   * Get pricing data for a specific card from IndexedDB
   * @param {string} cardId - The card ID
   * @returns {Promise<Object>} The pricing data for the card
   */
  async getCardPricing(cardId) {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardPricing, 'readonly');
      const store = transaction.objectStore(STORES.cardPricing);
      
      const request = store.get(cardId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result && request.result.data) {
            resolve(request.result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error getting pricing data for card', { cardId, error });
      throw error;
    }
  },
  
  /**
   * Check if we have cards for a specific set in the cache
   * @param {string} setCode - The set code
   * @returns {Promise<boolean>} True if we have the data, false otherwise
   */
  async hasCardsForSet(setCode) {
    try {
      const storageKey = setCode || 'unknown-set';
      const cards = await this.getCardsForSet(storageKey);
      return cards !== null;
    } catch (error) {
      dbLogger.error('Error checking if we have cards for set', { setCode, error });
      return false;
    }
  },
  
  /**
   * Clear specific set data
   * @param {string} setCode - The set code to clear
   * @returns {Promise<void>}
   */
  async clearSetData(setCode) {
    try {
      const storageKey = setCode || 'unknown-set';
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardsBySet, 'readwrite');
      const store = transaction.objectStore(STORES.cardsBySet);
      
      const request = store.delete(storageKey);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error clearing data for set', { setCode, error });
      throw error;
    }
  },
  
  /**
   * Clear pricing data for a specific card
   * @param {string} cardId - The card ID to clear
   * @returns {Promise<void>}
   */
  async clearCardPricing(cardId) {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardPricing, 'readwrite');
      const store = transaction.objectStore(STORES.cardPricing);
      
      const request = store.delete(cardId);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error clearing pricing data for card', { cardId, error });
      throw error;
    }
  },
  
  /**
   * Clear all stored data (useful for testing or resets)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    try {
      const db = await openDatabase();
      const transaction = db.transaction([STORES.setList, STORES.cardsBySet, STORES.cardPricing], 'readwrite');
      
      transaction.objectStore(STORES.setList).clear();
      transaction.objectStore(STORES.cardsBySet).clear();
      transaction.objectStore(STORES.cardPricing).clear();
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error clearing all data', { error });
      throw error;
    }
  },
  
  /**
   * Delete the entire database
   * @returns {Promise<void>}
   */
  async resetDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      
      request.onsuccess = () => resolve();
      
      request.onerror = (event) => {
        dbLogger.error('Error deleting database', { error: event.target.error });
        reject(event.target.error);
      };
      
      request.onblocked = () => {
        // Still attempt to continue
        resolve();
      };
    });
  },
  
  /**
   * Save a current set to IndexedDB
   * @param {Object} set - The set object
   * @returns {Promise<void>}
   */
  async saveCurrentSet(set) {
    try {
      if (!set || !set.code) {
        return;
      }
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.currentSets, 'readwrite');
      const store = transaction.objectStore(STORES.currentSets);
      
      await store.put({
        code: set.code,
        data: set,
        timestamp: Date.now()
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error saving current set', { setCode: set?.code, error });
      throw error;
    }
  },
  
  /**
   * Get a current set from IndexedDB
   * @param {string} setCode - The set code
   * @returns {Promise<Object>} The set object
   */
  async getCurrentSet(setCode) {
    try {
      if (!setCode) {
        return null;
      }
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.currentSets, 'readonly');
      const store = transaction.objectStore(STORES.currentSets);
      
      const request = store.get(setCode);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result && request.result.data) {
            resolve(request.result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error getting current set', { setCode, error });
      throw error;
    }
  },
  
  /**
   * Get all current sets from IndexedDB
   * @returns {Promise<Array>} Array of current set objects
   */
  async getAllCurrentSets() {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.currentSets, 'readonly');
      const store = transaction.objectStore(STORES.currentSets);
      
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.map(item => item.data));
          } else {
            resolve([]);
          }
        };
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error getting all current sets', { error });
      throw error;
    }
  },
  
  /**
   * Save cards for a current set to IndexedDB
   * @param {string} setCode - The set code
   * @param {Array} cards - The array of card objects for the set
   * @returns {Promise<void>}
   */
  async saveCurrentSetCards(setCode, cards) {
    try {
      if (!setCode) {
        return;
      }
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.currentSetCards, 'readwrite');
      const store = transaction.objectStore(STORES.currentSetCards);
      
      await store.put({
        setCode: setCode,
        cards: cards,
        timestamp: Date.now()
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error saving cards for current set', { setCode, error });
      throw error;
    }
  },
  
  /**
   * Get cards for a current set from IndexedDB
   * @param {string} setCode - The set code
   * @returns {Promise<Array>} The array of card objects for the set
   */
  async getCurrentSetCards(setCode) {
    try {
      if (!setCode) {
        return null;
      }
      
      const db = await openDatabase();
      const transaction = db.transaction(STORES.currentSetCards, 'readonly');
      const store = transaction.objectStore(STORES.currentSetCards);
      
      const request = store.get(setCode);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result && request.result.cards) {
            resolve(request.result.cards);
          } else {
            resolve(null);
          }
        };
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error getting cards for current set', { setCode, error });
      throw error;
    }
  },
  
  /**
   * Save current sets configuration to IndexedDB
   * @param {Object} config - The configuration object
   * @returns {Promise<void>}
   */
  async saveCurrentSetsConfig(config) {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.config, 'readwrite');
      const store = transaction.objectStore(STORES.config);
      
      await store.put({
        id: 'currentSetsConfig',
        data: config,
        timestamp: Date.now()
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error saving current sets config', { error });
      throw error;
    }
  },
  
  /**
   * Get current sets configuration from IndexedDB
   * @returns {Promise<Object>} The configuration object
   */
  async getCurrentSetsConfig() {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.config, 'readonly');
      const store = transaction.objectStore(STORES.config);
      
      const request = store.get('currentSetsConfig');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result && request.result.data) {
            resolve(request.result.data);
          } else {
            resolve(null);
          }
        };
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error getting current sets config', { error });
      throw error;
    }
  },
  
  /**
   * Clean up expired pricing data (older than 24 hours)
   * @returns {Promise<number>} Number of records deleted
   */
  async cleanupExpiredPricingData() {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.cardPricing, 'readwrite');
      const store = transaction.objectStore(STORES.cardPricing);
      
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const items = request.result;
          const now = Date.now();
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          let deletedCount = 0;
          
          for (const item of items) {
            if (item.timestamp && (now - item.timestamp > maxAge)) {
              await store.delete(item.id);
              deletedCount++;
            }
          }
          
          resolve(deletedCount);
        };
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error cleaning up expired pricing data', { error });
      throw error;
    }
  },
  
  /**
   * Save the set list timestamp to IndexedDB
   * @param {number} timestamp - The timestamp to save
   * @returns {Promise<void>}
   */
  async saveSetListTimestamp(timestamp) {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.config, 'readwrite');
      const store = transaction.objectStore(STORES.config);
      
      await store.put({
        id: 'setListTimestamp',
        timestamp: timestamp
      });
      
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error saving set list timestamp', { error });
      throw error;
    }
  },
  
  /**
   * Get the set list timestamp from IndexedDB
   * @returns {Promise<number|null>} The timestamp or null if not found
   */
  async getSetListTimestamp() {
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORES.config, 'readonly');
      const store = transaction.objectStore(STORES.config);
      
      const request = store.get('setListTimestamp');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          if (request.result && request.result.timestamp) {
            resolve(request.result.timestamp);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = (event) => reject(event.target.error);
      });
    } catch (error) {
      dbLogger.error('Error getting set list timestamp', { error });
      throw error;
    }
  },
  
  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    try {
      const db = await openDatabase();
      const stats = {};
      
      // Get set list stats
      const setListTx = db.transaction(STORES.setList, 'readonly');
      const setListStore = setListTx.objectStore(STORES.setList);
      const setListCount = await new Promise(resolve => {
        const countRequest = setListStore.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
      stats.setList = setListCount;
      
      // Get current sets stats
      const currentSetsTx = db.transaction(STORES.currentSets, 'readonly');
      const currentSetsStore = currentSetsTx.objectStore(STORES.currentSets);
      const currentSetsCount = await new Promise(resolve => {
        const countRequest = currentSetsStore.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
      stats.currentSets = currentSetsCount;
      
      // Get cards by set stats
      const cardsBySetTx = db.transaction(STORES.cardsBySet, 'readonly');
      const cardsBySetStore = cardsBySetTx.objectStore(STORES.cardsBySet);
      const cardsBySetCount = await new Promise(resolve => {
        const countRequest = cardsBySetStore.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
      stats.cardsBySet = cardsBySetCount;
      
      // Get current set cards stats
      const currentSetCardsTx = db.transaction(STORES.currentSetCards, 'readonly');
      const currentSetCardsStore = currentSetCardsTx.objectStore(STORES.currentSetCards);
      const currentSetCardsCount = await new Promise(resolve => {
        const countRequest = currentSetCardsStore.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
      stats.currentSetCards = currentSetCardsCount;
      
      // Get card pricing stats
      const cardPricingTx = db.transaction(STORES.cardPricing, 'readonly');
      const cardPricingStore = cardPricingTx.objectStore(STORES.cardPricing);
      const cardPricingCount = await new Promise(resolve => {
        const countRequest = cardPricingStore.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
      });
      stats.cardPricing = cardPricingCount;
      
      // Get set list timestamp
      const configTx = db.transaction(STORES.config, 'readonly');
      const configStore = configTx.objectStore(STORES.config);
      const setListTimestamp = await new Promise(resolve => {
        const request = configStore.get('setListTimestamp');
        request.onsuccess = () => {
          if (request.result && request.result.timestamp) {
            resolve(new Date(request.result.timestamp).toLocaleString());
          } else {
            resolve('Unknown');
          }
        };
        request.onerror = () => resolve('Unknown');
      });
      stats.setListTimestamp = setListTimestamp;
      
      return stats;
    } catch (error) {
      dbLogger.error('Error getting cache stats', { error });
      throw error;
    }
  }
};
