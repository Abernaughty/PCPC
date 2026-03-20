<script lang="ts">
  import type { VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    prices: VariantPrice[];
    onCopy?: (text: string) => void;
  }

  let { prices, onCopy }: Props = $props();

  /** Fixed display order for conditions */
  const CONDITION_ORDER: Record<string, number> = {
    'NM': 0,
    'LP': 1,
    'MP': 2,
    'HP': 3,
    'DMG': 4,
  };

  let sortedPrices = $derived(
    [...prices].sort((a, b) => {
      const orderA = CONDITION_ORDER[a.condition] ?? 99;
      const orderB = CONDITION_ORDER[b.condition] ?? 99;
      return orderA - orderB;
    })
  );

  /** Track which row just got copied for flash feedback */
  let copiedIndex = $state<number | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyMarketPrice(price: VariantPrice, index: number) {
    const formatted = pricingStore.formatPrice(price.market, price.currency);
    try {
      await navigator.clipboard.writeText(formatted);
      copiedIndex = index;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedIndex = null), 1200);
      onCopy?.(formatted);
    } catch {
      // Clipboard API may not be available
    }
  }
</script>

{#if sortedPrices.length > 0}
  <div class="price-table-section">
    <h4 class="section-label">Raw Prices</h4>
    <table class="price-table">
      <thead>
        <tr>
          <th class="col-condition">Condition</th>
          <th class="col-market">Market</th>
          <th class="col-low">Low</th>
        </tr>
      </thead>
      <tbody>
        {#each sortedPrices as price, i (`raw_${i}_${price.condition}`)}
          <tr class="price-row">
            <td class="cell-condition">{price.condition}</td>
            <td class="cell-market">
              <button
                class="market-value"
                class:copied={copiedIndex === i}
                onclick={() => copyMarketPrice(price, i)}
                title="Click to copy"
                type="button"
              >
                {pricingStore.formatPrice(price.market, price.currency)}
              </button>
            </td>
            <td class="cell-low">
              {#if price.low != null && price.high != null}
                {pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)}
              {:else if price.low != null}
                {pricingStore.formatPrice(price.low, price.currency)}
              {:else}
                &mdash;
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .price-table-section {
    margin-bottom: 16px;
  }

  .section-label {
    margin: 0 0 8px 0;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .price-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .price-table thead {
    border-bottom: 1px solid var(--border-subtle);
  }

  .price-table th {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--text-dim);
    text-align: left;
    padding: 6px 12px 8px;
  }

  .col-condition {
    width: 80px;
  }

  .col-market {
    width: auto;
  }

  .col-low {
    text-align: right !important;
    width: 140px;
  }

  .price-row {
    border-bottom: 0.5px solid var(--border-faint);
    transition: background-color 0.12s ease;
  }

  .price-row:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }

  .price-row:last-child {
    border-bottom: none;
  }

  .price-table td {
    padding: 8px 12px;
  }

  .cell-condition {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .cell-market {
    /* Contains the clickable button */
  }

  .market-value {
    background: none;
    border: none;
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--price-green);
    cursor: pointer;
    transition: color 0.15s ease, text-shadow 0.15s ease;
  }

  .market-value:hover {
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.3);
    background: none;
  }

  .market-value.copied {
    color: #86efac;
    text-shadow: 0 0 8px rgba(74, 222, 128, 0.4);
  }

  .cell-low {
    text-align: right;
    font-size: 11px;
    color: var(--text-dim);
  }

  @media (max-width: 768px) {
    .col-low {
      width: 110px;
    }
  }
</style>
