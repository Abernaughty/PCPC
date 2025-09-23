import { writable } from 'svelte/store';
import { hybridDataService } from '../services/hybridDataService';
import { error, isOnline } from './uiStore';
import { selectedSet } from './setStore';
import { uiLogger } from '../services/loggerService';

// Create stores for state
export const priceData = writable(null);
export const isLoading = writable(false);
export const pricingTimestamp = writable(null);
export const pricingFromCache = writable(false);
export const pricingIsStale = writable(false);

// Helper function to filter out zero or null price values
function filterValidPrices(pricing) {
    // Safety check for null/undefined input
    if (!pricing || typeof pricing !== 'object') return {};
    
    // Create a new object with only valid price entries
    const filteredPricing = {};
    
    try {
        Object.entries(pricing).forEach(([market, priceInfo]) => {
            // Skip null values entirely
            if (priceInfo === null || priceInfo === undefined) return;
            
            // Handle different pricing formats
            if (typeof priceInfo === 'object' && 
                priceInfo.value !== undefined && 
                priceInfo.value !== null && 
                parseFloat(priceInfo.value) > 0) {
                // Object format with value property
                filteredPricing[market] = priceInfo;
            } else if (typeof priceInfo === 'number' && priceInfo > 0) {
                // Direct number format
                filteredPricing[market] = { value: priceInfo, currency: 'USD' };
            } else if (typeof priceInfo === 'string' && parseFloat(priceInfo) > 0) {
                // String that can be parsed as a number
                filteredPricing[market] = { value: parseFloat(priceInfo), currency: 'USD' };
            }
        });
    } catch (err) {
        uiLogger.error('Error filtering prices', { error: err });
        return {}; // Return empty object on error
    }
    
    return filteredPricing;
}

// Format price to always show 2 decimal places with comma separators
export function formatPrice(value) {
    if (value === undefined || value === null) return "0.00";
    
    // Convert to number and format with 2 decimal places
    const num = parseFloat(value);
    
    // Add comma separators for thousands
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Actions
/**
 * Fetch price data for a card
 * @param {string} cardId - The card ID
 * @param {boolean} forceRefresh - Whether to force a refresh from the API
 * @returns {Promise<void>}
 */
export async function fetchCardPrice(cardId, forceRefresh = false) {
    let online;
    isOnline.subscribe(value => { online = value; })();
    
    if (!online) {
        error.set("You are offline. Please connect to the internet to get pricing data.");
        return;
    }
    
    if (!cardId) {
        error.set("Invalid card selection - missing ID");
        return;
    }
    
    // Get the current selected set to extract setId
    let currentSet;
    selectedSet.subscribe(value => { currentSet = value; })();
    
    if (!currentSet || !currentSet.id) {
        error.set("Set information is required for pricing data");
        return;
    }
    
    // Reset pricing related state
    isLoading.set(true);
    error.set(null);
    pricingTimestamp.set(null);
    pricingFromCache.set(false);
    pricingIsStale.set(false);
    priceData.set(null);
    
    try {
        uiLogger.info('Fetching price data for card', { cardId, setId: currentSet.id, forceRefresh });
        
        // Load pricing data with metadata using the card ID and setId
        const result = await hybridDataService.getCardPricingWithMetadata(cardId, currentSet.id, forceRefresh);
        const rawPriceData = result.data;
        
        pricingTimestamp.set(result.timestamp);
        pricingFromCache.set(result.fromCache || false);
        pricingIsStale.set(result.isStale || false);
        
        uiLogger.debug('Received price data', { 
            cardId, 
            hasPricing: !!(rawPriceData && rawPriceData.pricing),
            timestamp: result.timestamp ? new Date(result.timestamp).toLocaleString() : 'none',
            fromCache: result.fromCache || false,
            isStale: result.isStale || false
        });
        
        // Filter out zero or null price values
        if (rawPriceData && rawPriceData.pricing) {
            rawPriceData.pricing = filterValidPrices(rawPriceData.pricing);
            uiLogger.debug('Filtered pricing data', { cardId, pricingKeys: Object.keys(rawPriceData.pricing) });
        } else {
            uiLogger.warn('No pricing data found in response', { cardId, rawPriceData });
        }
        
        priceData.set(rawPriceData);
    } catch (err) {
        uiLogger.error('API Error fetching card price', { cardId, error: err });
        error.set(err.message);
    } finally {
        isLoading.set(false);
    }
}

// Load pricing data for a specific variant
export async function loadPricingForVariant(variant) {
    if (!variant || !variant.id) {
        error.set('Invalid card variant');
        return;
    }
    
    // Just use the regular fetch function with the variant ID
    await fetchCardPrice(variant.id);
}
