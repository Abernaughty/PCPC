import { getRuntimeConfig } from "../config/runtimeConfig";
import { fetchWithProxy } from "../corsProxy";
import { apiLogger } from "./loggerService";
import { setClassifier } from "./setClassifier";
import { dbService } from "./storage/db";

/**
 * Helper function to sort sets by release date in descending order
 * @param {Array} sets - Array of set objects
 * @returns {Array} - Sorted array of sets
 */
function sortSetsByReleaseDate(sets) {
  return sets.sort((a, b) => {
    // Compare release dates in descending order (newest first)
    const dateA = new Date(a.release_date || 0);
    const dateB = new Date(b.release_date || 0);
    return dateB - dateA;
  });
}

/**
 * Helper function to ensure all sets have unique IDs
 * @param {Array} sets - Array of set objects
 * @returns {Array} - Array of sets with guaranteed IDs
 */
function ensureSetsHaveIds(sets) {
  if (!sets || !Array.isArray(sets)) return [];

  let highestId = 0;

  // Find the highest existing ID
  sets.forEach((set) => {
    if (set.id && typeof set.id === "number" && set.id > highestId) {
      highestId = set.id;
    }
  });

  // Ensure all sets have an ID
  return sets.map((set) => {
    // If the set already has an ID, return it unchanged
    if (set.id) return set;

    // Otherwise, assign a new unique ID
    highestId += 1;
    return { ...set, id: highestId };
  });
}

/**
 * Service for Pokémon data operations
 */
export const pokeDataService = {
  /**
   * Get the list of all Pokémon card sets
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Array>} Array of set objects
   */
  async getSetList(forceRefresh = true) {
    try {
      // First try to load current sets configuration from database
      await setClassifier.loadFromDatabase(dbService);

      // Start with the static set list to ensure we always have data
      let { setList: staticSetList } = await import("../data/setList");
      staticSetList = ensureSetsHaveIds(staticSetList);

      // Try to get from cache if not forcing refresh
      if (!forceRefresh) {
        const cachedSets = await dbService.getSetList();
        if (cachedSets && cachedSets.length > 0) {
          // Check if cache is recent enough (within 24 hours)
          const cacheTimestamp = await dbService.getSetListTimestamp();
          if (cacheTimestamp) {
            const cacheAge = Date.now() - cacheTimestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours

            if (cacheAge < maxAge) {
              return sortSetsByReleaseDate(ensureSetsHaveIds(cachedSets));
            } else {
              // Start API fetch in background but return cache immediately
              this.refreshSetListInBackground();
              return sortSetsByReleaseDate(ensureSetsHaveIds(cachedSets));
            }
          }

          // If no timestamp, still use cache but try to refresh in background
          this.refreshSetListInBackground();
          return sortSetsByReleaseDate(ensureSetsHaveIds(cachedSets));
        }
      }

      // If forcing refresh or no cache, try API but with a timeout
      try {
        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("API request timed out")), 5000);
        });

        // Create the API fetch promise
        const fetchPromise = this.fetchSetListFromApi();

        // Race the fetch against the timeout
        const sets = await Promise.race([fetchPromise, timeoutPromise]);

        // If we got here, the fetch succeeded before the timeout
        return sortSetsByReleaseDate(sets);
      } catch (apiError) {
        apiLogger.error("Error or timeout fetching sets from API", {
          error: apiError,
        });

        // If API fails, use static data
        return sortSetsByReleaseDate(staticSetList);
      }
    } catch (error) {
      apiLogger.error("Error in getSetList", { error });

      // Final fallback to static data
      const { setList } = await import("../data/setList");
      return sortSetsByReleaseDate(ensureSetsHaveIds(setList));
    }
  },

  /**
   * Refresh the set list in the background without blocking the UI
   * @returns {Promise<void>}
   */
  async refreshSetListInBackground() {
    try {
      // Use setTimeout to push this to the next event loop cycle
      setTimeout(async () => {
        try {
          await this.fetchSetListFromApi();
        } catch (error) {
          apiLogger.error("Background set list refresh failed", { error });
        }
      }, 100);
    } catch (error) {
      apiLogger.error("Error setting up background refresh", { error });
    }
  },

  /**
   * Fetch the set list from the API
   * @returns {Promise<Array>} Array of set objects
   */
  async fetchSetListFromApi() {
    try {
      const config = getRuntimeConfig();
      const url = `${config.apiUrl}/sets`;

      const response = await fetchWithProxy(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const data = await response.json();

      // Process the data to handle different response formats
      let setsData = this.processSetResponse(data);

      // Ensure all sets have IDs
      const processedData = ensureSetsHaveIds(setsData);

      // Update the current sets classifier with the latest data
      setClassifier.updateFromApiData(processedData);

      // Save the updated configuration
      await setClassifier.saveToDatabase(dbService);

      // Cache all sets in the general setList store with timestamp
      if (processedData && Array.isArray(processedData)) {
        await dbService.saveSetList(processedData);
        await dbService.saveSetListTimestamp(Date.now());
      }

      // Separately cache current sets in the currentSets store
      for (const set of processedData) {
        if (set.code && setClassifier.isCurrentSet(set.code)) {
          await dbService.saveCurrentSet(set);
        }
      }

      return processedData;
    } catch (error) {
      apiLogger.error("Error fetching sets from API", { error });
      throw error;
    }
  },

  /**
   * Get cards for a specific set
   * @param {string} setCode - The set code
   * @param {string} setId - The set ID (required)
   * @returns {Promise<Array>} Array of card objects
   */
  async getCardsForSet(setCode, setId) {
    try {
      if (!setId) {
        apiLogger.error("Set ID is required to fetch cards");
        return [];
      }

      // Use setId as fallback cache key if setCode is missing
      if (!setCode) {
        setCode = `id_${setId}`;
      }

      // Check if this is a current set
      const isCurrentSet = setClassifier.isCurrentSet(setCode);

      // For current sets, try to get from currentSetCards store first
      if (isCurrentSet) {
        const currentSetCards = await dbService.getCurrentSetCards(setCode);
        if (currentSetCards && currentSetCards.length > 0) {
          return currentSetCards;
        }
      } else {
        // For legacy sets, try to get from regular cache
        const cachedCards = await dbService.getCardsForSet(setCode);
        if (cachedCards && cachedCards.length > 0) {
          return cachedCards;
        }
      }

      // If not in cache, fetch from API
      const config = getRuntimeConfig();
      const url = `${config.apiUrl}/sets/${encodeURIComponent(setId)}/cards`;

      const response = await fetchWithProxy(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const data = await response.json();

      // Process the cards data
      const cards = this.processCardResponse(data);

      // Cache the results if we have cards
      if (cards.length > 0) {
        // For current sets, cache in both stores
        if (isCurrentSet) {
          await dbService.saveCurrentSetCards(setCode, cards);
        }
        // Always cache in the regular store too
        await dbService.saveCardsForSet(setCode, cards);
      }

      return cards;
    } catch (error) {
      apiLogger.error("Error fetching cards for set", { setCode, error });

      // Try to get from cache as a last resort
      const cachedCards = isCurrentSet
        ? await dbService.getCurrentSetCards(setCode)
        : await dbService.getCardsForSet(setCode);

      if (cachedCards && cachedCards.length > 0) {
        return cachedCards;
      }

      return [];
    }
  },

  /**
   * Get pricing data for a specific card
   * @param {string} cardId - The card ID
   * @returns {Promise<Object>} Card pricing data
   */
  async getCardPricing(cardId) {
    try {
      if (!cardId) {
        throw new Error("Card ID is required to fetch pricing data");
      }

      // Try to get from cache first
      const cachedPricing = await dbService.getCardPricing(cardId);

      // Check if we have valid cached data within TTL
      if (cachedPricing && cachedPricing.data && cachedPricing.timestamp) {
        const now = Date.now();
        const cacheAge = now - cachedPricing.timestamp;
        const ttl = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (cacheAge < ttl) {
          return cachedPricing.data;
        }
      }

      // If not in cache or cache is expired, fetch from API
      const config = getRuntimeConfig();
      const url = `${config.apiUrl}/cards/${encodeURIComponent(cardId)}`;

      const response = await fetchWithProxy(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const data = await response.json();

      // Process the pricing data
      const pricingData = this.processPricingResponse(data);

      // Cache the results
      if (pricingData) {
        await dbService.saveCardPricing(cardId, pricingData);
      }

      return pricingData;
    } catch (error) {
      apiLogger.error("Error fetching pricing for card", { cardId, error });

      // If API fails, try to use cached data regardless of age as a fallback
      const cachedPricing = await dbService.getCardPricing(cardId);
      if (cachedPricing && cachedPricing.data) {
        return cachedPricing.data;
      }

      // If no cache available, throw the error
      throw error;
    }
  },

  /**
   * Get pricing data for a specific card with metadata
   * @param {string} cardId - The card ID
   * @returns {Promise<Object>} Card pricing data with metadata
   */
  async getCardPricingWithMetadata(cardId) {
    try {
      if (!cardId) {
        throw new Error("Card ID is required to fetch pricing data");
      }

      // Try to get from cache first
      const cachedPricing = await dbService.getCardPricing(cardId);

      // Check if we have valid cached data within TTL
      if (cachedPricing && cachedPricing.data && cachedPricing.timestamp) {
        const now = Date.now();
        const cacheAge = now - cachedPricing.timestamp;
        const ttl = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

        if (cacheAge < ttl) {
          return {
            data: cachedPricing.data,
            timestamp: cachedPricing.timestamp,
            fromCache: true,
          };
        }
      }

      // If not in cache or cache is expired, fetch from API
      const config = getRuntimeConfig();
      const url = `${config.apiUrl}/cards/${encodeURIComponent(cardId)}`;

      const response = await fetchWithProxy(url, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response
          .text()
          .catch(() => "Unable to get error details");
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }

      const data = await response.json();

      // Process the pricing data
      const pricingData = this.processPricingResponse(data);

      // Cache the results
      const timestamp = Date.now();
      if (pricingData) {
        await dbService.saveCardPricing(cardId, pricingData);
      }

      return {
        data: pricingData,
        timestamp: timestamp,
        fromCache: false,
      };
    } catch (error) {
      apiLogger.error("Error fetching pricing for card with metadata", {
        cardId,
        error,
      });

      // If API fails, try to use cached data regardless of age as a fallback
      const cachedPricing = await dbService.getCardPricing(cardId);
      if (cachedPricing && cachedPricing.data) {
        return {
          data: cachedPricing.data,
          timestamp: cachedPricing.timestamp,
          fromCache: true,
          isStale: true,
        };
      }

      // If no cache available, throw the error
      throw error;
    }
  },

  /**
   * Preload current sets data
   * @returns {Promise<boolean>} True if successful
   */
  async preloadCurrentSets() {
    try {
      // Get all current set codes
      const currentSetCodes = setClassifier.getCurrentSetCodes();

      // Get all sets
      const allSets = await this.getSetList();

      // Filter to current sets
      const currentSets = allSets.filter(
        (set) => set.code && currentSetCodes.includes(set.code)
      );

      // For each current set, load and cache its cards
      for (const set of currentSets) {
        if (set.id && set.code) {
          // Check if we already have this set's cards cached
          const cachedCards = await dbService.getCurrentSetCards(set.code);
          if (cachedCards && cachedCards.length > 0) {
            continue;
          }

          // Load cards for this set
          await this.getCardsForSet(set.code, set.id);
        }
      }

      return true;
    } catch (error) {
      apiLogger.error("Error preloading current sets", { error });
      return false;
    }
  },

  /**
   * Update current sets configuration
   * @returns {Promise<boolean>} True if successful
   */
  async updateCurrentSetsConfiguration() {
    try {
      // Get all sets
      const allSets = await this.getSetList();

      // Update the classifier with the latest data
      const updated = setClassifier.updateFromApiData(allSets);

      if (updated) {
        // Save the updated configuration
        await setClassifier.saveToDatabase(dbService);

        // Preload cards for any newly added current sets
        await this.preloadCurrentSets();

        return true;
      }

      return false;
    } catch (error) {
      apiLogger.error("Error updating current sets configuration", { error });
      return false;
    }
  },

  /**
   * Process API response for sets
   * @param {Object} data - API response data
   * @returns {Array} Processed set data
   */
  processSetResponse(data) {
    // Handle different response formats
    let setsData = data;

    // Handle data wrapper
    if (!Array.isArray(data) && data.data && Array.isArray(data.data)) {
      setsData = data.data;
    }

    // Handle sets wrapper
    if (!Array.isArray(data) && data.sets && Array.isArray(data.sets)) {
      setsData = data.sets;
    }

    return setsData;
  },

  /**
   * Process API response for cards
   * @param {Object} data - API response data
   * @returns {Array} Processed card data
   */
  processCardResponse(data) {
    let cards = [];

    // Check if we have a cards property in the response
    if (data && data.cards && Array.isArray(data.cards)) {
      cards = data.cards;
    }
    // If no cards property, check if the response itself is an array of cards
    else if (data && Array.isArray(data)) {
      cards = data;
    }
    // If we have a data property with an array
    else if (data && data.data && Array.isArray(data.data)) {
      cards = data.data;
    }
    // If we have a results property with an array
    else if (data && data.results && Array.isArray(data.results)) {
      cards = data.results;
    } else {
      // Try to extract cards from any array property as a last resort
      for (const key in data) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          cards = data[key];
          break;
        }
      }
    }

    return cards;
  },

  /**
   * Process API response for pricing
   * @param {Object} data - API response data
   * @returns {Object} Processed pricing data
   */
  processPricingResponse(data) {
    // Process the pricing data based on the API response format
    let pricingData = data;

    // Check if the API returns a data wrapper object
    if (data && data.data && typeof data.data === "object") {
      pricingData = data.data;
    }

    return pricingData;
  },
};
