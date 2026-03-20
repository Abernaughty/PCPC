<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    /** Array of price points [oldest...newest], minimum 2 */
    points: number[];
    /** Width in px */
    width?: number;
    /** Height in px */
    height?: number;
    /** Line color */
    color?: string;
    /** Line width */
    lineWidth?: number;
  }

  let {
    points,
    width = 60,
    height = 24,
    color = 'var(--price-green)',
    lineWidth = 1.5,
  }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state(undefined);

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

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const pad = 2;
    const drawW = width - pad * 2;
    const drawH = height - pad * 2;

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
    draw();
  });

  $effect(() => {
    // Redraw when points or color changes
    if (points && canvas) draw();
  });
</script>

<canvas
  bind:this={canvas}
  class="sparkline"
  style="width: {width}px; height: {height}px;"
></canvas>

<style>
  .sparkline {
    display: block;
    flex-shrink: 0;
  }
</style>
