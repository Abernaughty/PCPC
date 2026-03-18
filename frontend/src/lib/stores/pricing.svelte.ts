/**
 * Pricing Store - Card pricing data management using Svelte 5 runes
 *
 * Pricing is now variant-based (from Scrydex API). Each card can have
 * multiple variants, each with an array of VariantPrice entries for
 * different conditions (raw) and grades (graded).
 */

import { browser } from '$app/environment';
import type { PricingResult, VariantPrice, CardVariant } from '$lib/types';
import { api } from '$lib/services/api';
import { db } from '$lib/services/db';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('pricingStore');

interface PricingStore {
  priceData: Record<string, PricingResult>;
  isLoading: boolean;
  pricingError: string | null;
  pricingTimestamp: number | null;
  pricingFromCache: boolean;
  pricingIsStale: boolean;
  fetchCardPrice(
    setId: string,
    cardId: string
  ): Promise<PricingResult | null>;
  getMarketPrice(pricing: PricingResult, variantName?: string): VariantPrice | null;
  getRawPrices(variant: CardVariant): VariantPrice[];
  getGradedPrices(variant: CardVariant): VariantPrice[];
  formatPrice(price: number | undefined, currency?: string): string;
  clearError(): void;
}

/**
 * Create the pricing store with Svelte 5 runes
 */
function createPricingStore(): PricingStore {
  let priceData: Record<string, PricingResult> = $state({});
  let isLoading: boolean = $state(false);
  let pricingError: string | null = $state(null);
  let pricingTimestamp: number | null = $state(null);
  let pricingFromCache: boolean = $state(false);
  let pricingIsStale: boolean = $state(false);

  /**
   * Fetch pricing for a specific card
   */
  async function fetchCardPrice(
    setId: string,
    cardId: string
  ): Promise<PricingResult | null> {
    const key = `${setId}_${cardId}`;
    isLoading = true;
    pricingFromCache = false;
    pricingIsStale = false;
    pricingError = null;

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

      // Validate that we actually got pricing data with variants
      const hasVariants = pricing?.variants && pricing.variants.length > 0;
      const hasPrices = hasVariants && pricing!.variants!.some(
        (v) => v.prices && v.prices.length > 0
      );

      if (!hasPrices) {
        log.warn(`API returned card ${cardId} but no pricing data found`);
        pricingError = 'No pricing data available for this card. The card may be too new or pricing data may be temporarily unavailable.';
      }

      // Use immutable update to ensure Svelte 5 reactivity triggers
      priceData = { ...priceData, [key]: pricing };
      pricingTimestamp = pricing.metadata?.timestamp || Date.now();
      pricingIsStale = pricing.metadata?.isStale || false;

      log.info(`Pricing loaded for card ${cardId} (hasPrices: ${hasPrices})`);
      return pricing;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      log.error(`Failed to fetch pricing for card ${cardId}:`, err);
      pricingError = `Failed to load pricing: ${errorMessage}`;
      return null;
    } finally {
      isLoading = false;
    }
  }

  /**
   * Clear the current error
   */
  function clearError(): void {
    pricingError = null;
  }

  /**
   * Get the best market price for a card, optionally filtering by variant name.
   * Returns the NM (Near Mint) raw price if available, otherwise the first raw price.
   */
  function getMarketPrice(
    pricing: PricingResult,
    variantName?: string
  ): VariantPrice | null {
    const variants = pricing.variants;
    if (!variants || variants.length === 0) return null;

    // Find the target variant (or use the first one)
    const variant = variantName
      ? variants.find((v) => v.name === variantName)
      : variants[0];

    if (!variant || variant.prices.length === 0) return null;

    // Prefer NM raw price
    const nmRaw = variant.prices.find(
      (p) => p.type === 'raw' && p.condition === 'NM'
    );
    if (nmRaw) return nmRaw;

    // Fall back to any raw price
    const anyRaw = variant.prices.find((p) => p.type === 'raw');
    if (anyRaw) return anyRaw;

    // Fall back to first price entry
    return variant.prices[0];
  }

  /**
   * Get all raw (ungraded) prices for a variant
   */
  function getRawPrices(variant: CardVariant): VariantPrice[] {
    return variant.prices.filter((p) => p.type === 'raw');
  }

  /**
   * Get all graded prices for a variant
   */
  function getGradedPrices(variant: CardVariant): VariantPrice[] {
    return variant.prices.filter((p) => p.type === 'graded');
  }

  /**
   * Format a price for display
   */
  function formatPrice(price: number | undefined, currency: string = 'USD'): string {
    if (price === undefined || price === null) return 'N/A';

    if (currency === 'JPY') {
      return `¥${Math.round(price).toLocaleString()}`;
    }

    return `$${price.toFixed(2)}`;
  }

  return {
    get priceData() {
      return priceData;
    },

    get isLoading() {
      return isLoading;
    },

    get pricingError() {
      return pricingError;
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
    getMarketPrice,
    getRawPrices,
    getGradedPrices,
    formatPrice,
    clearError,
  };
}

// Export singleton instance
export const pricingStore = createPricingStore();
