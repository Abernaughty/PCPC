<script lang="ts">
  /**
   * SkeletonLoader — animated shimmer placeholders for loading states.
   *
   * Variants:
   *   'set-rows'  — 3 rows matching set dropdown item layout
   *   'card-rows' — 5 rows matching card dropdown item layout
   *   'pricing'   — hero price block + table rows
   *   'inline'    — single line shimmer (for inline use)
   */
  interface Props {
    variant: 'set-rows' | 'card-rows' | 'pricing' | 'inline';
  }

  let { variant }: Props = $props();
</script>

<div class="skeleton-container" aria-hidden="true">
  {#if variant === 'set-rows'}
    {#each { length: 3 } as _}
      <div class="skeleton-row set-row">
        <div class="shimmer skel-icon"></div>
        <div class="skel-text-group">
          <div class="shimmer skel-line skel-line-primary"></div>
          <div class="shimmer skel-line skel-line-secondary"></div>
        </div>
      </div>
    {/each}

  {:else if variant === 'card-rows'}
    {#each { length: 5 } as _}
      <div class="skeleton-row card-row">
        <div class="shimmer skel-thumb"></div>
        <div class="skel-text-group">
          <div class="shimmer skel-line skel-line-primary"></div>
          <div class="shimmer skel-line skel-line-short"></div>
        </div>
      </div>
    {/each}

  {:else if variant === 'pricing'}
    <div class="skeleton-pricing">
      <div class="shimmer skel-hero-block"></div>
      <div class="skel-table">
        {#each { length: 4 } as _}
          <div class="skeleton-row table-row">
            <div class="shimmer skel-line skel-line-cond"></div>
            <div class="shimmer skel-line skel-line-price"></div>
            <div class="shimmer skel-line skel-line-range"></div>
          </div>
        {/each}
      </div>
    </div>

  {:else if variant === 'inline'}
    <div class="shimmer skel-line skel-line-inline"></div>
  {/if}
</div>

<style>
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .skeleton-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
  }

  /* Shimmer animation */
  .shimmer {
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0%,
      rgba(255, 255, 255, 0.07) 50%,
      rgba(255, 255, 255, 0.03) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* Element shapes */
  .skel-icon {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .skel-thumb {
    width: 22px;
    height: 30px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .skel-text-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
  }

  .skel-line {
    height: 10px;
  }

  .skel-line-primary {
    width: 65%;
  }

  .skel-line-secondary {
    width: 45%;
    height: 8px;
  }

  .skel-line-short {
    width: 30%;
    height: 8px;
  }

  .skel-line-inline {
    width: 100%;
    height: 12px;
  }

  /* Pricing skeleton */
  .skeleton-pricing {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .skel-hero-block {
    width: 100%;
    height: 80px;
    border-radius: var(--radius-card, 10px);
  }

  .skel-table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .table-row {
    gap: 16px;
  }

  .skel-line-cond {
    width: 40px;
    flex-shrink: 0;
  }

  .skel-line-price {
    width: 70px;
    flex-shrink: 0;
  }

  .skel-line-range {
    width: 100px;
    flex-shrink: 0;
  }

  /* Set row layout */
  .set-row {
    padding: 6px 12px;
  }

  /* Card row layout */
  .card-row {
    padding: 4px 12px;
  }
</style>
