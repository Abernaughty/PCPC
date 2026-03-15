<script lang="ts">
  import { onMount } from 'svelte';
  import { SearchableSelect, CardSearchSelect, CardVariantSelector } from '$lib/components';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { uiStore } from '$lib/stores/ui.svelte';

  // Local state
  let cardVariants = $state<any[]>([]);
  let showVariantSelector = $state(false);
  let selectedVariant = $state<any>(null);

  // Event handlers (callback-based)
  function handleSetSelect(item: any) {
    if (item) {
      setsStore.selectSet(item);
    }
  }

  function handleCardSelect(card: any) {
    if (card) {
      cardsStore.selectCard(card);
    }
  }

  function handleGetPrice() {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (card && set) {
      pricingStore.fetchCardPrice(set.id, card.id);
    }
  }

  // Price display helpers
  function hasGradedPrices(pricing: any, gradeType: string): boolean {
    if (!pricing) return false;
    return Object.keys(pricing).some(key => key.startsWith(`${gradeType}-`));
  }

  function hasTcgPlayerPrices(pricing: any): boolean {
    if (!pricing) return false;
    return Object.keys(pricing).some(key => ['market', 'low', 'mid', 'high'].includes(key));
  }

  // Variant handlers
  function handleVariantSelect(variant: any) {
    selectedVariant = variant;
  }

  function handleVariantConfirm(variant: any) {
    selectedVariant = variant;
    const set = setsStore.selectedSet;
    if (set) {
      pricingStore.loadPricingForVariant(set.id, variant.id);
    }
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
  <title>PCPC | Pokémon Card Price Checker</title>
  <meta name="description" content="Check Pokémon card prices and market data" />
</svelte:head>

<div class="pcpc-app">
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <h1 class="app-title">Pokémon Card Price Checker</h1>
      <button
        class="theme-toggle"
        onclick={toggleTheme}
        aria-label="Toggle dark mode"
        type="button"
      >
        {themeStore.current === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main-content">
    <!-- Form Container -->
    <div class="form-container">
      <div class="form-group">
        <label for="set-select" class="form-label">Select a Set</label>
        <SearchableSelect
          items={setsStore.groupedSetsForDropdown}
          placeholder="Search sets..."
          labelField="name"
          secondaryField="code"
          value={setsStore.selectedSet}
          onselect={handleSetSelect}
        />
        {#if setsStore.isLoadingSets}
          <div class="loading-indicator">Loading sets...</div>
        {/if}
      </div>

      <div class="form-group">
        <label for="card-select" class="form-label">Select a Card</label>
        <CardSearchSelect
          cards={cardsStore.cardsInSet}
          placeholder="Search cards by name or number..."
          selectedCard={cardsStore.selectedCard}
          onselect={handleCardSelect}
        />
        {#if cardsStore.isLoadingCards}
          <div class="loading-indicator">Loading cards...</div>
        {/if}
      </div>

      <button
        class="button button-primary"
        onclick={handleGetPrice}
        disabled={!setsStore.selectedSet || !cardsStore.selectedCard || pricingStore.isLoading}
        type="button"
      >
        {pricingStore.isLoading ? 'Getting Price...' : 'Get Price'}
      </button>
    </div>

    <!-- Error Display -->
    {#if uiStore.error}
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">{uiStore.error}</span>
        <button
          class="error-close"
          onclick={() => uiStore.clearError()}
          aria-label="Dismiss error"
          type="button"
        >
          ✕
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
        <!-- Card Info -->
        <div class="card-info-section">
          <h2 class="section-title">Card Information</h2>
          <div class="card-info-grid">
            <div class="info-item">
              <span class="info-label">Card:</span>
              <span class="info-value">{cardsStore.selectedCard.name}</span>
            </div>
            {#if cardsStore.selectedCard.number || cardsStore.selectedCard.cardNumber}
              <div class="info-item">
                <span class="info-label">Number:</span>
                <span class="info-value">#{cardsStore.selectedCard.number || cardsStore.selectedCard.cardNumber}</span>
              </div>
            {/if}
            <div class="info-item">
              <span class="info-label">Set:</span>
              <span class="info-value">{setsStore.selectedSet.name}</span>
            </div>
            {#if setsStore.selectedSet.code}
              <div class="info-item">
                <span class="info-label">Set Code:</span>
                <span class="info-value">{setsStore.selectedSet.code}</span>
              </div>
            {/if}
          </div>
        </div>

        <!-- Pricing Section -->
        {#if Object.keys(pricingStore.priceData).length > 0}
          <div class="pricing-section">
            <div class="pricing-header">
              <h2 class="section-title">Pricing Information</h2>
              <div class="pricing-metadata">
                {#if pricingStore.pricingFromCache}
                  <span class="cache-indicator">Cached</span>
                {/if}
                {#if pricingStore.pricingIsStale}
                  <span class="stale-indicator">Stale</span>
                {/if}
                {#if pricingStore.pricingTimestamp}
                  <span class="timestamp">
                    Updated: {new Date(pricingStore.pricingTimestamp).toLocaleDateString()}
                  </span>
                {/if}
              </div>
            </div>

            {#each Object.entries(pricingStore.priceData) as [key, pricing]}
              {#if pricing && pricing.pricing}
                {@const validPrices = pricingStore.filterValidPrices(pricing)}
                {#if validPrices}
                  <div class="pricing-category">
                    <h3 class="pricing-title">Standard</h3>
                    <div class="pricing-grid">
                      {#if validPrices.market}
                        <div class="price-item">
                          <span class="price-label">Market Price:</span>
                          <span class="price-value">{pricingStore.formatPrice(validPrices.market)}</span>
                        </div>
                      {/if}
                      {#if validPrices.low}
                        <div class="price-item">
                          <span class="price-label">Low:</span>
                          <span class="price-value">{pricingStore.formatPrice(validPrices.low)}</span>
                        </div>
                      {/if}
                      {#if validPrices.mid}
                        <div class="price-item">
                          <span class="price-label">Mid:</span>
                          <span class="price-value">{pricingStore.formatPrice(validPrices.mid)}</span>
                        </div>
                      {/if}
                      {#if validPrices.high}
                        <div class="price-item">
                          <span class="price-label">High:</span>
                          <span class="price-value">{pricingStore.formatPrice(validPrices.high)}</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}

                <!-- PSA Graded Prices -->
                {#if hasGradedPrices(pricing.pricing, 'psa')}
                  <div class="pricing-category">
                    <h3 class="pricing-title">PSA Graded</h3>
                    <div class="pricing-grid">
                      {#each Object.entries(pricing.pricing) as [gradeKey, gradeData]}
                        {#if gradeKey.startsWith('psa-') && gradeData && typeof gradeData === 'object' && 'value' in gradeData}
                          <div class="price-item">
                            <span class="price-label">{gradeKey.replace('psa-', 'PSA ')}:</span>
                            <span class="price-value">{pricingStore.formatPrice(gradeData.value)}</span>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/if}

                <!-- CGC Graded Prices -->
                {#if hasGradedPrices(pricing.pricing, 'cgc')}
                  <div class="pricing-category">
                    <h3 class="pricing-title">CGC Graded</h3>
                    <div class="pricing-grid">
                      {#each Object.entries(pricing.pricing) as [gradeKey, gradeData]}
                        {#if gradeKey.startsWith('cgc-') && gradeData && typeof gradeData === 'object' && 'value' in gradeData}
                          <div class="price-item">
                            <span class="price-label">{gradeKey.replace('cgc-', 'CGC ')}:</span>
                            <span class="price-value">{pricingStore.formatPrice(gradeData.value)}</span>
                          </div>
                        {/if}
                      {/each}
                    </div>
                  </div>
                {/if}
              {/if}
            {/each}
          </div>
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

  .form-container {
    background-color: var(--bg-container);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 2em;
    margin-bottom: 2em;
    box-shadow: 0 2px 8px var(--shadow-light);
  }

  .form-group {
    margin-bottom: 1.5em;
  }

  .form-group:last-of-type {
    margin-bottom: 1.5em;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: var(--color-heading);
    font-size: 0.95em;
  }

  .loading-indicator {
    margin-top: 0.5em;
    padding: 0.5em;
    color: var(--text-secondary);
    font-size: 0.9em;
    font-style: italic;
  }

  .button {
    padding: 0.8em 1.6em;
    border: none;
    border-radius: 4px;
    font-size: 1em;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-speed) ease;
    font-family: inherit;
  }

  .button-primary {
    background-color: var(--color-button-primary-bg);
    color: var(--button-text-color);
    width: 100%;
  }

  .button-primary:hover:not(:disabled) {
    background-color: var(--color-button-primary-hover-bg);
    box-shadow: 0 4px 12px rgba(238, 21, 21, 0.3);
  }

  .button-primary:disabled {
    background-color: var(--button-disabled-bg);
    color: var(--button-disabled-text);
    cursor: not-allowed;
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

  .section-title {
    margin: 0 0 1.5em 0;
    font-size: 1.3em;
    font-weight: 600;
    color: var(--color-heading);
    border-bottom: 2px solid var(--border-primary);
    padding-bottom: 0.5em;
  }

  .card-info-section {
    margin-bottom: 2em;
  }

  .card-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1em;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    padding: 1em;
    background-color: var(--bg-secondary);
    border-radius: 4px;
    border-left: 4px solid var(--color-pokemon-blue);
  }

  .info-label {
    font-weight: 600;
    color: var(--color-heading);
    font-size: 0.9em;
    text-transform: uppercase;
    margin-bottom: 0.3em;
  }

  .info-value {
    color: var(--text-primary);
    font-size: 1.1em;
  }

  .pricing-section {
    margin-top: 2em;
  }

  .pricing-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5em;
    flex-wrap: wrap;
    gap: 1em;
  }

  .pricing-metadata {
    display: flex;
    gap: 1em;
    font-size: 0.85em;
  }

  .cache-indicator {
    background-color: rgba(60, 90, 166, 0.2);
    color: var(--color-cached-indicator);
    padding: 0.3em 0.6em;
    border-radius: 3px;
    font-weight: 500;
  }

  .stale-indicator {
    background-color: rgba(238, 21, 21, 0.2);
    color: var(--color-stale-indicator);
    padding: 0.3em 0.6em;
    border-radius: 3px;
    font-weight: 500;
  }

  .timestamp {
    color: var(--text-secondary);
  }

  .pricing-category {
    margin-bottom: 1.5em;
  }

  .pricing-title {
    margin: 0 0 1em 0;
    font-size: 1.1em;
    font-weight: 600;
    color: var(--color-pricing-category);
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1em;
  }

  .price-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8em;
    background-color: var(--bg-secondary);
    border-radius: 4px;
    border-left: 4px solid var(--color-pokemon-red);
  }

  .price-label {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .price-value {
    font-size: 1.2em;
    font-weight: 700;
    color: var(--color-price-value);
  }

  @media (max-width: 768px) {
    .main-content {
      padding: 1em;
    }

    .form-container,
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

    .pricing-grid,
    .card-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
