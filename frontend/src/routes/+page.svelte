<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { SearchForm, CardDetailPanel, PricingPanel, CardVariantSelector, RecentLookups, SkeletonLoader } from '$lib/components';
  import ImageLightbox from '$lib/components/ImageLightbox.svelte';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';
  import { getRarityColor, isGradientRarity } from '$lib/utils/rarityMap';

  const PAGE_TITLE = 'PCPC | Pok\u00e9mon Card Price Checker';
  const META_DESC = 'Check Pok\u00e9mon card prices and market data';
  const TITLE_PCPC = 'PCPC';
  const TITLE_SEP = ' / ';
  const TITLE_SUB = 'pokemon card price checker';
  const ICON_WARN = '\u26a0\ufe0f';
  const ICON_CLOSE = '\u2715';

  let cardVariants = $state<any[]>([]);
  let showVariantSelector = $state(false);
  let selectedVariant = $state<any>(null);
  let lightboxUrl = $state<string | null>(null);
  let recentLookupsRef: ReturnType<typeof RecentLookups> | undefined = $state(undefined);

  let currentPricing = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (!card || !set) return null;
    return pricingStore.priceData[`${set.id}_${card.id}`] || null;
  });

  let cardImageUrl = $derived.by(() => {
    const card = cardsStore.selectedCard;
    if (!card?.images || card.images.length === 0) return null;
    const img = card.images[0];
    return img.medium || img.small || img.large || null;
  });

  let cardName = $derived(cardsStore.selectedCard?.name ?? '');

  // Derive page title from selected card
  let pageTitle = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (card && set && currentPricing) {
      return `${card.name} - ${set.name} | PCPC`;
    }
    return PAGE_TITLE;
  });

  // Show results when pricing is available for the selected card
  let showResults = $derived(
    !!setsStore.selectedSet && !!cardsStore.selectedCard && (!!currentPricing || pricingStore.isLoading)
  );

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
  let rarityColor = $derived(getRarityColor(cardsStore.selectedCard?.rarity));
  let rarityGradient = $derived(isGradientRarity(cardsStore.selectedCard?.rarity));

  function handlePriceFetched(info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string; language: string }) {
    recentLookupsRef?.addLookup(info);
    // Update URL without triggering SvelteKit navigation (avoids re-render flash)
    if (browser) {
      history.replaceState(history.state, '', `/cards/${info.setId}/${info.cardId}`);
    }
  }

  function handleLightbox(url: string) { lightboxUrl = url; }
  function closeLightbox() { lightboxUrl = null; }
  function handleVariantSelect(variant: any) { selectedVariant = variant; }
  function handleVariantConfirm(variant: any) { selectedVariant = variant; showVariantSelector = false; }
  function closeVariantSelector() { showVariantSelector = false; }

  onMount(() => { setsStore.loadSets(); });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={META_DESC} />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="pcpc-app">
  <header class="header">
    <div class="header-content">
      <h1 class="app-title">
        <span class="title-pcpc">{TITLE_PCPC}</span><span class="title-sep">{TITLE_SEP}</span><span class="title-sub">{TITLE_SUB}</span>
      </h1>
    </div>
  </header>

  <main class="main-content">
    <SearchForm onpricefetched={handlePriceFetched} />
    <RecentLookups bind:this={recentLookupsRef} />

    {#if uiStore.error}
      <div class="error-message">
        <span class="error-icon">{ICON_WARN}</span>
        <span class="error-text">{uiStore.error}</span>
        <button class="error-close" onclick={() => uiStore.clearError()} aria-label="Dismiss error" type="button">{ICON_CLOSE}</button>
      </div>
    {/if}

    {#if !uiStore.isOnline}
      <div class="offline-message">You are currently offline. Some features may be limited.</div>
    {/if}

    {#if showResults}
      {@const card = cardsStore.selectedCard}
      {@const set = setsStore.selectedSet}
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
            <CardDetailPanel card={card} set={set} imageUrl={cardImageUrl} onlightbox={handleLightbox} />
          </div>
          <div class="results-main">
            {#if pricingStore.isLoading}
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
    {/if}
  </main>

  <CardVariantSelector variants={cardVariants} isVisible={showVariantSelector} onselect={handleVariantSelect} onconfirm={handleVariantConfirm} onclose={closeVariantSelector} />
</div>

{#if lightboxUrl}
  <ImageLightbox imageUrl={lightboxUrl} altText="{cardName} - full size" onclose={closeLightbox} />
{/if}

<style>
  .pcpc-app { display: flex; flex-direction: column; min-height: 100vh; background-color: var(--bg-primary); color: var(--text-primary); position: relative; z-index: 1; }
  .header { background-color: var(--color-header-bg); color: var(--text-inverse); padding: 16px 24px; border-bottom: 0.5px solid var(--border-subtle); }
  .header-content { max-width: var(--content-max-width, 1400px); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
  .app-title { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.4px; line-height: 1.2; }
  .title-pcpc { color: var(--text-primary); }
  .title-sep { color: var(--text-dim); }
  .title-sub { color: var(--text-muted); font-weight: 400; }
  .main-content { flex: 1; max-width: var(--content-max-width, 1400px); margin: 0 auto; width: 100%; padding: 24px; }
  .error-message { background-color: rgba(238, 21, 21, 0.1); border: 0.5px solid var(--color-error-text); border-radius: var(--radius-input); padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
  .error-icon { font-size: 1.1em; flex-shrink: 0; }
  .error-text { color: var(--color-error-text); flex: 1; font-size: var(--fs-body); }
  .error-close { background-color: transparent; border: none; color: var(--color-error-text); cursor: pointer; padding: 0; font-size: 1.1em; flex-shrink: 0; transition: opacity var(--transition-speed) ease; }
  .error-close:hover { opacity: 0.7; background: none; }
  .offline-message { background-color: rgba(255, 165, 0, 0.1); border: 0.5px solid var(--color-pokemon-red); border-radius: var(--radius-input); padding: 10px 14px; margin-bottom: 16px; color: var(--text-primary); text-align: center; font-size: var(--fs-body); }
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
    .header { padding: 12px 16px; }
    .app-title { font-size: 15px; }
    .main-content { padding: 16px; }
    .results-container { padding: 16px; }
    .results-header { flex-direction: column; gap: 6px; align-items: center; text-align: center; }
    .header-meta { justify-content: center; }
    .results-layout { flex-direction: column; align-items: center; }
    .results-sidebar { position: static; }
  }

  @media (max-width: 480px) {
    .header { padding: 10px 12px; }
    .app-title { font-size: 14px; }
    .main-content { padding: 12px; }
    .results-container { padding: 12px; border-radius: 8px; }
  }
</style>
