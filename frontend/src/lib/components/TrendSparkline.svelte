<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    /** Array of price points [oldest...newest], minimum 2 */
    points: number[];
    /** Labels for each point (shown in tooltip) */
    labels?: string[];
    /** Height in px */
    height?: number;
    /** Line color */
    color?: string;
    /** Line width */
    lineWidth?: number;
    /** Currency for formatting */
    currency?: string;
  }

  let {
    points,
    labels = [],
    height = 24,
    color = 'var(--price-green)',
    lineWidth = 1.5,
    currency = 'USD',
  }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state(undefined);
  let container: HTMLDivElement | undefined = $state(undefined);
  let canvasWidth = $state(80);
  let hoverIndex = $state<number | null>(null);
  let ro: ResizeObserver | undefined;

  const PAD = 2;
  // Extra top padding when hover is enabled to fit the tooltip
  const HOVER_TOP_PAD = 14;

  function resolveColor(c: string): string {
    if (c.startsWith('var(')) {
      const varName = c.slice(4, -1).trim();
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#9ca3af';
    }
    return c;
  }

  function formatPrice(val: number): string {
    if (currency === 'JPY') return `\u00A5${Math.round(val).toLocaleString()}`;
    return `$${val.toFixed(2)}`;
  }

  function getPointCoords(i: number, w: number, h: number, min: number, range: number): { x: number; y: number } {
    const drawW = w - PAD * 2;
    const drawH = h - PAD - HOVER_TOP_PAD;
    const x = PAD + (i / (points.length - 1)) * drawW;
    const y = HOVER_TOP_PAD + drawH - ((points[i] - min) / range) * drawH;
    return { x, y };
  }

  function draw() {
    if (!canvas || !points || points.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvasWidth;
    const h = height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const resolved = resolveColor(color);

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = resolved;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < points.length; i++) {
      const { x, y } = getPointCoords(i, w, h, min, range);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw hover state
    if (hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length) {
      const { x, y } = getPointCoords(hoverIndex, w, h, min, range);

      // Dot
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = resolved;
      ctx.fill();

      // Outer ring
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.strokeStyle = resolved;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Tooltip text
      const priceText = formatPrice(points[hoverIndex]);
      const labelText = labels[hoverIndex] ?? '';
      const tooltip = labelText ? `${labelText}: ${priceText}` : priceText;

      ctx.font = '500 9px Geist, -apple-system, sans-serif';
      const textW = ctx.measureText(tooltip).width;
      const tipW = textW + 8;
      const tipH = 14;
      let tipX = x - tipW / 2;
      // Clamp to canvas bounds
      if (tipX < 1) tipX = 1;
      if (tipX + tipW > w - 1) tipX = w - 1 - tipW;
      const tipY = y - 18;

      // Background pill
      ctx.fillStyle = 'rgba(13, 15, 20, 0.92)';
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 3);
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.roundRect(tipX, tipY, tipW, tipH, 3);
      ctx.stroke();

      // Text
      ctx.fillStyle = '#e8eaef';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tooltip, tipX + tipW / 2, tipY + tipH / 2);
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas || !points || points.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const w = canvasWidth;
    const drawW = w - PAD * 2;

    // Find nearest point
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const px = PAD + (i / (points.length - 1)) * drawW;
      const dist = Math.abs(mx - px);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    // Only show hover if reasonably close
    if (closestDist < drawW / (points.length - 1)) {
      if (hoverIndex !== closest) {
        hoverIndex = closest;
      }
    } else {
      hoverIndex = null;
    }
  }

  function handleMouseLeave() {
    hoverIndex = null;
  }

  onMount(() => {
    if (container) {
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0 && Math.abs(w - canvasWidth) > 1) {
            canvasWidth = w;
          }
        }
      });
      ro.observe(container);
      canvasWidth = container.clientWidth || 80;
    }
    draw();
  });

  $effect(() => {
    if (points && canvas) draw();
    void canvasWidth;
    void hoverIndex;
  });

  onDestroy(() => {
    ro?.disconnect();
  });
</script>

<div class="sparkline-container" bind:this={container} style="height: {height}px;">
  <canvas
    bind:this={canvas}
    class="sparkline"
    style="width: {canvasWidth}px; height: {height}px;"
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
  ></canvas>
</div>

<style>
  .sparkline-container {
    width: 100%;
    overflow: hidden;
  }

  .sparkline {
    display: block;
    cursor: crosshair;
  }
</style>
