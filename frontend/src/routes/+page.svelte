<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { SearchForm, CardVariantSelector, RecentLookups, CardResultsPanel, SkeletonLoader } from '$lib/components';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

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
  let recentLookupsRef: ReturnType<typeof RecentLookups> | undefined = $state(undefined);

  let currentPricing = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (!card || !set) return null;
    return pricingStore.priceData[`${set.id}_${card.id}`] || null;
  });

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

  function handlePriceFetched(info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string; language: string }) {
    recentLookupsRef?.addLookup(info);
    if (browser) {
      history.replaceState(history.state, '', `/cards/${info.setId}/${info.cardId}`);
    }
  }

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
      <CardResultsPanel card={cardsStore.selectedCard} set={setsStore.selectedSet} />
    {/if}
  </main>

  <CardVariantSelector variants={cardVariants} isVisible={showVariantSelector} onselect={handleVariantSelect} onconfirm={handleVariantConfirm} onclose={closeVariantSelector} />
</div>

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

  @media (max-width: 768px) {
    .header { padding: 12px 16px; }
    .app-title { font-size: 15px; }
    .main-content { padding: 16px; }
  }

  @media (max-width: 480px) {
    .header { padding: 10px 12px; }
    .app-title { font-size: 14px; }
    .main-content { padding: 12px; }
  }
</style>
