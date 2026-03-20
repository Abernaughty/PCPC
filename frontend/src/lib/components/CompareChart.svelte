<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface Props {
    rawPrices: VariantPrice[];
    gradedPrices: VariantPrice[];
  }

  let { rawPrices, gradedPrices }: Props = $props();

  // Segmented control: Raw vs Graded
  let mode = $state<'raw' | 'graded'>('raw');

  // Selected conditions/grades for multi-select
  let selectedRaw = $state<Set<string>>(new Set(['NM']));
  let selectedGradedCompany = $state<string>('');
  let selectedGrades = $state<Set<string>>(new Set());

  // Graded companies
  let gradedCompanies = $derived.by(() => {
    const companies = new Set<string>();
    for (const p of gradedPrices) {
      if (p.company) companies.add(p.company);
    }
    return Array.from(companies);
  });

  $effect(() => {
    if (gradedCompanies.length > 0 && !gradedCompanies.includes(selectedGradedCompany)) {
      selectedGradedCompany = gradedCompanies[0];
    }
  });

  let filteredGraded = $derived(
    gradedPrices.filter((p) => p.company === selectedGradedCompany)
  );

  // Auto-select highest grade
  $effect(() => {
    if (filteredGraded.length > 0 && selectedGrades.size === 0) {
      const first = filteredGraded[0].grade || filteredGraded[0].condition;
      selectedGrades = new Set([first]);
    }
  });

  // Color maps
  const conditionColors: Record<string, string> = {
    NM: '#4ade80', LP: '#60a5fa', MP: '#a78bfa', HP: '#fbbf24', DM: '#f87171',
  };

  const companyLuminance: Record<string, string[]> = {
    PSA: ['#60a5fa', '#93c5fd', '#bfdbfe'],
    CGC: ['#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f3f0ff', '#f8f6ff'],
    BGS: ['#fbbf24', '#fcd34d', '#fde68a'],
    SGC: ['#34d399', '#6ee7b7', '#a7f3d0'],
  };

  // Build 180d points for a VariantPrice
  function buildPts(p: VariantPrice): number[] {
    const now = p.market;
    const t = p.trends;
    const days = [t?.days180, t?.days90, t?.days30, t?.days14, t?.days7, t?.days1];
    const data: number[] = [];
    for (const d of days) {
      data.push(d ? now - d.priceChange : now);
    }
    data.push(now);
    return data;
  }

  let chartCanvas: HTMLCanvasElement | undefined = $state(undefined);
  let chartInstance: any = $state(undefined);

  async function initChart() {
    if (!chartCanvas) return;
    const ChartJS = await import('chart.js');
    ChartJS.Chart.register(
      ChartJS.LineController, ChartJS.LineElement, ChartJS.PointElement,
      ChartJS.LinearScale, ChartJS.CategoryScale, ChartJS.Tooltip, ChartJS.Filler
    );

    const labels = ['180d', '90d', '30d', '14d', '7d', '1d', 'Now'];
    const datasets: any[] = [];

    if (mode === 'raw') {
      for (const rp of rawPrices) {
        if (!selectedRaw.has(rp.condition)) continue;
        datasets.push({
          label: rp.condition,
          data: buildPts(rp),
          borderColor: conditionColors[rp.condition] || '#9ca3af',
          borderWidth: 1.5,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: conditionColors[rp.condition] || '#9ca3af',
          pointBorderColor: 'transparent',
          tension: 0.3,
          fill: false,
        });
      }
    } else {
      const grades = filteredGraded.filter((gp) => {
        const key = gp.grade || gp.condition;
        return selectedGrades.has(key);
      });
      const lumShades = companyLuminance[selectedGradedCompany] || ['#9ca3af'];
      for (let i = 0; i < grades.length; i++) {
        const gp = grades[i];
        const color = lumShades[i % lumShades.length];
        datasets.push({
          label: `${gp.company} ${gp.grade || gp.condition}`,
          data: buildPts(gp),
          borderColor: color,
          borderWidth: 1.5,
          pointRadius: 2,
          pointHoverRadius: 4,
          pointBackgroundColor: color,
          pointBorderColor: 'transparent',
          tension: 0.3,
          fill: false,
        });
      }
    }

    // Y-axis bounds
    const allData = datasets.flatMap((d: any) => d.data as number[]);
    const yMin = allData.length > 0 ? Math.min(...allData) : 0;
    const yMax = allData.length > 0 ? Math.max(...allData) : 1;
    const yRange = yMax - yMin || 1;
    const yPad = Math.max(yRange * 0.25, yMax * 0.05, 0.05);

    if (chartInstance) chartInstance.destroy();

    chartInstance = new ChartJS.Chart(chartCanvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 8 } },
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
                const dataArr = ctx.dataset.data;
                const current = dataArr[dataArr.length - 1];
                const diff = val - current;
                const pct = current !== 0 ? ((diff / current) * 100).toFixed(1) : '0.0';
                const sign = diff >= 0 ? '+' : '';
                return `${ctx.dataset.label}: ${pricingStore.formatPrice(val)} ${sign}${pct}%`;
              },
            },
          },
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
              callback: (val: any) => pricingStore.formatPrice(val),
            },
            border: { display: false },
          },
        },
      },
    });
  }

  onMount(() => { initChart(); });

  $effect(() => {
    // Reinit when selections change
    if (chartCanvas) {
      // Touch reactive deps
      void mode;
      void selectedRaw;
      void selectedGradedCompany;
      void selectedGrades;
      void rawPrices;
      void gradedPrices;
      initChart();
    }
  });

  onDestroy(() => { if (chartInstance) chartInstance.destroy(); });

  function toggleRawCondition(cond: string) {
    const next = new Set(selectedRaw);
    if (next.has(cond)) { if (next.size > 1) next.delete(cond); }
    else next.add(cond);
    selectedRaw = next;
  }

  function toggleGrade(grade: string) {
    const next = new Set(selectedGrades);
    if (next.has(grade)) { if (next.size > 1) next.delete(grade); }
    else next.add(grade);
    selectedGrades = next;
  }
</script>

<div class="compare-section">
  <div class="compare-header">
    <div class="section-label-row">
      <span class="section-label">COMPARE TRENDS</span>
      <span class="section-period">(180d)</span>
    </div>
    <div class="segment-control">
      <button
        class="segment" class:active={mode === 'raw'}
        onclick={() => { mode = 'raw'; }}
        type="button"
      >Raw</button>
      <button
        class="segment" class:active={mode === 'graded'}
        onclick={() => { mode = 'graded'; }}
        type="button"
      >Graded</button>
    </div>
  </div>

  <!-- Filter chips -->
  <div class="filter-row">
    {#if mode === 'raw'}
      {#each rawPrices as rp}
        <button
          class="filter-chip"
          class:active={selectedRaw.has(rp.condition)}
          onclick={() => toggleRawCondition(rp.condition)}
          type="button"
          style="--chip-color: {conditionColors[rp.condition] || '#9ca3af'}"
        >
          <span class="chip-dot"></span>
          {rp.condition}
        </button>
      {/each}
    {:else}
      <!-- Company select -->
      {#if gradedCompanies.length > 1}
        <div class="company-select">
          {#each gradedCompanies as company}
            <button
              class="filter-chip company-chip"
              class:active={selectedGradedCompany === company}
              onclick={() => { selectedGradedCompany = company; selectedGrades = new Set(); }}
              type="button"
            >{company}</button>
          {/each}
        </div>
        <span class="filter-sep"></span>
      {/if}
      {#each filteredGraded as gp}
        {@const key = gp.grade || gp.condition}
        <button
          class="filter-chip"
          class:active={selectedGrades.has(key)}
          onclick={() => toggleGrade(key)}
          type="button"
        >{key}</button>
      {/each}
    {/if}
  </div>

  <!-- Chart -->
  <div class="compare-chart">
    <canvas bind:this={chartCanvas}></canvas>
  </div>

  <!-- Legend -->
  <div class="compare-legend">
    {#if mode === 'raw'}
      {#each rawPrices as rp}
        {#if selectedRaw.has(rp.condition)}
          <div class="legend-item">
            <span class="legend-line" style="background-color: {conditionColors[rp.condition] || '#9ca3af'}"></span>
            <span class="legend-label">{rp.condition}</span>
            <span class="legend-price">{pricingStore.formatPrice(rp.market, rp.currency)}</span>
            {#if rp.trends?.days180}
              {@const pct = rp.trends.days180.percentChange}
              <span class="legend-change" class:up={pct > 0} class:down={pct < 0}>
                {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
              </span>
            {/if}
          </div>
        {/if}
      {/each}
    {:else}
      {#each filteredGraded as gp, i}
        {@const key = gp.grade || gp.condition}
        {#if selectedGrades.has(key)}
          {@const lumShades = companyLuminance[selectedGradedCompany] || ['#9ca3af']}
          <div class="legend-item">
            <span class="legend-line" style="background-color: {lumShades[i % lumShades.length]}"></span>
            <span class="legend-label">{gp.company} {key}</span>
            <span class="legend-price">{pricingStore.formatPrice(gp.market, gp.currency)}</span>
            {#if gp.trends?.days180}
              {@const pct = gp.trends.days180.percentChange}
              <span class="legend-change" class:up={pct > 0} class:down={pct < 0}>
                {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
              </span>
            {/if}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</div>

<style>
  .compare-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 0.5px solid var(--border-subtle);
  }

  .compare-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  .section-label-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .section-period {
    font-size: 10px;
    color: var(--text-dim);
  }

  .segment-control {
    display: flex;
    background-color: var(--surface-2);
    border: 0.5px solid var(--border-subtle);
    border-radius: var(--radius-badge);
    overflow: hidden;
  }

  .segment {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    background: none;
    border: none;
    padding: 3px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    border-radius: 0;
  }

  .segment:hover { background: none; color: var(--text-secondary); }
  .segment.active {
    background-color: var(--amber-dim);
    color: var(--amber);
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
    align-items: center;
  }

  .filter-chip {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-dim);
    background: none;
    border: 0.5px solid var(--border-subtle);
    border-radius: var(--radius-badge);
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .filter-chip:hover { border-color: rgba(255,255,255,0.1); background: none; }

  .filter-chip.active {
    border-color: var(--chip-color, var(--amber-border));
    color: var(--chip-color, var(--amber));
    background-color: rgba(255,255,255,0.03);
  }

  .chip-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--chip-color, var(--text-dim));
  }

  .company-select { display: flex; gap: 4px; }
  .company-chip { --chip-color: var(--amber); }
  .filter-sep { width: 1px; height: 14px; background-color: var(--border-subtle); margin: 0 4px; }

  .compare-chart {
    height: 200px;
    margin-bottom: 8px;
  }

  .compare-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }

  .legend-line {
    width: 16px;
    height: 2px;
    border-radius: 1px;
    flex-shrink: 0;
  }

  .legend-label { color: var(--text-muted); }
  .legend-price { color: var(--text-secondary); font-weight: 500; }
  .legend-change { font-size: 10px; font-weight: 500; }
  .legend-change.up { color: var(--price-green); }
  .legend-change.down { color: var(--price-red); }

  @media (max-width: 768px) {
    .compare-chart { height: 160px; }
  }
</style>
