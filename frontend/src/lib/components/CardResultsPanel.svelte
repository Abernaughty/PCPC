<script lang="ts">
  import { CardDetailPanel, PricingPanel, SkeletonLoader } from '$lib/components';
  import ImageLightbox from '$lib/components/ImageLightbox.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { getRarityColor, isGradientRarity } from '$lib/utils/rarityMap';
  import type { PokemonCard, PokemonSet } from '$lib/types';

  interface Props {
    card: PokemonCard | null;
    set: PokemonSet | null;
    /** Extra loading state (e.g. deep link resolution in progress) */
    isLoading?: boolean;
  }

  let { card, set, isLoading = false }: Props = $props();

  let lightboxUrl = $state<string | null>(null);

  // Pricing data for the selected card
  let currentPricing = $derived.by(() => {
    if (!card || !set) return null;
    return pricingStore.priceData[`${set.id}_${card.id}`] || null;
  });

  // Card image URL (prefer medium)
  let cardImageUrl = $derived.by(() => {
    if (!card?.images || card.images.length === 0) return null;
    const img = card.images[0];
    return img.medium || img.small || img.large || null;
  });

  // Card name for lightbox alt text
  let cardName = $derived(card?.name ?? '');

  // Header price badge: NM market price + 30d trend
  let headerPrice = $derived.by(() => {
    if (!currentPricing) return null;
    const price = pricingStore.getMarketPrice(currentPricing);
    if (!price) return null;
    const pct = price.trends?.days30?.percentChange ?? 0;
    return {
      value: price.market,
      currency: price.currency,
      direction: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : null,
      percent: Math.abs(pct),
    };
  });

  // Rarity styling for the header pill
  let rarityColor = $derived(getRarityColor(card?.rarity));
  let rarityGradient = $derived(isGradientRarity(card?.rarity));

  function handleLightbox(url: string) { lightboxUrl = url; }
  function closeLightbox() { lightboxUrl = null; }
</script>

<div class="results-container">
  <!-- Unified header row spanning both columns -->
  <div class="results-header">
    <h2 class="card-name">{card?.name}</h2>
    <div class="header-meta">
      {#if card?.rarity}
        <span class="header-chip header-chip-rarity">
          <span class="header-rarity-dot" class:gradient-dot={rarityGradient} style:background-color={rarityGradient ? undefined : rarityColor} style:background-image={rarityGradient ? 'linear-gradient(135deg, var(--rarity-sar-from), var(--rarity-sar-to))' : undefined}></span>
          <span class="header-chip-text" style:color={rarityGradient ? 'var(--rarity-sar-from)' : rarityColor}>{card.rarity}</span>
        </span>
      {/if}
      {#if set?.code}<span class="header-chip"><span class="header-chip-text">{set.code.toUpperCase()}</span></span>{/if}
      {#if card?.number || card?.cardNumber}<span class="header-chip"><span class="header-chip-text">#{card.number || card.cardNumber}</span></span>{/if}
      {#if headerPrice}
        <span class="header-price" class:price-up={headerPrice.direction === 'up'} class:price-down={headerPrice.direction === 'down'}>
          {pricingStore.formatPrice(headerPrice.value, headerPrice.currency)}
          {#if headerPrice.direction === 'up'}<span class="header-trend">&#x25B2;</span>{:else if headerPrice.direction === 'down'}<span class="header-trend">&#x25BC;</span>{:else}<span class="header-trend-flat">&#x2013;</span>{/if}
        </span>
      {:else if currentPricing}
        <span class="header-price no-price">&#x2013;</span>
      {/if}
    </div>
  </div>

  <!-- Two-column layout: image + pricing -->
  <div class="results-layout">
    <div class="results-sidebar">
      <CardDetailPanel {card} {set} imageUrl={cardImageUrl} onlightbox={handleLightbox} />
    </div>
    <div class="results-main">
      {#if isLoading || pricingStore.isLoading}
        <SkeletonLoader variant="pricing" />
      {:else if currentPricing}
        <PricingPanel pricing={currentPricing} />
      {:else if pricingStore.pricingError}
        <div class="pricing-message">
          <p class="pricing-message-text">{pricingStore.pricingError}</p>
        </div>
      {:else}
        <div class="pricing-message">
          <p class="pricing-message-text">No pricing data available for this card. It may be too new or not widely traded.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if lightboxUrl}
  <ImageLightbox imageUrl={lightboxUrl} altText="{cardName} - full size" onclose={closeLightbox} />
{/if}

<style>
  .results-container { background-color: var(--bg-container); border: 0.5px solid var(--border-subtle); border-radius: var(--radius-card); padding: 24px; box-shadow: var(--shadow-sm); position: relative; }
  .results-container::before { content: ''; position: absolute; top: 0; left: 20px; right: 20px; height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08) 30%, rgba(255, 255, 255, 0.12) 50%, rgba(255, 255, 255, 0.08) 70%, transparent); border-radius: 1px; pointer-events: none; }

  /* Unified header row */
  .results-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .card-name { margin: 0; font-size: var(--fs-card-name); font-weight: 500; letter-spacing: -0.3px; color: var(--text-primary); }
  .header-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .header-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border-radius: var(--radius-badge); border: 0.5px solid var(--amber-border); background-color: var(--amber-dim); }
  .header-chip-rarity { }
  .header-rarity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .gradient-dot { background-color: transparent; }
  .header-chip-text { font-size: var(--fs-micro); font-weight: 500; letter-spacing: 0.3px; color: var(--amber); }
  .header-price { font-size: var(--fs-secondary); font-weight: 500; font-variant-numeric: tabular-nums; color: var(--price-green); margin-left: 4px; }
  .header-price.price-up { color: var(--price-green); }
  .header-price.price-down { color: var(--price-red); }
  .header-price.no-price { color: var(--text-faint); }
  .header-trend { font-size: 9px; margin-left: 2px; }
  .header-trend-flat { font-size: 10px; margin-left: 2px; color: var(--text-dim); }

  /* Two-column layout */
  .results-layout { display: flex; gap: var(--layout-gap, 24px); align-items: flex-start; }
  .results-sidebar { flex-shrink: 0; position: sticky; top: 24px; align-self: flex-start; }
  .results-main { flex: 1; min-width: 0; overflow: visible; position: relative; }
  .pricing-message { padding: 24px; text-align: center; }
  .pricing-message-text { color: var(--text-muted); font-size: var(--fs-body); margin: 0; }

  @media (max-width: 768px) {
    .results-container { padding: 16px; }
    .results-header { flex-direction: column; gap: 6px; align-items: center; text-align: center; }
    .header-meta { justify-content: center; }
    .results-layout { flex-direction: column; align-items: center; }
    .results-sidebar { position: static; }
  }

  @media (max-width: 480px) {
    .results-container { padding: 12px; border-radius: 8px; }
  }
</style>
