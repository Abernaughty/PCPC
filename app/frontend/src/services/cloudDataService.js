import { API_CONFIG } from '../data/cloudApiConfig';
import { apiLogger } from './loggerService';

/**
 * Service for Pokémon data operations using cloud-based Azure Functions
 */
export const cloudDataService = {
  /**
   * Get the list of all Pokémon card sets
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @param {boolean} groupByExpansion - Whether to group sets by expansion series
   * @returns {Promise<Array|Object>} Array of set objects or grouped sets object
   */
  async getSetList(forceRefresh = false, groupByExpansion = true) {
    try {
      apiLogger.info('Getting set list from cloud API', { forceRefresh, groupByExpansion });
      
      const url = new URL(API_CONFIG.buildSetsUrl());
      
      // Add query parameters
      if (forceRefresh) {
        url.searchParams.append('forceRefresh', 'true');
      }
      
      if (groupByExpansion) {
        url.searchParams.append('groupByExpansion', 'true');
      }
      
      // Request all sets (English + Japanese) instead of just English
      url.searchParams.append('language', 'ALL');
      
      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to get error details');
        apiLogger.error('Cloud API error for sets', { status: response.status, error: errorText });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }
      
      const apiResponse = await response.json();
      apiLogger.debug('API response for sets', { status: response.status, cached: apiResponse.cached });
      
      // Handle PokeData-first response structure
      let setsArray = [];
      
      if (apiResponse && apiResponse.data) {
        // PokeData-first response structure: { data: { sets: [...] } }
        if (apiResponse.data.sets && Array.isArray(apiResponse.data.sets)) {
          setsArray = apiResponse.data.sets;
        } else if (Array.isArray(apiResponse.data)) {
          // Direct array in data wrapper
          setsArray = apiResponse.data;
        }
      } else if (apiResponse && Array.isArray(apiResponse)) {
        // Direct array response (fallback)
        setsArray = apiResponse;
      } else {
        apiLogger.warn('Unexpected API response format', { responseType: typeof apiResponse, hasData: !!apiResponse });
        // Return empty array as fallback
        return [];
      }
      
      // Transform PokeData sets to frontend format
      setsArray = setsArray.map(set => ({
        id: set.setId || set.id,
        name: set.setName || set.name,
        code: set.setCode || set.code,
        // Keep original PokeData properties for backend compatibility
        setId: set.setId,
        setName: set.setName,
        setCode: set.setCode,
        language: set.language,
        releaseYear: set.releaseYear,
        isRecent: set.isRecent
      }));
      
      // Check if the response contains grouped sets (objects with type: 'group')
      if (groupByExpansion && setsArray.length > 0 && setsArray[0].type === 'group') {
        apiLogger.debug('Transforming grouped sets format from backend to frontend');
        
        // Transform from backend format to frontend format
        // Backend: [{type: 'group', name: 'X', items: [...]}, ...]
        // Frontend: {'X': [...], 'Y': [...], ...}
        const transformedGroups = {};
        
        setsArray.forEach(group => {
          if (group.type === 'group' && group.name && Array.isArray(group.items)) {
            transformedGroups[group.name] = group.items;
            apiLogger.debug('Transformed group', { groupName: group.name, setCount: group.items.length });
          } else {
            apiLogger.warn('Skipping invalid group in API response', { group });
          }
        });
        
        apiLogger.success('Transformation complete, returning grouped sets object', { groupCount: Object.keys(transformedGroups).length });
        return transformedGroups;
      }
      
      // Return the data as-is if not grouped
      apiLogger.success('Returning set list as array', { setCount: setsArray.length });
      return setsArray;
    } catch (error) {
      apiLogger.error('Error fetching sets from cloud API', { error });
      throw error;
    }
  },
  
  /**
   * Get cards for a specific set
   * @param {string} setId - The set ID (PokeData-first backend expects numeric setId)
   * @param {Object} options - Additional options
   * @param {boolean} options.forceRefresh - Whether to force a refresh from the API
   * @param {number} options.page - Page number for pagination (used only when fetchAllPages is false)
   * @param {number} options.pageSize - Number of items per page
   * @param {boolean} options.fetchAllPages - Whether to fetch all pages (default: true)
   * @returns {Promise<Object>} Paginated array of card objects or all cards if fetchAllPages=true
   */
  async getCardsForSet(setId, options = {}) {
    try {
      if (!setId) {
        apiLogger.error('Set ID is required to fetch cards');
        return { items: [], totalCount: 0, pageNumber: 1, pageSize: 100, totalPages: 0 };
      }
      
      apiLogger.info('Fetching cards for set from cloud API', { setId, options });
      
      // Default options
      const fetchAllPages = options.fetchAllPages !== false; // Default to true unless explicitly set to false
      const pageSize = options.pageSize || 500; // Increased page size to reduce requests
      
      // If we're fetching all pages, start with page 1
      const initialPage = options.page || 1;
      
      // If we're not fetching all pages, just get the requested page
      if (!fetchAllPages) {
        return this.fetchCardsPage(setId, initialPage, pageSize, options.forceRefresh);
      }
      
      // If we are fetching all pages, start with page 1
      let allCards = [];
      let currentPage = initialPage;
      let totalPages = 1; // Will be updated after first request
      let totalCount = 0;
      
      apiLogger.debug('Fetching all pages for set', { setId, pageSize });
      
      // Fetch first page to get total pages
      const firstPageResult = await this.fetchCardsPage(setId, currentPage, pageSize, options.forceRefresh);
      
      // Extract pagination info
      totalPages = firstPageResult.totalPages || 1;
      totalCount = firstPageResult.totalCount || 0;
      
      // Add cards from first page
      allCards = [...allCards, ...firstPageResult.items];
      
      apiLogger.debug('Retrieved first page', { 
        setId, 
        currentPage, 
        totalPages, 
        cardsInPage: firstPageResult.items.length, 
        totalCount 
      });
      
      // Fetch remaining pages if any
      while (currentPage < totalPages) {
        currentPage++;
        apiLogger.debug('Fetching additional page', { setId, currentPage, totalPages });
        
        const pageResult = await this.fetchCardsPage(setId, currentPage, pageSize, options.forceRefresh);
        
        // Add cards from this page
        allCards = [...allCards, ...pageResult.items];
        
        apiLogger.debug('Retrieved additional page', { 
          setId, 
          currentPage, 
          totalPages, 
          cardsInPage: pageResult.items.length, 
          runningTotal: allCards.length, 
          totalCount 
        });
      }
      
      // Return all cards with pagination metadata
      const result = {
        items: allCards,
        totalCount: totalCount,
        pageNumber: 1,
        pageSize: allCards.length,
        totalPages: 1
      };
      
      apiLogger.success('Successfully retrieved all cards for set', { setId, totalCards: allCards.length });
      return result;
    } catch (error) {
      apiLogger.error('Error fetching cards for set from cloud API', { setId, error });
      throw error;
    }
  },
  
  /**
   * Fetch a single page of cards for a set
   * @private
   * @param {string} setId - The set ID
   * @param {number} page - Page number
   * @param {number} pageSize - Items per page
   * @param {boolean} forceRefresh - Whether to force refresh from API
   * @returns {Promise<Object>} Paginated card data
   */
  async fetchCardsPage(setId, page, pageSize, forceRefresh = false) {
    try {
      const url = new URL(API_CONFIG.buildCardsForSetUrl(setId));
      
      // Add query parameters
      if (forceRefresh) {
        url.searchParams.append('forceRefresh', 'true');
      }
      
      url.searchParams.append('page', page.toString());
      
      // Always ensure we explicitly set pageSize parameter
      url.searchParams.append('pageSize', pageSize.toString());
      
      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to get error details');
        apiLogger.error('API error for set page', { setId, page, status: response.status, error: errorText });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }
      
      const apiResponse = await response.json();
      
      // Extract the cards data from the response
      let cardsData = { items: [], totalCount: 0, pageNumber: page, pageSize: pageSize, totalPages: 1 };
      
      if (apiResponse && typeof apiResponse === 'object') {
        if (apiResponse.data && typeof apiResponse.data === 'object') {
          // Data wrapper with pagination info
          cardsData = apiResponse.data;
        } else if (Array.isArray(apiResponse)) {
          // Direct array of cards
          cardsData = { 
            items: apiResponse,
            totalCount: apiResponse.length,
            pageNumber: page,
            pageSize: pageSize,
            totalPages: 1
          };
        } else if (apiResponse.cards && Array.isArray(apiResponse.cards)) {
          // Cards wrapper with array
          cardsData = {
            items: apiResponse.cards,
            totalCount: apiResponse.cards.length,
            pageNumber: page,
            pageSize: pageSize,
            totalPages: 1
          };
        }
      }
      
      // Transform card data to match expected format
      if (cardsData.items && Array.isArray(cardsData.items)) {
        cardsData.items = cardsData.items.map(card => {
          // Create a transformed card, mapping properties from API format to frontend format
          const transformedCard = {
            ...card, // Keep all original properties
            // Map cardName to name if it doesn't already exist
            name: card.name || card.cardName || `${card.setName} ${card.cardNumber || card.id}`,
            // Map cardNumber to num if it doesn't already exist
            num: card.num || card.cardNumber || '',
            // Ensure the image URL is available
            image_url: card.image_url || card.imageUrl || (card.images ? (card.images.small || card.images.large) : '')
          };
          
          return transformedCard;
        });
      }
      
      return cardsData;
    } catch (error) {
      apiLogger.error('Error fetching cards for set page', { setId, page, error });
      throw error;
    }
  },
  
  /**
   * Get pricing data for a specific card
   * @param {string} cardId - The card ID
   * @param {string} setId - The set ID
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Object>} Card data with pricing information
   */
  async getCardPricing(cardId, setId, forceRefresh = false) {
    try {
      if (!cardId) {
        throw new Error('Card ID is required to fetch pricing data');
      }
      
      if (!setId) {
        throw new Error('Set ID is required to fetch pricing data');
      }

      apiLogger.info('Getting pricing data for card from cloud API', { cardId, setId, forceRefresh });
      
      const url = new URL(API_CONFIG.buildCardInfoUrl(cardId, setId));
      
      // Add query parameters
      if (forceRefresh) {
        url.searchParams.append('forceRefresh', 'true');
      }
      
      apiLogger.debug('Making pricing request', { url: url.toString() });
      
      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to get error details');
        apiLogger.error('API error for card pricing', { cardId, status: response.status, error: errorText });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }
      
      const apiResponse = await response.json();
      apiLogger.debug('Pricing API response received', { cardId, cached: apiResponse.cached });
      
      // Extract the card data from the response
      let cardData = null;
      
      if (apiResponse && typeof apiResponse === 'object') {
        if (apiResponse.data) {
          // Data wrapper
          cardData = apiResponse.data;
        } else if (apiResponse.card) {
          // Card wrapper
          cardData = apiResponse.card;
        } else if (!apiResponse.data && !apiResponse.card && Object.keys(apiResponse).length > 0) {
          // Direct card object
          cardData = apiResponse;
        }
      }
      
      if (!cardData) {
        apiLogger.warn('No valid card data found in API response', { cardId });
        return null;
      }
      
      // Transform the card data to include pricing in the expected format
      const transformedCard = {
        ...cardData,
        pricing: {} // Create the pricing object expected by the frontend
      };
      
      // Handle PokeData-first pricing structure
      if (cardData.pricing) {
        apiLogger.debug('Transforming PokeData-first pricing structure', { cardId, pricingKeys: Object.keys(cardData.pricing) });
        
        // Transform PSA grades: psa: {9: 1059} → "psa-9": {value: 1059, currency: "USD"}
        if (cardData.pricing.psa) {
          Object.entries(cardData.pricing.psa).forEach(([grade, value]) => {
            transformedCard.pricing[`psa-${grade}`] = { value: value, currency: 'USD' };
          });
        }
        
        // Transform CGC grades: cgc: {8_0: 1200} → "cgc-8.0": {value: 1200, currency: "USD"}
        if (cardData.pricing.cgc) {
          Object.entries(cardData.pricing.cgc).forEach(([grade, value]) => {
            // Handle both underscore format (8_0) and direct format (8.0)
            const cleanGrade = grade.includes('_') ? grade.replace('_', '.') : grade;
            transformedCard.pricing[`cgc-${cleanGrade}`] = { value: value, currency: 'USD' };
          });
        }
        
        // Transform TCGPlayer price: tcgPlayer: 1204.97 → market: {value: 1204.97, currency: "USD"}
        if (cardData.pricing.tcgPlayer) {
          transformedCard.pricing.market = { value: cardData.pricing.tcgPlayer, currency: 'USD' };
        }
        
        // Transform eBay raw price: ebayRaw: 1124.93 → ebayRaw: {value: 1124.93, currency: "USD"}
        if (cardData.pricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = { value: cardData.pricing.ebayRaw, currency: 'USD' };
        }
        
        // Transform PokeData raw price if available
        if (cardData.pricing.pokeDataRaw) {
          transformedCard.pricing.pokeDataRaw = { value: cardData.pricing.pokeDataRaw, currency: 'USD' };
        }
      }
      
      // Fallback: Handle legacy enhancedPricing structure (if still present)
      else if (cardData.enhancedPricing) {
        apiLogger.debug('Using legacy enhancedPricing structure', { cardId, enhancedPricingKeys: Object.keys(cardData.enhancedPricing) });
        
        // Add PSA graded prices if they exist
        if (cardData.enhancedPricing.psaGrades) {
          Object.entries(cardData.enhancedPricing.psaGrades).forEach(([grade, priceInfo]) => {
            transformedCard.pricing[`psa-${grade}`] = priceInfo;
          });
        }
        // Add CGC graded prices if they exist
        if (cardData.enhancedPricing.cgcGrades) {
          Object.entries(cardData.enhancedPricing.cgcGrades).forEach(([grade, priceInfo]) => {
            transformedCard.pricing[`cgc-${grade}`] = priceInfo;
          });
        }
        // Add eBay raw price if it exists
        if (cardData.enhancedPricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = cardData.enhancedPricing.ebayRaw;
        }
      }
      
      // Final fallback: Use TCG Player pricing if no other pricing data is available
      else if (cardData.tcgPlayerPrice) {
        apiLogger.debug('Using TCGPlayer pricing as fallback', { cardId, tcgPlayerKeys: Object.keys(cardData.tcgPlayerPrice) });
        
        // Map TCG Player pricing values to the expected format
        if (cardData.tcgPlayerPrice.market) {
          transformedCard.pricing.market = { value: cardData.tcgPlayerPrice.market, currency: 'USD' };
        }
        if (cardData.tcgPlayerPrice.low) {
          transformedCard.pricing.low = { value: cardData.tcgPlayerPrice.low, currency: 'USD' };
        }
        if (cardData.tcgPlayerPrice.mid) {
          transformedCard.pricing.mid = { value: cardData.tcgPlayerPrice.mid, currency: 'USD' };
        }
        if (cardData.tcgPlayerPrice.high) {
          transformedCard.pricing.high = { value: cardData.tcgPlayerPrice.high, currency: 'USD' };
        }
      }
      
      // Transform image structure: images: {small: "...", large: "..."} → image_url: "..."
      // Prioritize large image for better quality
      if (cardData.images) {
        transformedCard.image_url = cardData.images.large || cardData.images.small;
        apiLogger.debug('Transformed image URL', { cardId, imageUrl: transformedCard.image_url });
      }
      
      // Ensure card name is available
      if (!transformedCard.name && cardData.cardName) {
        transformedCard.name = cardData.cardName;
      }
      
      // Ensure card number is available
      if (!transformedCard.num && cardData.cardNumber) {
        transformedCard.num = cardData.cardNumber;
      }
      
      // Ensure set name is available
      if (!transformedCard.set_name && cardData.setName) {
        transformedCard.set_name = cardData.setName;
      }
      
      apiLogger.success('Successfully processed pricing data for card', { cardId, pricingKeys: Object.keys(transformedCard.pricing) });
      return transformedCard;
    } catch (error) {
      apiLogger.error('Error fetching pricing for card from cloud API', { cardId, error });
      throw error;
    }
  },
  
  /**
   * Get pricing data for a specific card with metadata
   * @param {string} cardId - The card ID
   * @param {string} setId - The set ID
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Object>} Card pricing data with metadata
   */
  async getCardPricingWithMetadata(cardId, setId, forceRefresh = false) {
    try {
      if (!cardId) {
        throw new Error('Card ID is required to fetch pricing data');
      }
      
      if (!setId) {
        throw new Error('Set ID is required to fetch pricing data');
      }

      apiLogger.info('Getting pricing data with metadata for card from cloud API', { cardId, setId, forceRefresh });
      
      const url = new URL(API_CONFIG.buildCardInfoUrl(cardId, setId));
      
      // Add query parameters
      if (forceRefresh) {
        url.searchParams.append('forceRefresh', 'true');
      }
      
      const response = await fetch(url.toString(), {
        headers: API_CONFIG.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to get error details');
        apiLogger.error('API error for card pricing with metadata', { cardId, status: response.status, error: errorText });
        throw new Error(`API error: ${response.status}. Details: ${errorText}`);
      }
      
      const apiResponse = await response.json();
      apiLogger.debug('Pricing API response for card with metadata', { cardId, cached: apiResponse.cached });
      
      // Extract the card data from the response
      let cardData = null;
      
      if (apiResponse && typeof apiResponse === 'object') {
        if (apiResponse.data) {
          // Data wrapper
          cardData = apiResponse.data;
        } else if (apiResponse.card) {
          // Card wrapper
          cardData = apiResponse.card;
        } else if (!apiResponse.data && !apiResponse.card && Object.keys(apiResponse).length > 0) {
          // Direct card object
          cardData = apiResponse;
        }
      }
      
      if (!cardData) {
        apiLogger.warn('No valid card data found in API response for card with metadata', { cardId });
        return {
          data: null,
          timestamp: Date.now(),
          fromCache: false,
          cacheAge: 0
        };
      }
      
      // Get metadata from response or use defaults
      const timestamp = apiResponse.timestamp ? new Date(apiResponse.timestamp).getTime() : Date.now();
      const fromCache = apiResponse.cached || false;
      const cacheAge = apiResponse.cacheAge || 0;
      
      // Add stale indicator logic for consistency with local API
      const now = Date.now();
      const dataAge = now - timestamp;
      const isStale = dataAge > 24 * 60 * 60 * 1000; // 24 hours
      
      // Transform the card data to include pricing in the expected format
      const transformedCard = {
        ...cardData,
        pricing: {} // Create the pricing object expected by the frontend
      };
      
      // Handle PokeData-first pricing structure
      if (cardData.pricing) {
        apiLogger.debug('Transforming PokeData-first pricing structure with metadata', { cardId, pricingKeys: Object.keys(cardData.pricing) });
        
        // Transform PSA grades: psa: {9: 1059} → "psa-9": {value: 1059, currency: "USD"}
        if (cardData.pricing.psa) {
          Object.entries(cardData.pricing.psa).forEach(([grade, value]) => {
            transformedCard.pricing[`psa-${grade}`] = { value: value, currency: 'USD' };
          });
        }
        
        // Transform CGC grades: cgc: {8_0: 1200} → "cgc-8.0": {value: 1200, currency: "USD"}
        if (cardData.pricing.cgc) {
          Object.entries(cardData.pricing.cgc).forEach(([grade, value]) => {
            const cleanGrade = grade.replace('_', '.');
            transformedCard.pricing[`cgc-${cleanGrade}`] = { value: value, currency: 'USD' };
          });
        }
        
        // Transform TCGPlayer price: tcgPlayer: 1204.97 → market: {value: 1204.97, currency: "USD"}
        if (cardData.pricing.tcgPlayer) {
          transformedCard.pricing.market = { value: cardData.pricing.tcgPlayer, currency: 'USD' };
        }
        
        // Transform eBay raw price: ebayRaw: 1124.93 → ebayRaw: {value: 1124.93, currency: "USD"}
        if (cardData.pricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = { value: cardData.pricing.ebayRaw, currency: 'USD' };
        }
        
        // Transform PokeData raw price if available
        if (cardData.pricing.pokeDataRaw) {
          transformedCard.pricing.pokeDataRaw = { value: cardData.pricing.pokeDataRaw, currency: 'USD' };
        }
      }
      
      // Fallback: Handle legacy enhancedPricing structure (if still present)
      else if (cardData.enhancedPricing) {
        apiLogger.debug('Using legacy enhancedPricing structure with metadata', { cardId, enhancedPricingKeys: Object.keys(cardData.enhancedPricing) });
        
        // Add PSA graded prices if they exist
        if (cardData.enhancedPricing.psaGrades) {
          Object.entries(cardData.enhancedPricing.psaGrades).forEach(([grade, priceInfo]) => {
            transformedCard.pricing[`psa-${grade}`] = priceInfo;
          });
        }
        // Add CGC graded prices if they exist
        if (cardData.enhancedPricing.cgcGrades) {
          Object.entries(cardData.enhancedPricing.cgcGrades).forEach(([grade, priceInfo]) => {
            transformedCard.pricing[`cgc-${grade}`] = priceInfo;
          });
        }
        // Add eBay raw price if it exists
        if (cardData.enhancedPricing.ebayRaw) {
          transformedCard.pricing.ebayRaw = cardData.enhancedPricing.ebayRaw;
        }
      }
      
      // Final fallback: Use TCG Player pricing if no other pricing data is available
      else if (cardData.tcgPlayerPrice) {
        apiLogger.debug('Using TCGPlayer pricing as fallback with metadata', { cardId, tcgPlayerKeys: Object.keys(cardData.tcgPlayerPrice) });
        
        // Map TCG Player pricing values to the expected format
        if (cardData.tcgPlayerPrice.market) {
          transformedCard.pricing.market = { value: cardData.tcgPlayerPrice.market, currency: 'USD' };
        }
        if (cardData.tcgPlayerPrice.low) {
          transformedCard.pricing.low = { value: cardData.tcgPlayerPrice.low, currency: 'USD' };
        }
        if (cardData.tcgPlayerPrice.mid) {
          transformedCard.pricing.mid = { value: cardData.tcgPlayerPrice.mid, currency: 'USD' };
        }
        if (cardData.tcgPlayerPrice.high) {
          transformedCard.pricing.high = { value: cardData.tcgPlayerPrice.high, currency: 'USD' };
        }
      }
      
      // Transform image structure: images: {small: "...", large: "..."} → image_url: "..."
      // Prioritize large image for better quality
      if (cardData.images) {
        transformedCard.image_url = cardData.images.large || cardData.images.small;
        apiLogger.debug('Transformed image URL with metadata', { cardId, imageUrl: transformedCard.image_url });
      }
      
      // Ensure card name is available
      if (!transformedCard.name && cardData.cardName) {
        transformedCard.name = cardData.cardName;
      }
      
      // Ensure card number is available
      if (!transformedCard.num && cardData.cardNumber) {
        transformedCard.num = cardData.cardNumber;
      }
      
      // Ensure set name is available
      if (!transformedCard.set_name && cardData.setName) {
        transformedCard.set_name = cardData.setName;
      }
      
      apiLogger.success('Successfully processed pricing data for card with metadata', { 
        cardId, 
        pricingKeys: Object.keys(transformedCard.pricing),
        fromCache,
        isStale
      });
      
      return {
        data: transformedCard,
        timestamp: timestamp,
        fromCache: fromCache,
        cacheAge: cacheAge,
        isStale: isStale
      };
    } catch (error) {
      apiLogger.error('Error fetching pricing for card from cloud API with metadata', { cardId, error });
      throw error;
    }
  }
};
