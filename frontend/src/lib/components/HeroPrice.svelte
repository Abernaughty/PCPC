<script lang="ts">
  import type { VariantPrice, CardVariant } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    price: VariantPrice | null;
    variant: CardVariant;
    fromCache?: boolean;
    isStale?: boolean;
    timestamp?: number | null;
  }

  let { price, variant, fromCache = false, isStale = false, timestamp = null }: Props = $props();

  // Trend data from the price entry
  let trend30d = $derived.by(() => {
    if (!price?.trends?.days30) return null;
    const { percentChange, priceChange } = price.trends.days30;
    if (percentChange === 0 && priceChange === 0) return null;
    return {
      percent: Math.abs(percentChange).toFixed(1),
      isPositive: percentChange >= 0,
      label: '30d',
    };
  });

  // Format the timestamp
  let updatedLabel = $derived.by(() => {
    if (!timestamp) return null;
    const now = Date.now();
    const diff = now - timestamp;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Updated just now';
    if (hours < 24) return `Updated ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Updated yesterday';
    return `Updated ${days}d ago`;
  });

  let formattedPrice = $derived(
    price ? pricingStore.formatPrice(price.market, price.currency) : 'N/A'
  );

  // Click-to-copy
  let copied = $state(false);
  async function copyPrice() {
    if (!price) return;
    try {
      await navigator.clipboard.writeText(formattedPrice);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      // Clipboard API may fail in some contexts
    }
  }
</script>

{#if price}
  <div class="hero-price">
    <div class="hero-label">MARKET PRICE</div>
    <div class="hero-row">
      <button
        class="hero-value"
        class:copied
        onclick={copyPrice}
        title="Click to copy"
        type="button"
      >
        {formattedPrice}
      </button>

      {#if price.condition}
        <span class="condition-badge">{price.condition}</span>
      {/if}

      {#if trend30d}
        <span
          class="trend-pill"
          class:positive={trend30d.isPositive}
          class:negative={!trend30d.isPositive}
        >
          {trend30d.isPositive ? '▲' : '▼'} {trend30d.percent}% {trend30d.label}
        </span>
      {/if}
    </div>

    <div class="hero-meta">
      <span class="live-dot"></span>
      {#if updatedLabel}
        <span class="meta-text">{updatedLabel}</span>
        <span class="meta-sep">&middot;</span>
      {/if}
      <span class="meta-text">Scrydex</span>
      {#if variant.name}
        <span class="meta-sep">&middot;</span>
        <span class="meta-text">{variant.name}</span>
      {/if}
      {#if fromCache}
        <span class="meta-sep">&middot;</span>
        <span class="meta-badge cache">Cached</span>
      {/if}
      {#if isStale}
        <span class="meta-sep">&middot;</span>
        <span class="meta-badge stale">Stale</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .hero-price {
    background-color: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 16px 20px;
    margin-bottom: 16px;
  }

  .hero-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .hero-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .hero-value {
    font-size: 30px;
    font-weight: 500;
    letter-spacing: -0.3px;
    color: var(--price-green);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s ease, text-shadow 0.15s ease;
    line-height: 1.1;
  }

  .hero-value:hover {
    text-shadow: 0 0 12px rgba(74, 222, 128, 0.3);
    background: none;
  }

  .hero-value.copied {
    color: #86efac;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
  }

  .condition-badge {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    background-color: rgba(255, 255, 255, 0.04);
    padding: 3px 8px;
    border-radius: var(--radius-badge);
    letter-spacing: 0.3px;
  }

  .trend-pill {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 8px;
    border-radius: var(--radius-badge);
    letter-spacing: 0.2px;
  }

  .trend-pill.positive {
    color: var(--price-green);
    background-color: rgba(74, 222, 128, 0.1);
  }

  .trend-pill.negative {
    color: var(--price-red);
    background-color: rgba(248, 113, 113, 0.1);
  }

  .hero-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--text-dim);
    flex-wrap: wrap;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--price-green);
    flex-shrink: 0;
  }

  .meta-text {
    color: var(--text-dim);
  }

  .meta-sep {
    color: var(--text-faint);
  }

  .meta-badge {
    font-size: 10px;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 3px;
  }

  .meta-badge.cache {
    background-color: rgba(59, 130, 246, 0.15);
    color: var(--badge-en-text);
  }

  .meta-badge.stale {
    background-color: rgba(232, 69, 60, 0.15);
    color: var(--accent-red);
  }
</style>
