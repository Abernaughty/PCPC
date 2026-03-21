<script lang="ts">
  import type { VariantPrice, CardVariant } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    price: VariantPrice | null;
    variant: CardVariant;
    fromCache?: boolean;
    isStale?: boolean;
    timestamp?: number | null;
  }

  let { price, variant, fromCache = false, isStale = false, timestamp = null }: Props = $props();

  // Trend data
  let trend30d = $derived.by(() => {
    if (!price?.trends?.days30) return null;
    const { percentChange } = price.trends.days30;
    if (Math.abs(percentChange) < 0.01) return null;
    return {
      percent: Math.abs(percentChange).toFixed(1),
      isPositive: percentChange >= 0,
      label: '30d',
    };
  });

  let trendDir = $derived.by(() => {
    if (!trend30d) return 'flat';
    return trend30d.isPositive ? 'up' : 'down';
  });

  // 180d direction for chart color
  let chartDir = $derived.by(() => {
    const pct = price?.trends?.days180?.percentChange ?? 0;
    if (pct > 0.01) return 'up';
    if (pct < -0.01) return 'down';
    return 'flat';
  });

  let updatedLabel = $derived.by(() => {
    if (!timestamp) return null;
    const diff = Date.now() - timestamp;
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

  let conditionLabel = $derived(
    price?.condition ?? 'NM'
  );

  // Click-to-copy
  let copied = $state(false);
  async function copyPrice() {
    if (!price) return;
    try {
      await navigator.clipboard.writeText(formattedPrice);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch { /* clipboard may fail */ }
  }

  // --- Embedded 180d Chart ---
  let chartCanvas: HTMLCanvasElement | undefined = $state(undefined);
  let chartInstance: any = $state(undefined);

  function buildPts(): { labels: string[]; data: number[] } {
    if (!price) return { labels: [], data: [] };
    const now = price.market;
    const t = price.trends;
    const labels = ['180d', '90d', '30d', '14d', '7d', '1d', 'Now'];
    const days = [t?.days180, t?.days90, t?.days30, t?.days14, t?.days7, t?.days1];
    const data: number[] = [];
    for (const d of days) {
      data.push(d ? now - d.priceChange : now);
    }
    data.push(now);
    return { labels, data };
  }

  function getLineColor(dir: string): string {
    if (dir === 'up') return '#4ade80';
    if (dir === 'down') return '#f87171';
    return '#9ca3af';
  }

  const currentPriceLinePlugin = {
    id: 'heroCurrentPriceLine',
    afterDraw(chart: any) {
      const { ctx, scales, chartArea } = chart;
      const cp = chart.config.options?.plugins?.heroCurrentPriceLine?.price;
      const clr = chart.config.options?.plugins?.heroCurrentPriceLine?.color || '#9ca3af';
      if (cp == null) return;
      const y = scales.y.getPixelForValue(cp);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = clr;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      const label = `Current: ${price ? pricingStore.formatPrice(cp, price.currency) : ''}`;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.6;
      ctx.font = '10px Geist, sans-serif';
      ctx.fillStyle = clr;
      ctx.textAlign = 'right';
      ctx.fillText(label, chartArea.right - 4, y - 6);
      ctx.restore();
    },
  };

  async function initChart() {
    if (!chartCanvas || !price) return;
    const ChartJS = await import('chart.js');
    ChartJS.Chart.register(
      ChartJS.LineController, ChartJS.LineElement, ChartJS.PointElement,
      ChartJS.LinearScale, ChartJS.CategoryScale, ChartJS.Tooltip, ChartJS.Filler
    );
    ChartJS.Chart.register(currentPriceLinePlugin);

    const { labels, data } = buildPts();
    if (data.length < 2) return;
    const lineColor = getLineColor(chartDir);
    const yMin = Math.min(...data);
    const yMax = Math.max(...data);
    const yRange = yMax - yMin || 1;
    const yPad = Math.max(yRange * 0.25, yMax * 0.05, 0.05);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new ChartJS.Chart(chartCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: lineColor,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: lineColor,
          pointBorderColor: 'transparent',
          tension: 0.3,
          fill: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 16, left: 0, right: 0, bottom: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13, 15, 20, 0.95)',
            titleColor: '#e8eaef',
            bodyColor: '#d7dee3',
            borderColor: 'rgba(255,255,255,0.06)',
            borderWidth: 0.5,
            padding: 8,
            bodyFont: { family: 'Geist, sans-serif', size: 11 },
            titleFont: { family: 'Geist, sans-serif', size: 11, weight: '500' },
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.parsed.y;
                if (!price) return '';
                const diff = val - price.market;
                const pct = price.market !== 0 ? ((diff / price.market) * 100).toFixed(1) : '0.0';
                const sign = diff >= 0 ? '+' : '';
                return `${pricingStore.formatPrice(val, price.currency)}  ${sign}${pricingStore.formatPrice(Math.abs(diff), price.currency)}  (${sign}${pct}%)`;
              },
            },
          },
          // @ts-ignore
          heroCurrentPriceLine: { price: price.market, color: lineColor },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#374151', font: { family: 'Geist, sans-serif', size: 10 } },
            border: { display: false },
          },
          y: {
            suggestedMin: yMin - yPad,
            suggestedMax: yMax + yPad,
            grid: { color: 'rgba(255,255,255,0.03)', lineWidth: 0.5 },
            ticks: {
              color: '#374151',
              font: { family: 'Geist, sans-serif', size: 10 },
              callback: (val: any) => price ? pricingStore.formatPrice(val, price.currency) : '',
            },
            border: { display: false },
          },
        },
      },
    });
  }

  onMount(() => { initChart(); });
  $effect(() => { if (price && chartCanvas) initChart(); });
  onDestroy(() => { if (chartInstance) chartInstance.destroy(); });
</script>

{#if price}
  <div class="hero-price" class:trend-up={trendDir === 'up'} class:trend-down={trendDir === 'down'}>
    <!-- Specular highlight -->
    <div class="hero-highlight" class:glow-green={trendDir === 'up'} class:glow-red={trendDir === 'down'}></div>

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
          {trend30d.isPositive ? '\u25B2' : '\u25BC'} {trend30d.percent}% {trend30d.label}
        </span>
      {/if}
    </div>

    <div class="hero-meta">
      <span class="live-dot" class:dot-green={trendDir === 'up'} class:dot-red={trendDir === 'down'}></span>
      {#if updatedLabel}
        <span class="meta-text">{updatedLabel}</span>
        <span class="meta-sep">&#x00B7;</span>
      {/if}
      <span class="meta-text">Scrydex</span>
      {#if variant.name}
        <span class="meta-sep">&#x00B7;</span>
        <span class="meta-text">{variant.name}</span>
      {/if}
      {#if fromCache}
        <span class="meta-sep">&#x00B7;</span>
        <span class="meta-badge cache">Cached</span>
      {/if}
      {#if isStale}
        <span class="meta-sep">&#x00B7;</span>
        <span class="meta-badge stale">Stale</span>
      {/if}
    </div>

    <!-- Chart section label -->
    <div class="chart-label-row">
      <span class="chart-label">180D PRICE HISTORY &#x2014; {conditionLabel}</span>
      <span class="chart-hint">Hover for details</span>
    </div>

    <!-- Embedded 180d chart -->
    <div class="hero-chart">
      <canvas bind:this={chartCanvas}></canvas>
    </div>
  </div>
{/if}

<style>
  .hero-price {
    background-color: var(--surface-2);
    border: 0.5px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 16px 20px;
    margin-bottom: 16px;
    position: relative;
  }

  .hero-highlight {
    position: absolute;
    top: 0;
    left: 20px;
    right: 20px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.08) 30%,
      rgba(255, 255, 255, 0.12) 50%,
      rgba(255, 255, 255, 0.08) 70%,
      transparent
    );
    pointer-events: none;
  }

  .hero-highlight.glow-green {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(74, 222, 128, 0.12) 30%,
      rgba(74, 222, 128, 0.2) 50%,
      rgba(74, 222, 128, 0.12) 70%,
      transparent
    );
  }

  .hero-highlight.glow-red {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(248, 113, 113, 0.12) 30%,
      rgba(248, 113, 113, 0.2) 50%,
      rgba(248, 113, 113, 0.12) 70%,
      transparent
    );
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
    font-size: 28px;
    font-weight: 600;
    letter-spacing: -0.3px;
    color: var(--text-primary);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color 0.15s ease;
    line-height: 1.1;
  }

  .hero-value:hover {
    color: var(--price-green);
    background: none;
  }

  .hero-value.copied {
    color: #86efac;
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
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--price-neutral);
    flex-shrink: 0;
    animation: pulse-dot 2s ease-in-out infinite;
  }

  .live-dot.dot-green { background-color: var(--price-green); }
  .live-dot.dot-red { background-color: var(--price-red); }

  .meta-text { color: var(--text-dim); }
  .meta-sep { color: var(--text-faint); }

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

  .chart-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 16px;
    margin-bottom: 4px;
  }

  .chart-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .chart-hint {
    font-size: 10px;
    color: var(--text-dim);
    font-style: italic;
  }

  .hero-chart {
    height: 140px;
    position: relative;
  }

  @media (max-width: 768px) {
    .hero-price { padding: 12px 14px; }
    .hero-value { font-size: 24px; }
    .hero-row { gap: 8px; }
    .hero-meta { gap: 4px; font-size: 10px; }
    .hero-chart { height: 110px; }
    .chart-hint { display: none; }
  }

  @media (max-width: 480px) {
    .hero-value { font-size: 22px; }
    .condition-badge, .trend-pill { font-size: 10px; padding: 2px 6px; }
    .hero-chart { height: 90px; }
  }
</style>
