<script>
  import { onMount } from 'svelte';
  // Import stores
  import { cardsInSet, isLoadingCards, selectCard, selectedCard } from './stores/cardStore';
  import { fetchCardPrice, formatPrice, isLoading, loadPricingForVariant, priceData, pricingFromCache, pricingIsStale, pricingTimestamp } from './stores/priceStore';
  import { groupedSetsForDropdown, isLoadingSets, loadSets, selectedSet, selectSet } from './stores/setStore';
  import { theme, toggleTheme } from './stores/themeStore';
  import { error, initNetworkListeners, startBackgroundTasks } from './stores/uiStore';
// Import components
  import CardSearchSelect from './components/CardSearchSelect.svelte';
  import CardVariantSelector from './components/CardVariantSelector.svelte';
  import SearchableSelect from './components/SearchableSelect.svelte';
  
  // Reference to CardSearchSelect component
  let cardSearchComponent;
  
  // Variables for handling card variants
  let cardVariants = [];
  let showVariantSelector = false;
  let selectedVariant = null;
  
  // Event handlers
  function handleSetSelect(event) {
    selectSet(event.detail);
  }
  
  function handleCardSelect(event) {
    selectCard(event.detail);
  }
  
  function handleGetPrice() {
    if ($selectedCard) {
      fetchCardPrice($selectedCard.id);
    }
  }
  
  // Helper functions for price display
  function hasGradedPrices(pricing, gradeType) {
    if (!pricing) return false;
    const prefix = `${gradeType}-`;
    return Object.keys(pricing).some(key => key.startsWith(prefix));
  }
  
  function hasTcgPlayerPrices(pricing) {
    if (!pricing) return false;
    const tcgKeys = ['market', 'low', 'mid', 'high'];
    return Object.keys(pricing).some(key => tcgKeys.includes(key));
  }
  
  // Variant handlers
  function handleVariantSelect(event) {
    selectedVariant = event.detail;
  }
  
  function handleVariantConfirm(event) {
    selectedVariant = event.detail;
    loadPricingForVariant(selectedVariant);
  }
  
  function closeVariantSelector() {
    showVariantSelector = false;
  }

  // Lifecycle hooks
  onMount(() => {
    // Load sets when the component mounts
    loadSets();
    
    // Set up network listeners and background tasks
    const cleanupNetworkListeners = initNetworkListeners();
    const cleanupBackgroundTasks = startBackgroundTasks();
    
    // Return a cleanup function
    return () => {
      cleanupNetworkListeners();
      cleanupBackgroundTasks();
    };
  });
</script>

<main>
  <header>
    <h1>Pokémon Card Price Checker</h1>
    <button class="theme-toggle" on:click={toggleTheme} aria-label="Toggle theme">
      {#if $theme === 'light'}
        <!-- Moon icon for dark mode -->
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      {:else}
        <!-- Sun icon for light mode -->
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      {/if}
    </button>
  </header>
  <div class="form-container">
    <div class="form-group">
      <label for="setSelect">Select Set:</label>
      
      {#if $isLoadingSets}
        <div class="loading-select">
          <input disabled placeholder="Loading sets...">
          <div class="loading-spinner"></div>
        </div>
      {:else}
  <SearchableSelect
          items={$groupedSetsForDropdown}
          labelField="name"
          secondaryField="code"
          placeholder="Search for a set..."
          value={$selectedSet}
          on:select={handleSetSelect}
        />
      {/if}
    </div>

    <div class="form-group">
      <label for="cardName">Select Card:</label>
      
      <!-- Replace the input field with SearchableSelect -->
      {#if !$selectedSet}
        <div class="disabled-select">
          <input disabled placeholder="Select a set first">
        </div>
      {:else if $isLoadingCards}
        <div class="loading-select">
          <input disabled placeholder="Loading cards...">
        </div>
      {:else if $cardsInSet.length === 0}
        <div class="error-select">
          <input disabled placeholder="No cards found for this set">
        </div>
      {:else}
        <CardSearchSelect
          bind:this={cardSearchComponent}
          cards={$cardsInSet}
          selectedCard={$selectedCard}
          on:select={handleCardSelect}
        />
      {/if}
    </div>

    <button on:click={handleGetPrice} disabled={$isLoading || !$selectedCard}>
      {$isLoading ? 'Loading...' : 'Get Price'}
    </button>

    {#if $error}
      <p class="error">{$error}</p>
    {/if}

    <!-- Safely display results only if the price data exists -->
    {#if $priceData !== null && $priceData !== undefined && typeof $priceData === 'object'}
      <div class="results">
        <div class="results-container">
          <!-- Left side: Card Details and Image -->
          <div class="card-info">
            <!-- Always use safe property access to avoid null references -->
            <div class="card-details">
              <h2>{$priceData?.name || ($selectedCard && $selectedCard.name) || 'Card'}</h2>
              <p><strong>Set:</strong> {$priceData?.set_name || ($selectedSet && $selectedSet.name) || 'Unknown'}</p>
              <p><strong>Number:</strong> {$priceData?.num || ($selectedCard && $selectedCard.num) || 'Unknown'}</p>
              
              <!-- Only display rarity if we have it -->
              {#if ($priceData && $priceData.rarity) || ($selectedCard && $selectedCard.rarity)}
                <p><strong>Rarity:</strong> {($priceData && $priceData.rarity) || ($selectedCard && $selectedCard.rarity) || 'Unknown'}</p>
              {/if}
            </div>
            
            {#if $priceData?.image_url}
              <div class="card-image">
                <img src={$priceData.image_url} alt={$priceData.name || 'Card'} />
              </div>
            {/if}
          </div>
          
          <!-- Right side: Pricing Information -->
          <div class="pricing-info">
            <h3>Prices:</h3>
            <!-- Check if we have any valid pricing data -->
            {#if !$priceData?.pricing || Object.keys($priceData.pricing || {}).length === 0}
              <p class="no-prices">No pricing data available for this card.</p>
            {:else}
              <ul>
                <!-- Group PSA graded prices -->
                {#if hasGradedPrices($priceData.pricing, 'psa')}
                  <li class="pricing-category">PSA Graded</li>
                  {#each Object.entries($priceData.pricing || {}).filter(([k]) => k.startsWith('psa-')) as [market, price]}
                    <li class="graded-price">
                      <span class="market">Grade {market.replace('psa-', '')}:</span> 
                      <span class="price">${formatPrice(price?.value)}</span> 
                      <span class="currency">{price?.currency || 'USD'}</span>
                    </li>
                  {/each}
                {/if}
                
                <!-- Group CGC graded prices -->
                {#if hasGradedPrices($priceData.pricing, 'cgc')}
                  <li class="pricing-category">CGC Graded</li>
                  {#each Object.entries($priceData.pricing || {}).filter(([k]) => k.startsWith('cgc-')) as [market, price]}
                    <li class="graded-price">
                      <span class="market">Grade {market.replace('cgc-', '')}:</span> 
                      <span class="price">${formatPrice(price?.value)}</span> 
                      <span class="currency">{price?.currency || 'USD'}</span>
                    </li>
                  {/each}
                {/if}
                
                <!-- Show eBay raw price -->
                {#if $priceData.pricing?.ebayRaw}
                  <li class="pricing-category">eBay Raw</li>
                  <li>
                    <span class="market">Market Average:</span> 
                    <span class="price">${formatPrice($priceData.pricing.ebayRaw?.value)}</span> 
                    <span class="currency">{$priceData.pricing.ebayRaw?.currency || 'USD'}</span>
                  </li>
                {/if}
                
                <!-- Show TCG Player prices if available -->
                {#if hasTcgPlayerPrices($priceData.pricing)}
                  <li class="pricing-category">TCG Player</li>
                  {#each Object.entries($priceData.pricing || {}).filter(([k]) => ['market', 'low', 'mid', 'high'].includes(k)) as [market, price]}
                    <li>
                      <span class="market">{market}:</span> 
                      <span class="price">${formatPrice(price?.value)}</span> 
                      <span class="currency">{price?.currency || 'USD'}</span>
                    </li>
                  {/each}
                {/if}
                
                <!-- Show any other pricing source not covered above -->
                {#each Object.entries($priceData.pricing || {}).filter(([k]) => !k.startsWith('psa-') && !k.startsWith('cgc-') && k !== 'ebayRaw' && !['market', 'low', 'mid', 'high'].includes(k)) as [market, price]}
                  <li>
                    <span class="market">{market}:</span> 
                    <span class="price">${formatPrice(price?.value)}</span> 
                    <span class="currency">{price?.currency || 'USD'}</span>
                  </li>
                {/each}
              </ul>
              
              <!-- Add pricing timestamp display -->
              {#if $pricingTimestamp}
                <div class="pricing-timestamp">
                  <small>
                    Pricing data as of: {new Date($pricingTimestamp).toLocaleString()}
                    {#if $pricingFromCache}
                      <span class="cached-indicator">(Cached)</span>
                    {/if}
                    {#if $pricingIsStale}
                      <span class="stale-indicator">(Stale data - using best available)</span>
                    {/if}
                  </small>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
  

  
  <!-- Card Variant Selector Modal -->
  <CardVariantSelector
    variants={cardVariants}
    isVisible={showVariantSelector}
    on:select={handleVariantSelect}
    on:confirm={handleVariantConfirm}
    on:close={closeVariantSelector}
  />
</main>

<!-- Debug panel is now integrated directly into the main debug UI -->

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  }
  
  header {
    background-color: var(--color-header-bg);
    padding: 1rem;
    border-radius: 8px 8px 0 0;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }
  
  h1 {
    color: var(--text-inverse);
    font-size: 1.8rem;
    margin: 0;
    text-align: center;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
  }
  
  .theme-toggle {
    position: absolute;
    right: 1rem;
    width: auto;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .theme-toggle:hover {
    background-color: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
    transform: rotate(180deg);
  }
  
  .theme-toggle svg {
    width: 24px;
    height: 24px;
    color: var(--text-inverse);
  }
  
  .form-container {
    background-color: var(--bg-container);
    border-radius: 8px;
    box-shadow: 0 4px 8px var(--shadow-heavy);
    padding: 1.5rem;
    margin-bottom: 1rem;
    backdrop-filter: blur(5px);
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group:last-of-type {
    margin-bottom: 1.5rem;
  }
  
  label {
    display: block;
    margin-bottom: 0.3rem;
    font-weight: 500;
  }
  
  input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--border-input);
    border-radius: 4px;
    font-size: 1rem;
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
    transition: border-color 0.3s ease;
  }
  
  input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px rgba(60, 90, 166, 0.2);
  }
  
  button:not(.theme-toggle) {
    width: 100%;
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    background-color: var(--color-button-primary-bg);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: background-color 0.3s ease;
  }
  
  button:not(.theme-toggle):hover {
    background-color: var(--color-button-primary-hover-bg);
  }
  
  button:not(.theme-toggle):disabled {
    background-color: var(--border-primary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  .disabled-select input, .loading-select input {
    background-color: var(--bg-hover);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  .loading-select {
    position: relative;
  }
  
  .loading-spinner {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 20px;
    border: 2px solid rgba(60, 90, 166, 0.2);
    border-top: 2px solid var(--color-header-bg);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: translateY(-50%) rotate(0deg); }
    100% { transform: translateY(-50%) rotate(360deg); }
  }
  
  .error-select input {
    background-color: rgba(238, 21, 21, 0.05);
    color: var(--color-error-text);
    cursor: not-allowed;
    border: 1px solid rgba(238, 21, 21, 0.3);
  }

  

  .error {
    color: var(--color-error-text);
    font-size: 0.9rem;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background-color: rgba(238, 21, 21, 0.1);
    border-radius: 4px;
    text-align: center;
  }
  
  .results {
    margin-top: 1.5rem;
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 1rem;
    background-color: var(--bg-tertiary);
    backdrop-filter: blur(5px);
    box-shadow: 0 4px 8px var(--shadow-medium);
  }
  
  .results-container {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }
  
  .card-info {
    flex: 0 0 300px;
    min-width: 250px;
  }
  
  .pricing-info {
    flex: 1;
    min-width: 0;
  }
  
  .card-image {
    text-align: center;
    margin-bottom: 1rem;
    padding: 0.5rem;
    background-color: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-primary);
  }
  
  .card-image img {
    max-width: 100%;
    max-height: 300px;
    width: auto;
    height: auto;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition: transform 0.2s ease;
  }
  
  .card-image img:hover {
    transform: scale(1.05);
  }
  
  .card-details h2 {
    color: var(--color-heading);
    margin-top: 0;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-primary);
    padding-bottom: 0.5rem;
    font-size: 1.4rem;
  }
  
  .card-details p {
    margin: 0.3rem 0;
    font-size: 0.95rem;
  }
  
  .results h2 {
    color: var(--color-heading);
    margin-top: 0;
    border-bottom: 1px solid var(--border-primary);
    padding-bottom: 0.5rem;
  }
  
  .results h3 {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    color: var(--color-price-value);
  }
  
  .results ul {
    list-style-type: none;
    padding: 0;
  }
  
  .results li {
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border-secondary);
  }
  
  .results li:last-child {
    border-bottom: none;
  }
  
  .market {
    font-weight: 600;
    text-transform: capitalize;
  }
  
  .price {
    font-weight: 700;
    color: var(--color-price-value);
  }
  
  .currency {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .pricing-category {
    background-color: var(--bg-hover);
    font-weight: 700;
    color: var(--color-pricing-category);
    margin-top: 0.5rem;
    padding: 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-size: 0.9rem;
    letter-spacing: 0.5px;
  }
  
  .results .graded-price {
    /* Removed indentation to standardize with other pricing sections */
  }
  
  .no-prices {
    color: var(--text-secondary);
    font-style: italic;
    padding: 0.5rem 0;
  }
  
  .pricing-timestamp {
    margin-top: 1rem;
    padding-top: 0.5rem;
    border-top: 1px dashed var(--border-primary);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .cached-indicator {
    color: var(--color-cached-indicator);
    font-weight: 500;
    margin-left: 0.5rem;
  }
  
  .stale-indicator {
    color: var(--color-stale-indicator);
    font-weight: 500;
    margin-left: 0.5rem;
  }
  
  /* Responsive adjustments */
  @media (max-width: 768px) {
    .results-container {
      flex-direction: column;
      gap: 1rem;
    }
    
    .card-info {
      flex: none;
      width: 100%;
    }
    
    .card-image {
      max-width: 250px;
      margin: 0 auto 1rem auto;
    }
  }
  
  @media (max-width: 600px) {
    main {
      padding: 0.5rem;
    }
    
    .form-container {
      padding: 1rem;
    }
    
    h1 {
      font-size: 1.5rem;
    }
    
    .results {
      padding: 0.75rem;
    }
    
    .card-image {
      max-width: 200px;
    }
  }
</style>
