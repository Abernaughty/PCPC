<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { SearchForm, CardDetailPanel, PricingPanel, CardVariantSelector, RecentLookups, SkeletonLoader } from '$lib/components';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  // String constants — kept in JS to avoid encoding issues when files
  // are pushed through the GitHub API (which can mangle UTF-8 in HTML).
  const APP_TITLE = 'Pok\u00e9mon Card Price Checker';
  const PAGE_TITLE = 'PCPC | Pok\u00e9mon Card Price Checker';
  const META_DESC = 'Check Pok\u00e9mon card prices and market data';
  const ICON_MOON = '\ud83c\udf19';
  const ICON_SUN = '\u2600\ufe0f';
  const ICON_WARN = '\u26a0\ufe0f';
  const ICON_CLOSE = '\u2715';

  // Local state
  let cardVariants = $state<any[]>([]);
  let showVariantSelector = $state(false);
  let selectedVariant = $state<any>(null);

  // Reference to RecentLookups component for imperative addLookup calls
  let recentLookupsRef: ReturnType<typeof RecentLookups> | undefined = $state(undefined);

  // Derive the current pricing result from the store
  let currentPricing = $derived.by(() => {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (!card || !set) return null;
    const key = `${set.id}_${card.id}`;
    return pricingStore.priceData[key] || null;
  });

  // Derive the best card image URL
  let cardImageUrl = $derived.by(() => {
    const card = cardsStore.selectedCard;
    if (!card?.images || card.images.length === 0) return null;
    const img = card.images[0];
    return img.medium || img.small || img.large || null;
  });

  /**
   * Record a recent lookup imperatively — called by SearchForm's
   * onpricefetched callback AFTER pricing has resolved.
   * This avoids the $effect → $state mutation infinite loop
   * that occurred when using a reactive $effect to watch pricing.
   *
   * Also updates the URL to the deep link path.
   */
  function handlePriceFetched(info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string }) {
    recentLookupsRef?.addLookup(info);
    // Push deep link URL (replaceState so back button goes to pre-search state)
    goto(`/cards/${info.setId}/${info.cardId}`, { replaceState: true });
  }

  // Variant handlers
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

  onMount(() => {
    setsStore.loadSets();
  });
</script>

<svelte:head>
  <title>{PAGE_TITLE}</title>
  <meta name="description" content={META_DESC} />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="pcpc-app">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <h1 class="app-title">{APP_TITLE}</h1>
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

  <!-- Main Content -->
  <main class="main-content">
    <!-- Search Form -->
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

    {#if !uiStore.isOnline}
      <div class="offline-message">
        You are currently offline. Some features may be limited.
      </div>
    {/if}

    <!-- Pricing Loading Skeleton -->
    {#if pricingStore.isLoading}
      <div class="results-container">
        <SkeletonLoader variant="pricing" />
      </div>
    {/if}

    <!-- Results Section -->
    {#if !pricingStore.isLoading && setsStore.selectedSet && cardsStore.selectedCard}
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

  <!-- Card Variant Selector Modal -->
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
    transition: all var(--transition-speed) ease;
    flex-shrink: 0;
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
    transition: opacity var(--transition-speed) ease;
  }

  .error-close:hover {
    opacity: 0.7;
  }

  .offline-message {
    background-color: rgba(255, 165, 0, 0.1);
    border: 1px solid var(--color-pokemon-red);
    border-radius: 4px;
    padding: 1em;
    margin-bottom: 1.5em;
    color: var(--text-primary);
    text-align: center;
  }

  .results-container {
    background-color: var(--bg-container);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 2em;
    box-shadow: 0 2px 8px var(--shadow-light);
  }

  @media (max-width: 768px) {
    .header {
      padding: 1em;
    }

    .header-content {
      flex-direction: row;
      gap: 0.75em;
    }

    .app-title {
      font-size: 1.3em;
    }

    .main-content {
      padding: 1em;
    }

    .results-container {
      padding: 1em;
    }
  }

  @media (max-width: 480px) {
    .header {
      padding: 0.75em;
    }

    .app-title {
      font-size: 1.1em;
    }

    .theme-toggle {
      padding: 0.4em 0.7em;
      font-size: 1em;
    }

    .main-content {
      padding: 0.75em;
    }

    .results-container {
      padding: 0.75em;
      border-radius: 6px;
    }

    .error-message {
      padding: 0.75em;
      gap: 0.5em;
      font-size: 12px;
    }
  }
</style>
