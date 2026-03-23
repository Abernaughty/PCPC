<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { SearchForm, CardVariantSelector, RecentLookups, CardResultsPanel, SkeletonLoader } from '$lib/components';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  const TITLE_PCPC = 'PCPC';
  const TITLE_SEP = ' / ';
  const TITLE_SUB = 'pokemon card price checker';
  const ICON_WARN = '\u26a0\ufe0f';
  const ICON_CLOSE = '\u2715';
  const ICON_BACK = '\u2190';

  let cardVariants = $state<any[]>([]);
  let showVariantSelector = $state(false);
  let selectedVariant = $state<any>(null);
  let isDeepLinkLoading = $state(true);
  let deepLinkError = $state<string | null>(null);
  let recentLookupsRef: ReturnType<typeof RecentLookups> | undefined = $state(undefined);

  let cardReady = $derived(!!setsStore.selectedSet && !!cardsStore.selectedCard);

  let pageTitle = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (card && set) return `${card.name} - ${set.name} | PCPC`;
    return 'Loading... | PCPC';
  });

  function handlePriceFetched(info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string; language: string }) {
    recentLookupsRef?.addLookup(info);
    goto(`/cards/${info.setId}/${info.cardId}`, { replaceState: true });
  }

  function handleVariantSelect(variant: any) { selectedVariant = variant; }
  function handleVariantConfirm(variant: any) { selectedVariant = variant; showVariantSelector = false; }
  function closeVariantSelector() { showVariantSelector = false; }
  function handleBack() { goto('/'); }

  /**
   * Find a set by ID, auto-switching language filter if needed.
   */
  async function findSetById(setId: string): Promise<import('$lib/types').PokemonSet | null> {
    let target = setsStore.availableSets.find((s) => s.id === setId) ?? null;
    if (target) return target;

    for (const group of setsStore.groupedSetsForDropdown) {
      if (group.type === 'group') {
        const found = group.items.find((s) => s.id === setId);
        if (found) return found;
      }
    }

    // Not found \u2014 likely a language filter mismatch. Switch to 'both' and retry.
    const isJpSet = setId.endsWith('_ja') || setId.includes('_ja_') || setId.includes('_ja-');
    const currentLang = setsStore.language;

    if ((isJpSet && currentLang === 'en') || (!isJpSet && currentLang === 'jp')) {
      await setsStore.setLanguage('both');

      target = setsStore.availableSets.find((s) => s.id === setId) ?? null;
      if (target) return target;

      for (const group of setsStore.groupedSetsForDropdown) {
        if (group.type === 'group') {
          const found = group.items.find((s) => s.id === setId);
          if (found) return found;
        }
      }
    }

    return null;
  }

  onMount(async () => {
    const setId = $page.params.set_id;
    const cardId = $page.params.card_id;
    if (!setId || !cardId) { deepLinkError = 'Invalid card URL.'; isDeepLinkLoading = false; return; }
    try {
      if (setsStore.availableSets.length === 0) await setsStore.loadSets();

      const targetSet = await findSetById(setId);
      if (!targetSet) { deepLinkError = `Set "${setId}" not found.`; isDeepLinkLoading = false; return; }

      await setsStore.selectSet(targetSet);
      const targetCard = cardsStore.cardsInSet.find((c) => c.id === cardId) ?? null;
      if (!targetCard) { deepLinkError = `Card "${cardId}" not found in ${targetSet.name}.`; isDeepLinkLoading = false; return; }
      cardsStore.selectCard(targetCard);
      const result = await pricingStore.fetchCardPrice(setId, cardId);
      if (result) {
        const imgUrl = targetCard.images?.[0]?.small ?? null;
        recentLookupsRef?.addLookup({
          setId,
          cardId,
          name: targetCard.name,
          imageUrl: imgUrl,
          setName: targetSet.name,
          language: setsStore.language,
        });
      }
    } catch (err) { const msg = err instanceof Error ? err.message : 'Unknown error'; deepLinkError = `Failed to load card: ${msg}`; }
    finally { isDeepLinkLoading = false; }
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="Check Pok\u00e9mon card prices and market data" />
</svelte:head>

<div class="pcpc-app">
  <header class="header">
    <div class="header-content">
      <div class="header-left">
        <button class="back-btn" onclick={handleBack} aria-label="Back to search" type="button">{ICON_BACK}</button>
        <h1 class="app-title"><span class="title-pcpc">{TITLE_PCPC}</span><span class="title-sep">{TITLE_SEP}</span><span class="title-sub">{TITLE_SUB}</span></h1>
      </div>
    </div>
  </header>

  <main class="main-content">
    <SearchForm onpricefetched={handlePriceFetched} />
    <RecentLookups bind:this={recentLookupsRef} />

    {#if uiStore.error}
      <div class="error-message"><span class="error-icon">{ICON_WARN}</span><span class="error-text">{uiStore.error}</span><button class="error-close" onclick={() => uiStore.clearError()} aria-label="Dismiss error" type="button">{ICON_CLOSE}</button></div>
    {/if}

    {#if deepLinkError}
      <div class="error-message"><span class="error-icon">{ICON_WARN}</span><span class="error-text">{deepLinkError}</span><button class="back-link" onclick={handleBack} type="button">Back to search</button></div>
    {/if}

    {#if isDeepLinkLoading && !cardReady}
      <div class="loading-container"><SkeletonLoader variant="pricing" /></div>
    {/if}

    {#if cardReady}
      <CardResultsPanel card={cardsStore.selectedCard} set={setsStore.selectedSet} isLoading={isDeepLinkLoading} />
    {/if}
  </main>

  <CardVariantSelector variants={cardVariants} isVisible={showVariantSelector} onselect={handleVariantSelect} onconfirm={handleVariantConfirm} onclose={closeVariantSelector} />
</div>

<style>
  .pcpc-app { display: flex; flex-direction: column; min-height: 100vh; background-color: var(--bg-primary); color: var(--text-primary); position: relative; z-index: 1; }
  .header { background-color: var(--color-header-bg); color: var(--text-inverse); padding: 16px 24px; border-bottom: 0.5px solid var(--border-subtle); }
  .header-content { max-width: var(--content-max-width, 1400px); margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
  .header-left { display: flex; align-items: center; gap: 12px; }
  .back-btn { background: none; border: 0.5px solid var(--border-subtle); color: var(--text-muted); padding: 4px 10px; border-radius: var(--radius-badge); font-size: 14px; cursor: pointer; transition: all 0.15s ease; line-height: 1; }
  .back-btn:hover { border-color: var(--amber-border); color: var(--amber); background: none; }
  .app-title { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.4px; line-height: 1.2; }
  .title-pcpc { color: var(--text-primary); }
  .title-sep { color: var(--text-dim); }
  .title-sub { color: var(--text-muted); font-weight: 400; }
  .main-content { flex: 1; max-width: var(--content-max-width, 1400px); margin: 0 auto; width: 100%; padding: 24px; }
  .error-message { background-color: rgba(238, 21, 21, 0.1); border: 0.5px solid var(--color-error-text); border-radius: var(--radius-input); padding: 10px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
  .error-icon { font-size: 1.1em; flex-shrink: 0; }
  .error-text { color: var(--color-error-text); flex: 1; font-size: var(--fs-body); }
  .error-close { background-color: transparent; border: none; color: var(--color-error-text); cursor: pointer; padding: 0; font-size: 1.1em; flex-shrink: 0; transition: opacity 0.15s ease; }
  .error-close:hover { opacity: 0.7; background: none; }
  .back-link { background: none; border: 0.5px solid var(--color-error-text); color: var(--color-error-text); padding: 4px 10px; border-radius: var(--radius-badge); cursor: pointer; font-size: var(--fs-badge); white-space: nowrap; flex-shrink: 0; transition: opacity 0.15s ease; }
  .back-link:hover { opacity: 0.7; background: none; }
  .loading-container { background-color: var(--bg-container); border: 0.5px solid var(--border-subtle); border-radius: var(--radius-card); padding: 24px; box-shadow: var(--shadow-sm); }

  @media (max-width: 768px) { .header { padding: 12px 16px; } .app-title { font-size: 15px; } .main-content { padding: 16px; } .loading-container { padding: 16px; } }
  @media (max-width: 480px) { .header { padding: 10px 12px; } .app-title { font-size: 14px; } .main-content { padding: 12px; } .loading-container { padding: 12px; border-radius: 8px; } }
</style>
