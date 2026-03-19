<script lang="ts">
  import type { CardVariant } from '$lib/types';

  interface Props {
    variants: CardVariant[];
    selected: string;
    onselect: (variantName: string) => void;
  }

  let { variants, selected, onselect }: Props = $props();

  // Track whether the pill bar overflows for the fade hint
  let scrollContainer: HTMLDivElement | undefined = $state(undefined);
  let showFadeRight = $state(false);
  let showFadeLeft = $state(false);

  function checkOverflow() {
    if (!scrollContainer) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer;
    showFadeRight = scrollLeft + clientWidth < scrollWidth - 2;
    showFadeLeft = scrollLeft > 2;
  }

  $effect(() => {
    if (!scrollContainer) return;
    checkOverflow();
    // Re-check on resize
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  });

  function hasPrice(variant: CardVariant): boolean {
    return variant.prices.length > 0;
  }
</script>

<div class="variant-pills-wrapper">
  {#if showFadeLeft}
    <div class="fade-hint fade-left"></div>
  {/if}

  <div
    class="variant-pills"
    bind:this={scrollContainer}
    onscroll={checkOverflow}
    role="tablist"
    aria-label="Card variants"
  >
    {#each variants as variant (variant.name)}
      {@const active = variant.name === selected}
      {@const available = hasPrice(variant)}
      <button
        class="variant-pill"
        class:active
        role="tab"
        aria-selected={active}
        onclick={() => onselect(variant.name)}
        type="button"
      >
        <span class="avail-dot" class:available></span>
        <span class="pill-label">{variant.name}</span>
      </button>
    {/each}
  </div>

  {#if showFadeRight}
    <div class="fade-hint fade-right"></div>
  {/if}
</div>

<style>
  .variant-pills-wrapper {
    position: relative;
    margin-bottom: 16px;
  }

  .variant-pills {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    padding: 2px 0;
  }

  .variant-pills::-webkit-scrollbar {
    display: none;
  }

  .variant-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--border-subtle);
    background-color: transparent;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .variant-pill:hover {
    background-color: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .variant-pill.active {
    background-color: rgba(232, 69, 60, 0.08);
    border-color: var(--accent-red);
    color: var(--text-primary);
  }

  .avail-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: var(--text-dim);
    flex-shrink: 0;
  }

  .avail-dot.available {
    background-color: var(--price-green);
  }

  .pill-label {
    line-height: 1;
  }

  /* Fade hints for overflow */
  .fade-hint {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 32px;
    pointer-events: none;
    z-index: 1;
  }

  .fade-right {
    right: 0;
    background: linear-gradient(
      to right,
      transparent,
      var(--surface-1)
    );
  }

  .fade-left {
    left: 0;
    background: linear-gradient(
      to left,
      transparent,
      var(--surface-1)
    );
  }
</style>
