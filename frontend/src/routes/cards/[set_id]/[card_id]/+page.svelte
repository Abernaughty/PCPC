<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { SearchForm, CardDetailPanel, PricingPanel, CardVariantSelector, RecentLookups, SkeletonLoader } from '$lib/components';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  const APP_TITLE = 'Pok\u00e9mon Card Price Checker';
  const ICON_MOON = '\ud83c\udf19';
  const ICON_SUN = '\u2600\ufe0f';
  const ICON_WARN = '\u26a0\ufe0f';
  const ICON_CLOSE = '\u2715';
  const ICON_BACK = '\u2190';

  // Local state
  let cardVariants = $state<any[]>([]);
  let showVariantSelector = $state(false);
  let selectedVariant = $state<any>(null);
  let isDeepLinkLoading = $state(true);
  let deepLinkError = $state<string | null>(null);

  let recentLookupsRef: ReturnType<typeof RecentLookups> | undefined = $state(undefined);

  let currentPricing = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (!card || !set) return null;
    const key = `${set.id}_${card.id}`;
    return pricingStore.priceData[key] || null;
  });

  let cardImageUrl = $derived.by(() => {
    const card = cardsStore.selectedCard;
    if (!card?.images || card.images.length === 0) return null;
    const img = card.images[0];
    return img.medium || img.small || img.large || null;
  });

  let pageTitle = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (card && set) return `${card.name} - ${set.name} | PCPC`;
    return 'Loading... | PCPC';
  });

  function handlePriceFetched(info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string }) {
    recentLookupsRef?.addLookup(info);
    // Update URL when user fetches a new price from the search form
    goto(`/cards/${info.setId}/${info.cardId}`, { replaceState: true });
  }

  function handleVariantSelect(variant: any) {
    selectedVariant = variant;
  }

  function handleVariantConfirm(variant: any) {
    selectedVariant = variant;
    showVariantSelector = false;
  }

  function closeVariantSelector() {
    showVariantSelector = false;
  }

  function toggleTheme() {
    themeStore.toggle();
  }

  function handleBack() {
    goto('/');
  }

  onMount(async () => {
    const setId = $page.params.set_id;
    const cardId = $page.params.card_id;

    if (!setId || !cardId) {
      deepLinkError = 'Invalid card URL.';
      isDeepLinkLoading = false;
      return;
    }

    try {
      // 1. Ensure sets are loaded
      if (setsStore.availableSets.length === 0) {
        await setsStore.loadSets();
      }

      // 2. Find the target set
      let targetSet = setsStore.availableSets.find((s) => s.id === setId) ?? null;
      if (!targetSet) {
        // Also search within grouped sets
        for (const group of setsStore.groupedSetsForDropdown) {
          if (group.type === 'group') {
            const found = group.items.find((s) => s.id === setId);
            if (found) {
              targetSet = found;
              break;
            }
          }
        }
      }

      if (!targetSet) {
        deepLinkError = `Set "${setId}" not found.`;
        isDeepLinkLoading = false;
        return;
      }

      // 3. Select set (this loads cards)
      await setsStore.selectSet(targetSet);

      // 4. Find and select the card
      const targetCard = cardsStore.cardsInSet.find((c) => c.id === cardId) ?? null;
      if (!targetCard) {
        deepLinkError = `Card "${cardId}" not found in ${targetSet.name}.`;
        isDeepLinkLoading = false;
        return;
      }

      cardsStore.selectCard(targetCard);

      // 5. Fetch pricing
      const result = await pricingStore.fetchCardPrice(setId, cardId);

      // 6. Record as recent lookup
      if (result) {
        const imgUrl = targetCard.images?.[0]?.small ?? null;
        recentLookupsRef?.addLookup({
          setId,
          cardId,
          name: targetCard.name,
          imageUrl: imgUrl,
          setName: targetSet.name,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      deepLinkError = `Failed to load card: ${msg}`;
    } finally {
      isDeepLinkLoading = false;
    }
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content="Check Pok\u00e9mon card prices and market data" />
</svelte:head>

<div class="pcpc-app">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="header-left">
        <button
          class="back-btn"
          onclick={handleBack}
          aria-label="Back to search"
          type="button"
        >
          {ICON_BACK}
        </button>
        <h1 class="app-title">{APP_TITLE}</h1>
      </div>
      <button
        class="theme-toggle"
        onclick={toggleTheme}
        aria-label="Toggle dark mode"
        type="button"
      >
        {themeStore.current === 'light' ? ICON_MOON : ICON_SUN}
      </button>
    </div>
  </header>

  <main class="main-content">
    <!-- Search Form (persistent — allows new searches from deep link page) -->
    <SearchForm onpricefetched={handlePriceFetched} />

    <!-- Recent Lookups -->
    <RecentLookups bind:this={recentLookupsRef} />

    <!-- Error Display -->
    {#if uiStore.error}
      <div class="error-message">
        <span class="error-icon">{ICON_WARN}</span>
        <span class="error-text">{uiStore.error}</span>
        <button
          class="error-close"
          onclick={() => uiStore.clearError()}
          aria-label="Dismiss error"
          type="button"
        >
          {ICON_CLOSE}
        </button>
      </div>
    {/if}

    <!-- Deep Link Error -->
    {#if deepLinkError}
      <div class="error-message">
        <span class="error-icon">{ICON_WARN}</span>
        <span class="error-text">{deepLinkError}</span>
        <button
          class="back-link"
          onclick={handleBack}
          type="button"
        >
          Back to search
        </button>
      </div>
    {/if}

    <!-- Loading State -->
    {#if isDeepLinkLoading || pricingStore.isLoading}
      <div class="results-container">
        <SkeletonLoader variant="pricing" />
      </div>
    {/if}

    <!-- Results Section -->
    {#if !isDeepLinkLoading && !pricingStore.isLoading && setsStore.selectedSet && cardsStore.selectedCard}
      <div class="results-container">
        <CardDetailPanel
          card={cardsStore.selectedCard}
          set={setsStore.selectedSet}
          imageUrl={cardImageUrl}
        />

        {#if currentPricing}
          <PricingPanel pricing={currentPricing} />
        {/if}
      </div>
    {/if}
  </main>

  <CardVariantSelector
    variants={cardVariants}
    isVisible={showVariantSelector}
    onselect={handleVariantSelect}
    onconfirm={handleVariantConfirm}
    onclose={closeVariantSelector}
  />
</div>

<style>
  .pcpc-app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }

  .header {
    background-color: var(--color-header-bg);
    color: var(--text-inverse);
    padding: 1.5em;
    box-shadow: 0 2px 8px var(--shadow-medium);
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .back-btn {
    background: none;
    border: 2px solid var(--text-inverse);
    color: var(--text-inverse);
    padding: 0.3em 0.6em;
    border-radius: 4px;
    font-size: 1.1em;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 1;
  }

  .back-btn:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .app-title {
    margin: 0;
    font-size: 2em;
    font-weight: 700;
    color: var(--text-inverse);
  }

  .theme-toggle {
    background-color: transparent;
    border: 2px solid var(--text-inverse);
    color: var(--text-inverse);
    padding: 0.5em 1em;
    border-radius: 4px;
    font-size: 1.2em;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .theme-toggle:hover {
    background-color: rgba(255, 255, 255, 0.2);
  }

  .main-content {
    flex: 1;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    padding: 2em;
  }

  .error-message {
    background-color: rgba(238, 21, 21, 0.1);
    border: 1px solid var(--color-error-text);
    border-radius: 4px;
    padding: 1em;
    margin-bottom: 1.5em;
    display: flex;
    align-items: center;
    gap: 1em;
  }

  .error-icon {
    font-size: 1.3em;
    flex-shrink: 0;
  }

  .error-text {
    color: var(--color-error-text);
    flex: 1;
  }

  .error-close {
    background-color: transparent;
    border: none;
    color: var(--color-error-text);
    cursor: pointer;
    padding: 0;
    font-size: 1.2em;
    flex-shrink: 0;
    transition: opacity 0.15s ease;
  }

  .error-close:hover {
    opacity: 0.7;
  }

  .back-link {
    background: none;
    border: 1px solid var(--color-error-text);
    color: var(--color-error-text);
    padding: 0.4em 0.8em;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9em;
    white-space: nowrap;
    flex-shrink: 0;
    transition: opacity 0.15s ease;
  }

  .back-link:hover {
    opacity: 0.7;
  }

  .results-container {
    background-color: var(--bg-container);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 2em;
    box-shadow: 0 2px 8px var(--shadow-light);
  }

  @media (max-width: 768px) {
    .main-content {
      padding: 1em;
    }

    .results-container {
      padding: 1em;
    }

    .header-content {
      flex-direction: column;
      gap: 1em;
    }

    .app-title {
      font-size: 1.5em;
    }
  }
</style>
