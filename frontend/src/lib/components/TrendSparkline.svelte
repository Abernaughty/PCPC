<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    /** Array of price points [oldest...newest], minimum 2 */
    points: number[];
    /** Height in px */
    height?: number;
    /** Line color */
    color?: string;
    /** Line width */
    lineWidth?: number;
  }

  let {
    points,
    height = 24,
    color = 'var(--price-green)',
    lineWidth = 1.5,
  }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state(undefined);
  let container: HTMLDivElement | undefined = $state(undefined);
  let canvasWidth = $state(80);
  let ro: ResizeObserver | undefined;

  // Resolve CSS variable to actual color
  function resolveColor(c: string): string {
    if (c.startsWith('var(')) {
      const varName = c.slice(4, -1).trim();
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#9ca3af';
    }
    return c;
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

    const pad = 2;
    const drawW = w - pad * 2;
    const drawH = h - pad * 2;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    ctx.beginPath();
    ctx.strokeStyle = resolveColor(color);
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < points.length; i++) {
      const x = pad + (i / (points.length - 1)) * drawW;
      const y = pad + drawH - ((points[i] - min) / range) * drawH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
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
      // Initial measure
      canvasWidth = container.clientWidth || 80;
    }
    draw();
  });

  $effect(() => {
    // Redraw when points, color, or width changes
    if (points && canvas) draw();
    void canvasWidth;
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
  ></canvas>
</div>

<style>
  .sparkline-container {
    width: 100%;
    overflow: hidden;
  }

  .sparkline {
    display: block;
  }
</style>
