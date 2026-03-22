<script lang="ts">
  import type { VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    prices: VariantPrice[];
    onCopy?: (text: string) => void;
  }

  let { prices, onCopy }: Props = $props();

  const COMPANY_ORDER: Record<string, number> = { 'PSA': 0, 'CGC': 1, 'BGS': 2 };
  const COMPANY_COLORS: Record<string, { bg: string; text: string }> = {
    'PSA': { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    'CGC': { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa' },
    'BGS': { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15' },
  };
  const DEFAULT_BADGE = { bg: 'rgba(255, 255, 255, 0.06)', text: 'var(--text-secondary)' };

  let sortedPrices = $derived([...prices].sort((a, b) => {
    const compA = COMPANY_ORDER[a.company ?? ''] ?? 99;
    const compB = COMPANY_ORDER[b.company ?? ''] ?? 99;
    if (compA !== compB) return compA - compB;
    return parseFloat(b.grade ?? '0') - parseFloat(a.grade ?? '0');
  }));

  let copiedIndex = $state<number | null>(null);
  let copyTimer: ReturnType<typeof setTimeout> | null = null;

  async function copyGradedPrice(price: VariantPrice, index: number) {
    const formatted = pricingStore.formatPrice(price.market, price.currency);
    try {
      await navigator.clipboard.writeText(formatted);
      copiedIndex = index;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copiedIndex = null), 1200);
      onCopy?.(formatted);
    } catch {}
  }

  function getBadgeColors(company?: string) { return COMPANY_COLORS[company ?? ''] ?? DEFAULT_BADGE; }
</script>

{#if sortedPrices.length > 0}
  <div class="graded-section">
    <h4 class="section-label">Graded Prices</h4>
    <div class="graded-grid">
      {#each sortedPrices as price, i (`graded_${i}_${price.company}_${price.grade}`)}
        {@const badge = getBadgeColors(price.company)}
        <button class="grade-card" class:copied={copiedIndex === i} onclick={() => copyGradedPrice(price, i)} title="Click to copy" type="button">
          <span class="grade-badge" style:background-color={badge.bg} style:color={badge.text}>{price.company ?? '?'} {price.grade ?? ''}</span>
          <span class="grade-price">{pricingStore.formatPrice(price.market, price.currency)}</span>
          <span class="grade-range">
            {#if price.low != null && price.high != null && price.low !== price.market}
              {pricingStore.formatPrice(price.low, price.currency)} &ndash; {pricingStore.formatPrice(price.high, price.currency)}
            {:else}&mdash;{/if}
          </span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .graded-section { margin-bottom: 16px; }
  .section-label { margin: 0 0 8px 0; font-size: var(--fs-badge); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
  .graded-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .grade-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 10px; background-color: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); cursor: pointer; transition: border-color 0.15s ease, box-shadow 0.15s ease; text-align: center; min-height: 44px; }
  .grade-card:hover { border-color: rgba(255, 255, 255, 0.1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2); background-color: var(--surface-2); }
  .grade-card.copied { border-color: rgba(74, 222, 128, 0.3); box-shadow: 0 0 12px rgba(74, 222, 128, 0.1); }
  .grade-badge { font-size: var(--fs-badge); font-weight: 600; padding: 3px 10px; border-radius: var(--radius-badge); letter-spacing: 0.3px; white-space: nowrap; }
  .grade-price { font-size: 16px; font-weight: 600; color: var(--price-green); letter-spacing: -0.2px; transition: color 0.15s ease; }
  .grade-card.copied .grade-price { color: #86efac; }
  .grade-range { font-size: var(--fs-micro); color: var(--text-dim); }
  @media (max-width: 768px) { .graded-grid { grid-template-columns: repeat(2, 1fr); } .grade-card { padding: 10px 8px; } .grade-price { font-size: 14px; } }
  @media (max-width: 380px) { .graded-grid { grid-template-columns: 1fr; } }
</style>
