<script lang="ts">
  import type { VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    prices: VariantPrice[];
    onCopy?: (text: string) => void;
  }

  let { prices, onCopy }: Props = $props();

  const CONDITION_ORDER: Record<string, number> = { 'NM': 0, 'LP': 1, 'MP': 2, 'HP': 3, 'DMG': 4 };

  let sortedPrices = $derived([...prices].sort((a, b) => {
    return (CONDITION_ORDER[a.condition] ?? 99) - (CONDITION_ORDER[b.condition] ?? 99);
  }));

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
    } catch {}
  }
</script>

{#if sortedPrices.length > 0}
  <div class="price-table-section">
    <h4 class="section-label">Raw Prices</h4>
    <div class="table-scroll-wrapper">
      <table class="price-table">
        <thead><tr><th class="col-condition">Condition</th><th class="col-market">Market</th><th class="col-low">Range</th></tr></thead>
        <tbody>
          {#each sortedPrices as price, i (`raw_${i}_${price.condition}`)}
            <tr class="price-row">
              <td class="cell-condition">{price.condition}</td>
              <td class="cell-market">
                <button class="market-value" class:copied={copiedIndex === i} onclick={() => copyMarketPrice(price, i)} title="Click to copy" type="button">
                  {pricingStore.formatPrice(price.market, price.currency)}
                </button>
              </td>
              <td class="cell-low">
                {#if price.low != null && price.high != null}
                  {pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)}
                {:else if price.low != null}
                  {pricingStore.formatPrice(price.low, price.currency)}
                {:else}&mdash;{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<style>
  .price-table-section { margin-bottom: 16px; }
  .section-label { margin: 0 0 8px 0; font-size: var(--fs-badge); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
  .table-scroll-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .price-table { width: 100%; border-collapse: collapse; font-size: var(--fs-body); min-width: 280px; }
  .price-table thead { border-bottom: 1px solid var(--border-subtle); }
  .price-table th { font-size: var(--fs-micro); font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-dim); text-align: left; padding: 6px 12px 8px; white-space: nowrap; }
  .col-condition { width: 80px; }
  .col-low { text-align: right !important; width: 140px; }
  .price-row { border-bottom: 0.5px solid var(--border-faint); transition: background-color 0.12s ease; }
  .price-row:hover { background-color: rgba(255, 255, 255, 0.02); }
  .price-row:last-child { border-bottom: none; }
  .price-table td { padding: 8px 12px; }
  .cell-condition { font-weight: 500; color: var(--text-secondary); white-space: nowrap; }
  .market-value { background: none; border: none; padding: 0; font-size: var(--fs-secondary); font-weight: 600; color: var(--price-green); cursor: pointer; transition: color 0.15s ease, text-shadow 0.15s ease; white-space: nowrap; }
  .market-value:hover { text-shadow: 0 0 10px rgba(74, 222, 128, 0.3); background: none; }
  .market-value.copied { color: #86efac; text-shadow: 0 0 8px rgba(74, 222, 128, 0.4); }
  .cell-low { text-align: right; font-size: var(--fs-badge); color: var(--text-dim); white-space: nowrap; }
  @media (max-width: 768px) { .col-low { width: auto; } .price-table th, .price-table td { padding: 6px 8px; } .market-value { font-size: var(--fs-body); } .cell-low { font-size: var(--fs-micro); } }
</style>
