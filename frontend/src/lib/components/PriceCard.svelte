<script lang="ts">
  import type { VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import TrendSparkline from './TrendSparkline.svelte';

  interface Props {
    price: VariantPrice;
    label: string;
    isExpanded?: boolean;
    onToggleDetail?: () => void;
    onCopy?: (text: string) => void;
  }

  let { price, label, isExpanded = false, onToggleDetail, onCopy }: Props = $props();

  let formattedPrice = $derived(
    pricingStore.formatPrice(price.market, price.currency)
  );

  let formattedLow = $derived(
    price.low != null ? pricingStore.formatPrice(price.low, price.currency) : null
  );

  // 30d trend data
  let trend30d = $derived.by(() => {
    if (!price.trends?.days30) return null;
    const { percentChange } = price.trends.days30;
    if (Math.abs(percentChange) < 0.01) return { percent: '0.0', dir: 'flat' as const };
    return {
      percent: Math.abs(percentChange).toFixed(1),
      dir: percentChange > 0 ? 'up' as const : 'down' as const,
    };
  });

  // Build 30d sparkline points: [30d, 14d, 7d, 1d, now]
  let sparkPoints = $derived.by(() => {
    const t = price.trends;
    if (!t) return [];
    const now = price.market;
    const pts: number[] = [];
    const days = [t.days30, t.days14, t.days7, t.days1];
    for (const d of days) {
      if (d) pts.push(now - d.priceChange);
      else pts.push(now);
    }
    pts.push(now);
    return pts;
  });

  let sparkColor = $derived.by(() => {
    if (!trend30d || trend30d.dir === 'flat') return 'var(--price-neutral)';
    return trend30d.dir === 'up' ? 'var(--price-green)' : 'var(--price-red)';
  });

  let trendBadgeClass = $derived.by(() => {
    if (!trend30d || trend30d.dir === 'flat') return 'trend-flat';
    return trend30d.dir === 'up' ? 'trend-up' : 'trend-down';
  });

  async function copyPrice(e: MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(formattedPrice);
      onCopy?.(formattedPrice);
    } catch { /* clipboard may fail */ }
  }

  function handleCardClick() {
    onToggleDetail?.();
  }
</script>

<div
  class="price-card"
  class:expanded={isExpanded}
  role="button"
  tabindex="0"
  onclick={handleCardClick}
  onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(); }}
>
  <div class="card-top">
    <span class="card-label">{label}</span>
    {#if trend30d}
      <span class="trend-badge {trendBadgeClass}">
        {trend30d.dir === 'up' ? '\u25B2' : trend30d.dir === 'down' ? '\u25BC' : '\u2014'}
        {trend30d.percent}%
      </span>
    {/if}
  </div>

  <div class="card-body">
    <button
      class="market-price"
      onclick={copyPrice}
      title="Click to copy"
      type="button"
    >
      {formattedPrice}
    </button>
    {#if formattedLow}
      <span class="low-price">Low {formattedLow}</span>
    {/if}
  </div>

  <!-- Sparkline fills full card width -->
  {#if sparkPoints.length >= 2}
    <div class="sparkline-row">
      <TrendSparkline
        points={sparkPoints}
        color={sparkColor}
        height={24}
      />
    </div>
  {/if}

  <div class="card-bottom">
    <button
      class="detail-btn"
      class:active={isExpanded}
      onclick={(e) => { e.stopPropagation(); onToggleDetail?.(); }}
      type="button"
    >
      Detail
    </button>
  </div>
</div>

<style>
  .price-card {
    background-color: var(--surface-2);
    border: 0.5px solid var(--border-subtle);
    border-radius: var(--radius-input);
    padding: 10px 12px;
    cursor: pointer;
    transition: border-color 0.2s ease, background-color 0.2s ease;
    min-width: 100px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .price-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
  }

  .price-card.expanded {
    border-color: var(--amber-border);
    background-color: rgba(196, 154, 108, 0.04);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .trend-badge {
    font-size: 10px;
    font-weight: 500;
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.2px;
  }

  .trend-up {
    color: var(--price-green);
    background-color: rgba(74, 222, 128, 0.1);
  }

  .trend-down {
    color: var(--price-red);
    background-color: rgba(248, 113, 113, 0.1);
  }

  .trend-flat {
    color: var(--text-dim);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .card-body {
    /* No extra margin -- gap handles spacing */
  }

  .market-price {
    display: block;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: -0.2px;
    transition: color 0.15s ease;
    text-align: left;
  }

  .market-price:hover {
    color: var(--price-green);
    background: none;
  }

  .low-price {
    font-size: 10px;
    color: var(--text-dim);
    display: block;
    margin-top: 2px;
  }

  /* Sparkline fills full width */
  .sparkline-row {
    width: 100%;
  }

  .card-bottom {
    display: flex;
    justify-content: flex-end;
  }

  .detail-btn {
    font-size: 10px;
    font-weight: 500;
    color: var(--amber);
    background: none;
    border: 0.5px solid var(--amber-border);
    border-radius: var(--radius-badge);
    padding: 2px 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .detail-btn:hover {
    background-color: var(--amber-dim);
  }

  .detail-btn.active {
    background-color: var(--amber-dim);
    border-color: var(--amber);
  }
</style>
