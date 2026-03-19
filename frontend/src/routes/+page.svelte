<script lang="ts">
  import { onMount } from 'svelte';
  import { SearchForm, CardDetailPanel, PricingPanel, CardVariantSelector } from '$lib/components';
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
  const ICON_MOON = '\u{1F319}';
  const ICON_SUN = '\u2600\uFE0F';
  const ICON_WARN = '\u26A0\uFE0F';
  const ICON_CLOSE = '\u2715';

  // Local state
  let cardVariants = $state<any[]>([]);
  let showVariantSelector = $state(false);
  let selectedVariant = $state<any>(null);

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
    <SearchForm />

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

    <!-- Results Section -->
    {#if setsStore.selectedSet && cardsStore.selectedCard}
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
