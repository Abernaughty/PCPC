import axios from "axios";
import { EnhancedPriceData } from "../models/Card";
import { CreditMonitoringService } from "./CreditMonitoringService";

// Define interfaces for PokeData API responses
export interface PokeDataSet {
  code: string | null;
  id: number;
  language: "ENGLISH" | "JAPANESE";
  name: string;
  release_date: string;
}

interface PokeDataCard {
  id: number;
  language: string;
  name: string;
  num: string;
  release_date: string;
  secret: boolean;
  set_code: string | null;
  set_id: number;
  set_name: string;
}

interface PokeDataPricing {
  id: number;
  language: string;
  name: string;
  num: string;
  pricing: Record<
    string,
    {
      currency: string;
      value: number;
    }
  >;
}

export interface IPokeDataApiService {
  // Set related methods
  getAllSets(): Promise<PokeDataSet[]>;
  getSetIdByCode(setCode: string): Promise<number | null>;

  // Card related methods
  getCardsInSet(setId: number): Promise<PokeDataCard[]>;
  getCardsInSetByCode(setCode: string): Promise<PokeDataCard[]>;
  getCardIdBySetAndNumber(
    setId: number,
    cardNumber: string
  ): Promise<number | null>;
  getCardIdBySetCodeAndNumber(
    setCode: string,
    cardNumber: string
  ): Promise<number | null>;

  // Pricing methods
  getCardPricingById(pokeDataId: number): Promise<any>;
  getCardPricing(
    cardId: string,
    pokeDataId?: number
  ): Promise<EnhancedPriceData | null>;

  // NEW: Full card details with pricing
  getFullCardDetailsById(pokeDataId: number): Promise<any>;

  // NEW: Credit monitoring methods
  checkCreditsRemaining(): Promise<{
    creditsRemaining: number;
    status: string;
  } | null>;
}

export class PokeDataApiService implements IPokeDataApiService {
  private apiKey: string;
  private baseUrl: string;
  private cacheTTL: number = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  private creditMonitoringService: CreditMonitoringService;

  // Cache for sets and cards to minimize API calls
  private setsCache: {
    data: PokeDataSet[] | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };

  private cardsCache: Record<
    number,
    {
      data: PokeDataCard[] | null;
      timestamp: number;
    }
  > = {};

  // Code to ID mapping cache
  private setCodeToIdMap: Record<string, number> = {};

  constructor(apiKey: string, baseUrl: string = "https://www.pokedata.io/v0") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.creditMonitoringService = new CreditMonitoringService();

    // Enhanced logging for service initialization
    console.log(`🔥 [PokeDataApiService] Initializing service...`);
    console.log(`🔥 [PokeDataApiService] Base URL: ${this.baseUrl}`);
    console.log(
      `🔥 [PokeDataApiService] API Key: ${
        this.apiKey ? `SET (${this.apiKey.substring(0, 20)}...)` : "MISSING"
      }`
    );
    console.log(`🔥 [PokeDataApiService] Service initialized successfully`);
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.cacheTTL;
  }

  private extractCardIdentifiers(cardId: string): {
    setCode: string;
    number: string;
  } {
    // Extract the set code portion (before the dash) and the numeric portion (after the dash)
    const match = cardId.match(/(.*)-(\d+.*)/);

    if (match) {
      return {
        setCode: match[1], // The set code (e.g., "sv8pt5")
        number: match[2], // The card number (e.g., "155")
      };
    }

    // Fallback if the format doesn't match
    return {
      setCode: "",
      number: cardId,
    };
  }

  /**
   * Get all available sets from PokeData API
   * Caches results to minimize API calls (5 credits per call)
   */
  async getAllSets(): Promise<PokeDataSet[]> {
    const startTime = Date.now();
    const isDebugMode = process.env.DEBUG_MODE === "true";
    console.log(`🔥 [PokeDataApiService] Getting all sets - START`);

    // Check cache first
    if (this.setsCache.data && this.isCacheValid(this.setsCache.timestamp)) {
      const cacheAge = Math.round(
        (Date.now() - this.setsCache.timestamp) / 1000
      );
      console.log(
        `🔥 [PokeDataApiService] Using cached sets data (${this.setsCache.data.length} sets, ${cacheAge}s old)`
      );
      return this.setsCache.data;
    }

    try {
      const url = `${this.baseUrl}/sets`;
      const headers = this.getHeaders();

      // Enhanced request logging
      console.log(`🔥 [PokeDataApiService] Cache miss - making API request`);
      console.log(`🔥 [PokeDataApiService] Making HTTP GET request:`);
      console.log(`🔥 [PokeDataApiService]   URL: ${url}`);
      console.log(`🔥 [PokeDataApiService]   Method: GET`);
      console.log(`🔥 [PokeDataApiService]   User-Agent: axios (default)`);
      console.log(
        `🔥 [PokeDataApiService]   Authorization: ${
          headers.Authorization
            ? `Bearer ${headers.Authorization.substring(7, 27)}...`
            : "❌ MISSING"
        }`
      );
      console.log(
        `🔥 [PokeDataApiService]   Content-Type: ${headers["Content-Type"]}`
      );

      // Debug mode: Log full headers (sanitized)
      if (isDebugMode) {
        console.log(`🔥 [PokeDataApiService] [DEBUG] Full request headers:`, {
          ...headers,
          Authorization: headers.Authorization
            ? "Bearer [REDACTED]"
            : "MISSING",
        });
      }

      const response = await axios.get(url, { headers });
      const requestTime = Date.now() - startTime;

      // Enhanced response logging
      console.log(
        `🔥 [PokeDataApiService] Response received (${requestTime}ms):`
      );
      console.log(
        `🔥 [PokeDataApiService]   Status: ${response.status} ${response.statusText}`
      );
      console.log(
        `🔥 [PokeDataApiService]   Content-Type: ${
          response.headers["content-type"] || "unknown"
        }`
      );
      console.log(
        `🔥 [PokeDataApiService]   Content-Length: ${
          response.headers["content-length"] || "unknown"
        }`
      );
      console.log(
        `🔥 [PokeDataApiService]   Data type: ${typeof response.data}`
      );
      console.log(
        `🔥 [PokeDataApiService]   Data is array: ${Array.isArray(
          response.data
        )}`
      );

      if (Array.isArray(response.data)) {
        const sets = response.data as PokeDataSet[];
        console.log(
          `🔥 [PokeDataApiService] Successfully retrieved ${sets.length} sets`
        );

        // Log first few sets for debugging
        if (sets.length > 0) {
          console.log(
            `🔥 [PokeDataApiService] Sample sets:`,
            sets.slice(0, 3).map((s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              language: s.language,
            }))
          );
        }

        // Update cache
        this.setsCache = {
          data: sets,
          timestamp: Date.now(),
        };

        // Update code to ID mapping
        sets.forEach((set) => {
          if (set.code) {
            this.setCodeToIdMap[set.code.toLowerCase()] = set.id;
          }
        });

        console.log(
          `🔥 [PokeDataApiService] getAllSets completed successfully in ${
            Date.now() - startTime
          }ms`
        );
        return sets;
      }

      console.error(
        `🔥 [PokeDataApiService] Unexpected response format for sets - not an array`
      );
      console.error(`🔥 [PokeDataApiService] Response data:`, response.data);
      return [];
    } catch (error: any) {
      const requestTime = Date.now() - startTime;
      const isDebugMode = process.env.DEBUG_MODE === "true";

      console.error(
        `❌ [PokeDataApiService] ERROR in getAllSets after ${requestTime}ms:`
      );
      console.error(
        `❌ [PokeDataApiService] ==================== API ERROR DETAILS ====================`
      );
      console.error(
        `❌ [PokeDataApiService] Error Type: ${error.constructor.name}`
      );
      console.error(`❌ [PokeDataApiService] Error Message: ${error.message}`);
      console.error(
        `❌ [PokeDataApiService] Error Code: ${error.code || "unknown"}`
      );
      console.error(
        `❌ [PokeDataApiService] Request Duration: ${requestTime}ms`
      );
      console.error(
        `❌ [PokeDataApiService] Timestamp: ${new Date().toISOString()}`
      );

      if (error.response) {
        // Server responded with error status
        console.error(`❌ [PokeDataApiService] === SERVER RESPONSE ERROR ===`);
        console.error(
          `❌ [PokeDataApiService] Response Status: ${error.response.status} ${error.response.statusText}`
        );
        console.error(
          `❌ [PokeDataApiService] Response URL: ${
            error.response.config?.url || "unknown"
          }`
        );
        console.error(`❌ [PokeDataApiService] Response Headers:`, {
          "content-type": error.response.headers["content-type"],
          "content-length": error.response.headers["content-length"],
          server: error.response.headers["server"],
          date: error.response.headers["date"],
          "x-ratelimit-remaining":
            error.response.headers["x-ratelimit-remaining"],
          "x-ratelimit-reset": error.response.headers["x-ratelimit-reset"],
        });
        console.error(
          `❌ [PokeDataApiService] Response Data:`,
          error.response.data
        );

        // Specific troubleshooting for common status codes
        if (error.response.status === 500) {
          console.error(
            `❌ [PokeDataApiService] 🚨 500 INTERNAL SERVER ERROR TROUBLESHOOTING:`
          );
          console.error(
            `❌ [PokeDataApiService]   - This is a server-side error on PokeData API`
          );
          console.error(
            `❌ [PokeDataApiService]   - Check if API endpoint has changed: ${this.baseUrl}/sets`
          );
          console.error(
            `❌ [PokeDataApiService]   - Verify API key is valid and not expired`
          );
          console.error(
            `❌ [PokeDataApiService]   - Check PokeData API status/maintenance`
          );
          console.error(
            `❌ [PokeDataApiService]   - API Key (first 20 chars): ${this.apiKey.substring(
              0,
              20
            )}...`
          );
        } else if (error.response.status === 401) {
          console.error(
            `❌ [PokeDataApiService] 🚨 401 UNAUTHORIZED - API Key Issue`
          );
          console.error(
            `❌ [PokeDataApiService]   - API Key present: ${!!this.apiKey}`
          );
          console.error(
            `❌ [PokeDataApiService]   - API Key format: ${
              this.apiKey ? "JWT-like" : "MISSING"
            }`
          );
        } else if (error.response.status === 403) {
          console.error(
            `❌ [PokeDataApiService] 🚨 403 FORBIDDEN - Possible credit exhaustion`
          );
        } else if (error.response.status === 429) {
          console.error(`❌ [PokeDataApiService] 🚨 429 RATE LIMITED`);
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error(
          `❌ [PokeDataApiService] === NETWORK/CONNECTION ERROR ===`
        );
        console.error(
          `❌ [PokeDataApiService] No response received from server`
        );
        console.error(
          `❌ [PokeDataApiService] Request URL: ${
            error.config?.url || this.baseUrl + "/sets"
          }`
        );
        console.error(
          `❌ [PokeDataApiService] Request Method: ${
            error.config?.method || "GET"
          }`
        );
        console.error(
          `❌ [PokeDataApiService] Request Timeout: ${
            error.config?.timeout || "default"
          }`
        );
        console.error(
          `❌ [PokeDataApiService] Network Error Type: ${error.code}`
        );

        // Network troubleshooting
        console.error(`❌ [PokeDataApiService] 🚨 NETWORK TROUBLESHOOTING:`);
        console.error(
          `❌ [PokeDataApiService]   - Check internet connectivity`
        );
        console.error(
          `❌ [PokeDataApiService]   - Verify PokeData API is accessible: ${this.baseUrl}`
        );
        console.error(
          `❌ [PokeDataApiService]   - Check for firewall/proxy issues`
        );
        console.error(
          `❌ [PokeDataApiService]   - DNS resolution for: ${
            new URL(this.baseUrl).hostname
          }`
        );
      } else {
        // Request setup error
        console.error(`❌ [PokeDataApiService] === REQUEST SETUP ERROR ===`);
        console.error(`❌ [PokeDataApiService] Error setting up request`);
        console.error(`❌ [PokeDataApiService] Stack trace:`, error.stack);
      }

      // Debug mode: Additional troubleshooting info
      if (isDebugMode) {
        console.error(`❌ [PokeDataApiService] [DEBUG] Full error object:`, {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack?.split("\n").slice(0, 5), // First 5 lines of stack
          config: error.config
            ? {
                url: error.config.url,
                method: error.config.method,
                baseURL: error.config.baseURL,
                timeout: error.config.timeout,
                headers: {
                  ...error.config.headers,
                  Authorization: error.config.headers?.Authorization
                    ? "Bearer [REDACTED]"
                    : "MISSING",
                },
              }
            : "No config",
        });
      }

      console.error(
        `❌ [PokeDataApiService] ============================================================`
      );

      // Try to provide helpful next steps
      console.error(
        `❌ [PokeDataApiService] 💡 NEXT STEPS FOR TROUBLESHOOTING:`
      );
      console.error(
        `❌ [PokeDataApiService]   1. Check PokeData API status at their website/docs`
      );
      console.error(
        `❌ [PokeDataApiService]   2. Verify API key in environment variables`
      );
      console.error(
        `❌ [PokeDataApiService]   3. Test API endpoint manually with curl/Postman`
      );
      console.error(
        `❌ [PokeDataApiService]   4. Check if API endpoint URL has changed`
      );
      console.error(
        `❌ [PokeDataApiService]   5. Review API rate limits and credit usage`
      );

      return [];
    }
  }

  /**
   * Get the numeric ID for a set using its code
   * This is a required step for subsequent API calls
   */
  async getSetIdByCode(setCode: string): Promise<number | null> {
    const normalizedCode = setCode.toLowerCase();

    // Check if we already have the mapping cached
    if (this.setCodeToIdMap[normalizedCode]) {
      return this.setCodeToIdMap[normalizedCode];
    }

    // If not in cache, fetch all sets
    const sets = await this.getAllSets();

    // Look for the set with matching code
    const matchingSet = sets.find(
      (set) => set.code && set.code.toLowerCase() === normalizedCode
    );

    if (matchingSet) {
      // Cache the mapping
      this.setCodeToIdMap[normalizedCode] = matchingSet.id;
      return matchingSet.id;
    }

    console.log(`[PokeDataApiService] No set found with code: ${setCode}`);
    return null;
  }

  /**
   * Get all cards in a set using the set's numeric ID
   * @param setId The numeric ID of the set
   */
  async getCardsInSet(setId: number): Promise<PokeDataCard[]> {
    console.log(`[PokeDataApiService] Getting cards for set ID: ${setId}`);

    // Check cache first
    if (
      this.cardsCache[setId]?.data &&
      this.isCacheValid(this.cardsCache[setId].timestamp)
    ) {
      console.log(
        `[PokeDataApiService] Using cached cards data for set ID: ${setId}`
      );
      return this.cardsCache[setId].data || [];
    }

    try {
      const url = `${this.baseUrl}/set`;
      const params = {
        set_id: setId,
      };

      console.log(`[PokeDataApiService] Making request to: ${url}`);
      console.log(`[PokeDataApiService] With params:`, params);

      const response = await axios.get(url, {
        params,
        headers: this.getHeaders(),
      });

      if (response.data && Array.isArray(response.data)) {
        const cards = response.data as PokeDataCard[];
        console.log(
          `[PokeDataApiService] Found ${cards.length} cards for set ID ${setId}`
        );

        // Update cache
        this.cardsCache[setId] = {
          data: cards,
          timestamp: Date.now(),
        };

        return cards;
      }

      console.log(
        `[PokeDataApiService] Unexpected response format for set cards`
      );
      return [];
    } catch (error: any) {
      console.error(
        `[PokeDataApiService] Error getting cards for set ID ${setId}: ${error.message}`
      );
      if (error.response) {
        console.error(
          `[PokeDataApiService] Response status: ${error.response.status}`
        );
        console.error(
          `[PokeDataApiService] Response data:`,
          error.response.data
        );
      }
      return [];
    }
  }

  /**
   * Get all cards in a set using the set's code
   * This is a convenience method that handles the set ID lookup
   * @param setCode The set code (e.g., "sv8pt5")
   */
  async getCardsInSetByCode(setCode: string): Promise<PokeDataCard[]> {
    console.log(`[PokeDataApiService] Getting cards for set code: ${setCode}`);

    // First get the set ID
    const setId = await this.getSetIdByCode(setCode);

    if (setId === null) {
      console.log(
        `[PokeDataApiService] Couldn't find set ID for code: ${setCode}`
      );
      return [];
    }

    // Then get the cards using the ID
    return this.getCardsInSet(setId);
  }

  /**
   * Find a card's numeric ID using its set ID and card number
   * @param setId The numeric ID of the set
   * @param cardNumber The card number within the set
   */
  async getCardIdBySetAndNumber(
    setId: number,
    cardNumber: string
  ): Promise<number | null> {
    console.log(
      `[PokeDataApiService] Looking for card with number ${cardNumber} in set ID ${setId}`
    );

    // Get all cards in the set
    const cards = await this.getCardsInSet(setId);

    // Find matching card by number
    // Note: In PokeData API, 'num' is the card number (like "076")
    // While 'id' is the unique numeric ID used for API operations
    const matchingCard = cards.find(
      (card) => card.num && card.num === cardNumber
    );

    if (matchingCard) {
      console.log(
        `[PokeDataApiService] Found card ID ${matchingCard.id} for number ${cardNumber} in set ID ${setId}`
      );
      return matchingCard.id;
    }

    console.log(
      `[PokeDataApiService] No matching card found for number ${cardNumber} in set ID ${setId}`
    );
    return null;
  }

  /**
   * Find a card's numeric ID using its set code and card number
   * This is a convenience method that handles the set ID lookup internally
   * @param setCode The set code (e.g., "PRE")
   * @param cardNumber The card number within the set
   */
  async getCardIdBySetCodeAndNumber(
    setCode: string,
    cardNumber: string
  ): Promise<number | null> {
    console.log(
      `[PokeDataApiService] Looking for card with number ${cardNumber} in set code ${setCode}`
    );

    // First get the set ID
    const setId = await this.getSetIdByCode(setCode);

    if (setId === null) {
      console.log(
        `[PokeDataApiService] Couldn't find set ID for code: ${setCode}`
      );
      return null;
    }

    // Then get the card ID using the numeric set ID
    return this.getCardIdBySetAndNumber(setId, cardNumber);
  }

  /**
   * Get full card details with pricing using PokeData's numeric ID
   * This returns the complete response including card details AND pricing
   * @param pokeDataId The numeric ID of the card in PokeData's system
   */
  async getFullCardDetailsById(pokeDataId: number): Promise<any> {
    console.log(
      `[PokeDataApiService] Getting full card details for PokeData ID: ${pokeDataId}`
    );

    try {
      const url = `${this.baseUrl}/pricing`;
      const params = {
        id: pokeDataId,
        asset_type: "CARD",
      };

      console.log(`[PokeDataApiService] Making request to: ${url}`);
      console.log(`[PokeDataApiService] With params:`, params);

      const response = await axios.get(url, {
        params,
        headers: this.getHeaders(),
      });

      if (response.data && response.data.pricing) {
        console.log(
          `[PokeDataApiService] Successfully retrieved full card details for ID ${pokeDataId}`
        );
        return response.data; // Return the FULL response, not just pricing
      }

      console.log(
        `[PokeDataApiService] No card data found for ID ${pokeDataId}`
      );
      return null;
    } catch (error: any) {
      console.error(
        `[PokeDataApiService] Error getting full card details for ID ${pokeDataId}: ${error.message}`
      );
      if (error.response) {
        console.error(
          `[PokeDataApiService] Response status: ${error.response.status}`
        );
        console.error(
          `[PokeDataApiService] Response data:`,
          error.response.data
        );
      }
      return null;
    }
  }

  /**
   * Get pricing data using PokeData's numeric ID (legacy method)
   * @param pokeDataId The numeric ID of the card in PokeData's system
   */
  async getCardPricingById(pokeDataId: number): Promise<any> {
    console.log(
      `[PokeDataApiService] Getting pricing for PokeData ID: ${pokeDataId}`
    );

    try {
      const url = `${this.baseUrl}/pricing`;
      const params = {
        id: pokeDataId,
        asset_type: "CARD",
      };

      console.log(`[PokeDataApiService] Making request to: ${url}`);
      console.log(`[PokeDataApiService] With params:`, params);

      const response = await axios.get(url, {
        params,
        headers: this.getHeaders(),
      });

      if (response.data && response.data.pricing) {
        console.log(
          `[PokeDataApiService] Successfully retrieved pricing data for ID ${pokeDataId}`
        );
        return response.data.pricing;
      }

      console.log(
        `[PokeDataApiService] No pricing data found for ID ${pokeDataId}`
      );
      return null;
    } catch (error: any) {
      console.error(
        `[PokeDataApiService] Error getting pricing for ID ${pokeDataId}: ${error.message}`
      );
      if (error.response) {
        console.error(
          `[PokeDataApiService] Response status: ${error.response.status}`
        );
        console.error(
          `[PokeDataApiService] Response data:`,
          error.response.data
        );
      }
      return null;
    }
  }

  /**
   * Get card pricing using the Pokemon TCG API card ID (e.g., "sv8pt5-161")
   * This method will:
   * 1. Try to use provided pokeDataId if available
   * 2. If not, try to find the PokeData ID using the set code and card number
   * 3. Fall back to legacy method if needed (just using card number)
   */
  async getCardPricing(
    cardId: string,
    pokeDataId?: number
  ): Promise<EnhancedPriceData | null> {
    console.log(
      `[PokeDataApiService] Getting enhanced pricing for card: ${cardId}`
    );

    // If pokeDataId is provided, use it directly
    if (pokeDataId) {
      console.log(
        `[PokeDataApiService] Using provided PokeData ID: ${pokeDataId}`
      );
      const pricing = await this.getCardPricingById(pokeDataId);
      if (pricing) {
        return this.mapApiPricingToEnhancedPriceData({ pricing });
      }
      return null;
    }

    // Extract identifiers from card ID
    const identifiers = this.extractCardIdentifiers(cardId);

    // If we have a valid set code, try to find the card ID the proper way
    if (identifiers.setCode) {
      console.log(
        `[PokeDataApiService] Attempting to find PokeData ID for set ${identifiers.setCode} card ${identifiers.number}`
      );

      try {
        // Step 1: Get the set ID
        const setId = await this.getSetIdByCode(identifiers.setCode);

        if (setId) {
          // Step 2: Get the card ID using set ID and card number
          const cardPokeDataId = await this.getCardIdBySetAndNumber(
            setId,
            identifiers.number
          );

          if (cardPokeDataId) {
            // Step 3: Get pricing using the found ID
            console.log(
              `[PokeDataApiService] Found PokeData ID ${cardPokeDataId} for card ${cardId}`
            );
            const pricing = await this.getCardPricingById(cardPokeDataId);

            if (pricing) {
              return this.mapApiPricingToEnhancedPriceData({ pricing });
            }
          }
        }
      } catch (error: any) {
        console.error(
          `[PokeDataApiService] Error in ID-based lookup for ${cardId}: ${error.message}`
        );
      }
    }

    // Fall back to the legacy method if the proper approach failed
    console.log(
      `[PokeDataApiService] Falling back to legacy method using card number: ${identifiers.number}`
    );

    try {
      const url = `${this.baseUrl}/pricing`;
      const params = {
        id: identifiers.number,
        asset_type: "CARD",
      };

      console.log(`[PokeDataApiService] Making request to: ${url}`);
      console.log(`[PokeDataApiService] With params:`, params);

      const response = await axios.get(url, {
        params,
        headers: this.getHeaders(),
      });

      console.log(
        `[PokeDataApiService] API response status: ${response.status}`
      );

      if (response.data && response.data.name) {
        console.log(
          `[PokeDataApiService] Retrieved data for card: ${response.data.name}`
        );

        // Add warning if the card appears to be from a different set than expected
        if (
          identifiers.setCode &&
          !response.data.name
            .toLowerCase()
            .includes(identifiers.setCode.toLowerCase())
        ) {
          console.warn(
            `[PokeDataApiService] Warning: Card from different set than requested. Expected set code ${identifiers.setCode}, got data for ${response.data.name}`
          );
        }
      }

      return this.mapApiPricingToEnhancedPriceData(response.data);
    } catch (error: any) {
      console.error(
        `[PokeDataApiService] Error in fallback pricing lookup for card ${cardId}: ${error.message}`
      );

      if (error.response) {
        console.error(
          `[PokeDataApiService] Response status: ${error.response.status}`
        );
        console.error(
          `[PokeDataApiService] Response data:`,
          error.response.data
        );
      }

      return null;
    }
  }

  // Helper methods for mapping API responses to our models
  public mapApiPricingToEnhancedPriceData(
    apiPricing: any
  ): EnhancedPriceData | null {
    if (!apiPricing) return null;

    console.log(
      `[PokeDataApiService] Mapping API pricing data:`,
      JSON.stringify(apiPricing).substring(0, 200) + "..."
    );

    const enhancedPricing: EnhancedPriceData = {};

    // Initialize with empty objects for PSA and CGC grades
    const psaGrades: Record<string, { value: number }> = {};
    const cgcGradesObj: Record<string, { value: number }> = {};

    // Process PSA grades
    for (let i = 1; i <= 10; i++) {
      const grade = i === 10 ? "10.0" : `${i}.0`;
      const key = `PSA ${grade}`;

      if (
        apiPricing.pricing &&
        apiPricing.pricing[key] &&
        apiPricing.pricing[key].value > 0
      ) {
        const gradeKey = String(i); // Store as "1", "2", etc.
        psaGrades[gradeKey] = {
          value: apiPricing.pricing[key].value,
        };
      }
    }

    // Process CGC grades (including half grades)
    const cgcGradeValues = [
      "1.0",
      "2.0",
      "3.0",
      "4.0",
      "5.0",
      "6.0",
      "7.0",
      "7.5",
      "8.0",
      "8.5",
      "9.0",
      "9.5",
      "10.0",
    ];

    cgcGradeValues.forEach((grade) => {
      const key = `CGC ${grade}`;

      if (
        apiPricing.pricing &&
        apiPricing.pricing[key] &&
        apiPricing.pricing[key].value > 0
      ) {
        // Convert "8.5" to "8_5" for storage
        const gradeKey = grade.replace(".", "_");
        cgcGradesObj[gradeKey] = {
          value: apiPricing.pricing[key].value,
        };
      }
    });

    // Process eBay Raw pricing
    if (
      apiPricing.pricing &&
      apiPricing.pricing["eBay Raw"] &&
      apiPricing.pricing["eBay Raw"].value > 0
    ) {
      enhancedPricing.ebayRaw = {
        value: apiPricing.pricing["eBay Raw"].value,
      };
    }

    // Only add grade objects if they have data
    if (Object.keys(psaGrades).length > 0) {
      enhancedPricing.psaGrades = psaGrades;
    }

    if (Object.keys(cgcGradesObj).length > 0) {
      enhancedPricing.cgcGrades = cgcGradesObj;
    }

    return Object.keys(enhancedPricing).length > 0 ? enhancedPricing : null;
  }

  /**
   * Check remaining PokeData API credits
   * This endpoint is FREE - no credits consumed
   */
  async checkCreditsRemaining(): Promise<{
    creditsRemaining: number;
    status: string;
  } | null> {
    console.log(`[PokeDataApiService] Checking remaining API credits`);

    try {
      const url = `${this.baseUrl}/account`;

      console.log(
        `[PokeDataApiService] Making credit check request to: ${url}`
      );

      const response = await axios.get(url, { headers: this.getHeaders() });

      if (response.data && typeof response.data.credits === "number") {
        const creditsRemaining = response.data.credits;
        const creditLimit = response.data.credits_limit || undefined;

        console.log(
          `[PokeDataApiService] Current credits: ${creditsRemaining}${
            creditLimit ? ` / ${creditLimit}` : ""
          }`
        );

        // Determine status based on remaining credits
        let status = "healthy";
        if (creditsRemaining <= 0) {
          status = "exhausted";
        } else if (creditLimit) {
          const percentage = creditsRemaining / creditLimit;
          if (percentage <= 0.05) status = "critical";
          else if (percentage <= 0.1) status = "critical";
          else if (percentage <= 0.2) status = "warning";
        } else {
          // Without knowing limit, use absolute thresholds
          if (creditsRemaining <= 100) status = "critical";
          else if (creditsRemaining <= 500) status = "warning";
        }

        return {
          creditsRemaining,
          status,
        };
      }

      console.log(
        `[PokeDataApiService] Unexpected response format for account endpoint:`,
        response.data
      );
      return null;
    } catch (error: any) {
      console.error(
        `[PokeDataApiService] Error checking credits: ${error.message}`
      );

      if (error.response) {
        console.error(
          `[PokeDataApiService] Response status: ${error.response.status}`
        );
        console.error(
          `[PokeDataApiService] Response data:`,
          error.response.data
        );
      }

      return null;
    }
  }

  /**
   * Enhanced API call wrapper with credit monitoring
   * Automatically checks credits on specific error conditions
   */
  private async makeApiCallWithCreditCheck(
    operation: string,
    apiCall: () => Promise<any>,
    correlationId: string = `api-${Date.now()}`
  ): Promise<any> {
    try {
      return await apiCall();
    } catch (error: any) {
      // Check if this might be a credit-related error
      const shouldCheckCredits = this.shouldCheckCreditsForError(error);

      if (shouldCheckCredits) {
        console.warn(
          `${correlationId} API error detected, checking credits: ${error.message}`
        );

        // Check remaining credits
        const creditStatus = await this.checkCreditsRemaining();

        if (creditStatus) {
          // Process credit status with monitoring service
          await this.creditMonitoringService.processCreditStatus(
            creditStatus.creditsRemaining,
            operation,
            "PokeDataApiService",
            correlationId
          );

          // Enhanced error message with credit information
          if (creditStatus.status === "exhausted") {
            const enhancedError = new Error(
              `API call failed due to exhausted PokeData credits (${creditStatus.creditsRemaining} remaining). Original error: ${error.message}`
            );
            (enhancedError as any).originalError = error;
            (enhancedError as any).creditStatus = creditStatus;
            throw enhancedError;
          } else if (
            creditStatus.status === "critical" ||
            creditStatus.status === "warning"
          ) {
            console.warn(
              `${correlationId} 🟡 LOW CREDITS WARNING: ${creditStatus.creditsRemaining} PokeData credits remaining (${creditStatus.status})`
            );
          }
        }
      }

      // Re-throw original error
      throw error;
    }
  }

  /**
   * Determine if we should check credits based on the error
   */
  private shouldCheckCreditsForError(error: any): boolean {
    if (!error.response) return false;

    const status = error.response.status;

    // Check credits on these status codes that might indicate quota issues
    return [401, 403, 404, 429].includes(status);
  }
}
