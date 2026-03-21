<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    price: VariantPrice;
  }

  let { price }: Props = $props();

  let chartCanvas: HTMLCanvasElement | undefined = $state(undefined);
  let chartInstance: any = $state(undefined);

  // Build 180d data points: [180d, 90d, 30d, 14d, 7d, 1d, Now]
  function buildPts(p: VariantPrice): { labels: string[]; data: number[] } {
    const now = p.market;
    const t = p.trends;
    const labels = ['180d', '90d', '30d', '14d', '7d', '1d', 'Now'];
    const days = [t?.days180, t?.days90, t?.days30, t?.days14, t?.days7, t?.days1];
    const data: number[] = [];
    for (const d of days) {
      data.push(d ? now - d.priceChange : now);
    }
    data.push(now);
    return { labels, data };
  }

  // Determine overall 180d direction
  function getDirection(p: VariantPrice): 'up' | 'down' | 'flat' {
    const pct = p.trends?.days180?.percentChange ?? 0;
    if (pct > 0.01) return 'up';
    if (pct < -0.01) return 'down';
    return 'flat';
  }

  function getLineColor(dir: 'up' | 'down' | 'flat'): string {
    if (dir === 'up') return '#4ade80';
    if (dir === 'down') return '#f87171';
    return '#9ca3af';
  }

  // Custom plugin: dashed current-price reference line
  const currentPriceLinePlugin = {
    id: 'currentPriceLine',
    afterDraw(chart: any) {
      const { ctx, scales, chartArea } = chart;
      const currentPrice = chart.config.options?.plugins?.currentPriceLine?.price;
      const color = chart.config.options?.plugins?.currentPriceLine?.color || '#9ca3af';
      if (currentPrice == null) return;

      const y = scales.y.getPixelForValue(currentPrice);
      if (y < chartArea.top || y > chartArea.bottom) return;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      // Label
      const label = `Current: ${pricingStore.formatPrice(currentPrice, price.currency)}`;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.7;
      ctx.font = '10px Geist, sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'right';
      ctx.fillText(label, chartArea.right - 4, y - 6);
      ctx.restore();
    },
  };

  async function initChart() {
    if (!chartCanvas) return;
    const ChartJS = await import('chart.js');
    ChartJS.Chart.register(
      ChartJS.LineController,
      ChartJS.LineElement,
      ChartJS.PointElement,
      ChartJS.LinearScale,
      ChartJS.CategoryScale,
      ChartJS.Tooltip,
      ChartJS.Filler
    );
    ChartJS.Chart.register(currentPriceLinePlugin);

    const { labels, data } = buildPts(price);
    const dir = getDirection(price);
    const lineColor = getLineColor(dir);

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
          pointRadius: 3,
          pointHoverRadius: 5,
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
        layout: { padding: { top: 36 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(13, 15, 20, 0.95)',
            titleColor: '#e8eaef',
            bodyColor: '#d7dee3',
            borderColor: 'rgba(255,255,255,0.06)',
            borderWidth: 0.5,
            padding: 8,
            caretSize: 4,
            caretPadding: 6,
            bodyFont: { family: 'Geist, sans-serif', size: 11 },
            titleFont: { family: 'Geist, sans-serif', size: 11, weight: '500' },
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.parsed.y;
                const current = price.market;
                const diff = val - current;
                const pct = current !== 0 ? ((diff / current) * 100).toFixed(1) : '0.0';
                const sign = diff >= 0 ? '+' : '';
                return `${pricingStore.formatPrice(val, price.currency)}  ${sign}${pricingStore.formatPrice(Math.abs(diff), price.currency)}  (${sign}${pct}%)`;
              },
            },
          },
          // @ts-ignore - custom plugin option
          currentPriceLine: {
            price: price.market,
            color: lineColor,
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#4b5563',
              font: { family: 'Geist, sans-serif', size: 10 },
            },
            border: { display: false },
          },
          y: {
            suggestedMin: yMin - yPad,
            suggestedMax: yMax + yPad,
            grid: {
              color: 'rgba(255,255,255,0.03)',
              lineWidth: 0.5,
            },
            ticks: {
              color: '#4b5563',
              font: { family: 'Geist, sans-serif', size: 10 },
              callback: (val: any) => pricingStore.formatPrice(val, price.currency),
            },
            border: { display: false },
          },
        },
      },
    });
  }

  onMount(() => {
    initChart();
  });

  $effect(() => {
    // Reinit when price changes
    if (price && chartCanvas) initChart();
  });

  onDestroy(() => {
    if (chartInstance) chartInstance.destroy();
  });
</script>

<div class="detail-chart-container">
  <canvas bind:this={chartCanvas}></canvas>
</div>

<style>
  .detail-chart-container {
    border: 0.5px solid var(--amber-border);
    border-radius: var(--radius-input);
    padding: 12px;
    margin-top: 8px;
    background-color: rgba(196, 154, 108, 0.02);
    height: 200px;
    animation: expand-in 0.25s ease-out;
    position: relative;
  }
</style>
