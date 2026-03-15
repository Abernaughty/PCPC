/**
 * Pricing Store - Card pricing data management using Svelte 5 runes
 */

import { browser } from '$app/environment';
import type { PricingResult, PriceData } from '$lib/types';
import { api } from '$lib/services/api';
import { db } from '$lib/services/db';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('pricingStore');

interface PricingStore {
  priceData: Record<string, PricingResult>;
  isLoading: boolean;
  pricingTimestamp: number | null;
  pricingFromCache: boolean;
  pricingIsStale: boolean;
  fetchCardPrice(
    setId: string | number,
    cardId: string | number
  ): Promise<PricingResult | null>;
  loadPricingForVariant(
    setId: string | number,
    variantId: string | number
  ): Promise<PricingResult | null>;
  filterValidPrices(pricing: PricingResult): PriceData | null;
  formatPrice(price: number | undefined): string;
}

/**
 * Create the pricing store with Svelte 5 runes
 */
function createPricingStore(): PricingStore {
  let priceData: Record<string, PricingResult> = $state({});
  let isLoading: boolean = $state(false);
  let pricingTimestamp: number | null = $state(null);
  let pricingFromCache: boolean = $state(false);
  let pricingIsStale: boolean = $state(false);

  /**
   * Fetch pricing for a specific card
   */
  async function fetchCardPrice(
    setId: string | number,
    cardId: string | number
  ): Promise<PricingResult | null> {
    const key = `${setId}_${cardId}`;
    isLoading = true;
    pricingFromCache = false;
    pricingIsStale = false;

    try {
      let pricing: PricingResult | null = null;

      // Try cache first
      if (browser) {
        pricing = await db.getCardPricing(setId, cardId);
        if (pricing) {
          log.debug(`Retrieved pricing from cache for card ${cardId}`);
          pricingFromCache = true;
        }
      }

      // Fetch from API if not in cache
      if (!pricing) {
        pricing = await api.getCardPricing(setId, cardId);
        log.debug(`Retrieved pricing from API for card ${cardId}`);
        pricingFromCache = false;

        // Cache the pricing
        if (browser) {
          try {
            await db.saveCardPricing(setId, cardId, pricing);
          } catch (err) {
            log.warn('Failed to cache pricing:', err);
          }
        }
      }

      // Update store
      priceData[key] = pricing;
      pricingTimestamp = pricing.metadata?.timestamp || Date.now();
      pricingIsStale = pricing.metadata?.isStale || false;

      log.info(`Pricing loaded for card ${cardId}`);
      return pricing;
    } catch (err) {
      log.error(`Failed to fetch pricing for card ${cardId}:`, err);
      return null;
    } finally {
      isLoading = false;
    }
  }

  /**
   * Load pricing for a card variant
   */
  async function loadPricingForVariant(
    setId: string | number,
    variantId: string | number
  ): Promise<PricingResult | null> {
    log.debug(`Loading pricing for variant ${variantId}`);
    return fetchCardPrice(setId, variantId);
  }

  /**
   * Filter valid price data from a pricing result
   */
  function filterValidPrices(pricing: PricingResult): PriceData | null {
    if (!pricing.pricing) return null;

    // Try standard pricing first
    const standardPricing = pricing.pricing['standard'] as PriceData;
    if (standardPricing && (standardPricing.market || standardPricing.mid)) {
      return standardPricing;
    }

    // Try other pricing entries
    for (const [key, value] of Object.entries(pricing.pricing)) {
      const priceValue = value as PriceData;
      if (priceValue && (priceValue.market || priceValue.mid)) {
        return priceValue;
      }
    }

    return null;
  }

  /**
   * Format a price for display
   */
  function formatPrice(price: number | undefined): string {
    if (price === undefined || price === null) return 'N/A';
    return `$${price.toFixed(2)}`;
  }

  return {
    get priceData() {
      return priceData;
    },

    get isLoading() {
      return isLoading;
    },

    get pricingTimestamp() {
      return pricingTimestamp;
    },

    get pricingFromCache() {
      return pricingFromCache;
    },

    get pricingIsStale() {
      return pricingIsStale;
    },

    fetchCardPrice,
    loadPricingForVariant,
    filterValidPrices,
    formatPrice,
  };
}

// Export singleton instance
export const pricingStore = createPricingStore();
