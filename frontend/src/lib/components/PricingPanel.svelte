<script lang="ts">
  import type { PricingResult, CardVariant } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import HeroPrice from './HeroPrice.svelte';
  import VariantPills from './VariantPills.svelte';

  interface Props {
    pricing: PricingResult;
  }

  let { pricing }: Props = $props();

  // Selected variant name — defaults to first variant that has prices,
  // falling back to the first variant overall
  let selectedVariantName = $state<string>('');

  // When pricing changes (new card selected), reset to best default
  $effect(() => {
    if (pricing.variants && pricing.variants.length > 0) {
      const withPrices = pricing.variants.find((v) => v.prices.length > 0);
      selectedVariantName = withPrices?.name ?? pricing.variants[0].name;
    }
  });

  // Derive the active variant object
  let activeVariant = $derived.by(() => {
    if (!pricing.variants) return null;
    return pricing.variants.find((v) => v.name === selectedVariantName) ?? null;
  });

  // Derive the market price for the hero display
  let heroPrice = $derived.by(() => {
    if (!activeVariant) return null;
    return pricingStore.getMarketPrice(pricing, activeVariant.name);
  });

  // Derive raw and graded prices for the active variant
  let rawPrices = $derived(activeVariant ? pricingStore.getRawPrices(activeVariant) : []);
  let gradedPrices = $derived(activeVariant ? pricingStore.getGradedPrices(activeVariant) : []);

  function handleVariantSelect(name: string) {
    selectedVariantName = name;
  }
</script>

{#if pricing.variants && pricing.variants.length > 0 && activeVariant}
  <div class="pricing-section">
    <!-- Hero Price -->
    <HeroPrice
      price={heroPrice}
      variant={activeVariant}
      fromCache={pricingStore.pricingFromCache}
      isStale={pricingStore.pricingIsStale}
      timestamp={pricingStore.pricingTimestamp}
    />

    <!-- Variant Pills -->
    {#if pricing.variants.length > 1}
      <VariantPills
        variants={pricing.variants}
        selected={selectedVariantName}
        onselect={handleVariantSelect}
      />
    {/if}

    <!-- Raw (Ungraded) Prices -->
    {#if rawPrices.length > 0}
      <div class="pricing-category">
        <h4 class="pricing-subtitle">Raw Prices</h4>
        <div class="pricing-grid">
          {#each rawPrices as price (price.condition)}
            <div class="price-item">
              <span class="price-label">{price.condition}:</span>
              <span class="price-value">
                {pricingStore.formatPrice(price.market, price.currency)}
                {#if price.low && price.low !== price.market}
                  <span class="price-range">
                    ({pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)})
                  </span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Graded Prices -->
    {#if gradedPrices.length > 0}
      <div class="pricing-category">
        <h4 class="pricing-subtitle">Graded Prices</h4>
        <div class="pricing-grid">
          {#each gradedPrices as price (`${price.company}_${price.grade}`)}
            <div class="price-item">
              <span class="price-label">{price.company} {price.grade}:</span>
              <span class="price-value">
                {pricingStore.formatPrice(price.market, price.currency)}
                {#if price.low && price.low !== price.market}
                  <span class="price-range">
                    ({pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)})
                  </span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Empty variant state -->
    {#if rawPrices.length === 0 && gradedPrices.length === 0}
      <div class="empty-variant">
        <span class="empty-icon">&empty;</span>
        <p class="empty-text">No pricing data available for this variant yet.</p>
        <p class="empty-sub">This variant may be too new or not widely traded.</p>
      </div>
    {/if}
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
    margin-top: 20px;
  }

  .pricing-category {
    margin-bottom: 16px;
  }

  .pricing-subtitle {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 6px;
  }

  .price-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--surface-2);
    border-radius: var(--radius-input);
    border-left: 3px solid var(--accent-red);
  }

  .price-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .price-value {
    font-size: 13px;
    font-weight: 600;
    color: var(--price-green);
  }

  .price-range {
    font-size: 10px;
    font-weight: 400;
    color: var(--text-dim);
    margin-left: 4px;
  }

  /* Empty variant state */
  .empty-variant {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-dim);
  }

  .empty-icon {
    font-size: 28px;
    display: block;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .empty-text {
    margin: 0 0 4px 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  .empty-sub {
    margin: 0;
    font-size: 11px;
    color: var(--text-dim);
  }

  /* Pricing error */
  .pricing-error {
    margin-top: 16px;
    background-color: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: var(--radius-input);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .error-icon {
    font-size: 1.1em;
    flex-shrink: 0;
  }

  .error-text {
    color: var(--price-red);
    flex: 1;
    font-size: 12px;
  }

  .error-close {
    background-color: transparent;
    border: none;
    color: var(--price-red);
    cursor: pointer;
    padding: 0;
    font-size: 1em;
    flex-shrink: 0;
    transition: opacity 0.15s ease;
  }

  .error-close:hover {
    opacity: 0.7;
    background: none;
  }

  @media (max-width: 768px) {
    .pricing-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
