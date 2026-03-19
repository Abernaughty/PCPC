<script lang="ts">
  import type { PricingResult } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    pricing: PricingResult;
  }

  let { pricing }: Props = $props();
</script>

{#if pricing.variants && pricing.variants.length > 0}
  <div class="pricing-section">
    <div class="pricing-header">
      <h2 class="section-title">Pricing Information</h2>
      <div class="pricing-metadata">
        {#if pricingStore.pricingFromCache}
          <span class="cache-indicator">Cached</span>
        {/if}
        {#if pricingStore.pricingIsStale}
          <span class="stale-indicator">Stale</span>
        {/if}
        {#if pricingStore.pricingTimestamp}
          <span class="timestamp">
            Updated: {new Date(pricingStore.pricingTimestamp).toLocaleDateString()}
          </span>
        {/if}
      </div>
    </div>

    {#each pricing.variants as variant (variant.name)}
      <div class="pricing-variant">
        <h3 class="pricing-title">{variant.name}</h3>

        <!-- Raw (Ungraded) Prices -->
        {#if pricingStore.getRawPrices(variant).length > 0}
          <div class="pricing-category">
            <h4 class="pricing-subtitle">Raw Prices</h4>
            <div class="pricing-grid">
              {#each pricingStore.getRawPrices(variant) as price}
                <div class="price-item">
                  <span class="price-label">{price.condition}:</span>
                  <span class="price-value">
                    {pricingStore.formatPrice(price.market, price.currency)}
                    {#if price.low && price.low !== price.market}
                      <span class="price-range">({pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)})</span>
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Graded Prices -->
        {#if pricingStore.getGradedPrices(variant).length > 0}
          <div class="pricing-category">
            <h4 class="pricing-subtitle">Graded Prices</h4>
            <div class="pricing-grid">
              {#each pricingStore.getGradedPrices(variant) as price}
                <div class="price-item">
                  <span class="price-label">{price.company} {price.grade}:</span>
                  <span class="price-value">
                    {pricingStore.formatPrice(price.market, price.currency)}
                    {#if price.low && price.low !== price.market}
                      <span class="price-range">({pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)})</span>
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<!-- Pricing Error -->
{#if pricingStore.pricingError}
  <div class="pricing-error">
    <span class="error-icon">&#x26A0;&#xFE0F;</span>
    <span class="error-text">{pricingStore.pricingError}</span>
    <button
      class="error-close"
      onclick={() => pricingStore.clearError()}
      aria-label="Dismiss pricing error"
      type="button"
    >
      &#x2715;
    </button>
  </div>
{/if}

<style>
  .pricing-section {
    margin-top: 2em;
  }

  .pricing-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5em;
    flex-wrap: wrap;
    gap: 1em;
  }

  .section-title {
    margin: 0;
    font-size: 1.3em;
    font-weight: 600;
    color: var(--color-heading);
    border-bottom: 2px solid var(--border-primary);
    padding-bottom: 0.5em;
  }

  .pricing-metadata {
    display: flex;
    gap: 1em;
    font-size: 0.85em;
  }

  .cache-indicator {
    background-color: rgba(60, 90, 166, 0.2);
    color: var(--color-cached-indicator);
    padding: 0.3em 0.6em;
    border-radius: 3px;
    font-weight: 500;
  }

  .stale-indicator {
    background-color: rgba(238, 21, 21, 0.2);
    color: var(--color-stale-indicator);
    padding: 0.3em 0.6em;
    border-radius: 3px;
    font-weight: 500;
  }

  .timestamp {
    color: var(--text-secondary);
  }

  .pricing-category {
    margin-bottom: 1.5em;
  }

  .pricing-variant {
    margin-bottom: 2em;
    padding-bottom: 1.5em;
    border-bottom: 1px solid var(--border-primary);
  }

  .pricing-variant:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  .pricing-title {
    margin: 0 0 1em 0;
    font-size: 1.1em;
    font-weight: 600;
    color: var(--color-pricing-category);
  }

  .pricing-subtitle {
    margin: 0 0 0.8em 0;
    font-size: 0.95em;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1em;
  }

  .price-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8em;
    background-color: var(--bg-secondary);
    border-radius: 4px;
    border-left: 4px solid var(--color-pokemon-red);
  }

  .price-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .price-value {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--color-price-value);
  }

  .price-range {
    font-size: 0.8em;
    font-weight: 400;
    color: var(--text-secondary);
    margin-left: 0.3em;
  }

  .pricing-error {
    margin-top: 2em;
    background-color: rgba(255, 165, 0, 0.1);
    border: 1px solid rgba(255, 165, 0, 0.5);
    border-radius: 4px;
    padding: 1em;
    display: flex;
    align-items: center;
    gap: 1em;
  }

  .error-icon {
    font-size: 1.3em;
    flex-shrink: 0;
  }

  .error-text {
    color: var(--color-error-text);
    flex: 1;
  }

  .error-close {
    background-color: transparent;
    border: none;
    color: var(--color-error-text);
    cursor: pointer;
    padding: 0;
    font-size: 1.2em;
    flex-shrink: 0;
    transition: opacity var(--transition-speed) ease;
  }

  .error-close:hover {
    opacity: 0.7;
  }

  @media (max-width: 768px) {
    .pricing-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
