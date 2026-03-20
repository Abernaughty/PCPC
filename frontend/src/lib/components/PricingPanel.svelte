<script lang="ts">
  import type { PricingResult, CardVariant, VariantPrice } from '$lib/types';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import HeroPrice from './HeroPrice.svelte';
  import VariantPills from './VariantPills.svelte';
  import PriceCard from './PriceCard.svelte';
  import PriceDetailChart from './PriceDetailChart.svelte';
  import CompareChart from './CompareChart.svelte';
  import Toast from './Toast.svelte';

  interface Props {
    pricing: PricingResult;
  }

  let { pricing }: Props = $props();

  // Selected variant
  let selectedVariantName = $state<string>('');

  $effect(() => {
    if (pricing.variants && pricing.variants.length > 0) {
      const withPrices = pricing.variants.find((v) => v.prices.length > 0);
      selectedVariantName = withPrices?.name ?? pricing.variants[0].name;
    }
  });

  let activeVariant = $derived.by(() => {
    if (!pricing.variants) return null;
    return pricing.variants.find((v) => v.name === selectedVariantName) ?? null;
  });

  let heroPrice = $derived.by(() => {
    if (!activeVariant) return null;
    return pricingStore.getMarketPrice(pricing, activeVariant.name);
  });

  let rawPrices = $derived(activeVariant ? pricingStore.getRawPrices(activeVariant) : []);
  let gradedPrices = $derived(activeVariant ? pricingStore.getGradedPrices(activeVariant) : []);

  // Graded company filter
  let gradedCompanies = $derived.by(() => {
    const companies = new Set<string>();
    for (const p of gradedPrices) {
      if (p.company) companies.add(p.company);
    }
    return Array.from(companies);
  });

  let selectedCompany = $state<string>('');

  $effect(() => {
    if (gradedCompanies.length > 0 && !gradedCompanies.includes(selectedCompany)) {
      selectedCompany = gradedCompanies[0];
    }
  });

  let filteredGradedPrices = $derived(
    gradedPrices.filter((p) => p.company === selectedCompany)
  );

  // Expanded detail chart state (only one at a time per section)
  let expandedRawIndex = $state<number | null>(null);
  let expandedGradedIndex = $state<number | null>(null);

  // Toast
  let toastMessage = $state('');

  function handleVariantSelect(name: string) {
    selectedVariantName = name;
    expandedRawIndex = null;
    expandedGradedIndex = null;
  }

  function handleCopy(text: string) {
    toastMessage = '';
    setTimeout(() => { toastMessage = `Copied ${text}`; }, 0);
  }

  function toggleRawDetail(index: number) {
    expandedRawIndex = expandedRawIndex === index ? null : index;
  }

  function toggleGradedDetail(index: number) {
    expandedGradedIndex = expandedGradedIndex === index ? null : index;
  }

  // Company color helper
  function getCompanyColor(company: string): string {
    switch (company.toUpperCase()) {
      case 'PSA': return 'var(--chart-psa)';
      case 'CGC': return 'var(--chart-cgc)';
      case 'BGS': return 'var(--chart-bgs)';
      case 'SGC': return 'var(--chart-sgc)';
      default: return 'var(--text-muted)';
    }
  }

  // Share actions
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      handleCopy('link');
    } catch { /* clipboard may fail */ }
  }

  async function shareCard() {
    if (navigator.share) {
      try {
        await navigator.share({ url: window.location.href });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  }
</script>

{#if pricing.variants && pricing.variants.length > 0 && activeVariant}
  <div class="pricing-section">
    <!-- Hero Price -->
    <HeroPrice
      price={heroPrice}
      variant={activeVariant}
      fromCache={pricingStore.pricingFromCache}
      isStale={pricingStore.pricingIsStale}
      timestamp={pricingStore.pricingTimestamp}
    />

    <!-- Variant Pills -->
    {#if pricing.variants.length > 1}
      <VariantPills
        variants={pricing.variants}
        selected={selectedVariantName}
        onselect={handleVariantSelect}
      />
    {/if}

    <!-- Tier 1: Raw Price Cards -->
    {#if rawPrices.length > 0}
      <div class="section-header">
        <span class="section-label">RAW PRICES</span>
        <span class="section-period">(30d)</span>
      </div>
      <div class="price-cards-row">
        {#each rawPrices as rp, i}
          <PriceCard
            price={rp}
            label={rp.condition}
            isExpanded={expandedRawIndex === i}
            onToggleDetail={() => toggleRawDetail(i)}
            onCopy={handleCopy}
          />
        {/each}
      </div>
      {#if expandedRawIndex !== null && rawPrices[expandedRawIndex]}
        <PriceDetailChart price={rawPrices[expandedRawIndex]} />
      {/if}
    {/if}

    <!-- Tier 1: Graded Price Cards -->
    {#if gradedPrices.length > 0}
      <div class="section-header graded-header">
        <div class="section-label-row">
          <span class="section-label">GRADED PRICES</span>
          <span class="section-period">(30d)</span>
        </div>
        {#if gradedCompanies.length > 1}
          <div class="company-pills">
            {#each gradedCompanies as company}
              <button
                class="company-pill"
                class:active={selectedCompany === company}
                onclick={() => { selectedCompany = company; expandedGradedIndex = null; }}
                type="button"
              >
                <span class="company-dot" style="background-color: {getCompanyColor(company)};"></span>
                {company}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="price-cards-row">
        {#each filteredGradedPrices as gp, i}
          <PriceCard
            price={gp}
            label={gp.grade ? `${gp.company} ${gp.grade}` : gp.condition}
            isExpanded={expandedGradedIndex === i}
            onToggleDetail={() => toggleGradedDetail(i)}
            onCopy={handleCopy}
          />
        {/each}
      </div>
      {#if expandedGradedIndex !== null && filteredGradedPrices[expandedGradedIndex]}
        <PriceDetailChart price={filteredGradedPrices[expandedGradedIndex]} />
      {/if}
    {/if}

    <!-- Tier 3: Compare Trends -->
    {#if rawPrices.length > 0 || gradedPrices.length > 0}
      <CompareChart rawPrices={rawPrices} gradedPrices={gradedPrices} />
    {/if}

    <!-- Share section -->
    <div class="share-section">
      <span class="share-label">SHARE THIS CARD</span>
      <div class="share-buttons">
        <button class="share-btn" onclick={copyLink} type="button">
          &#x1F517; Copy link
        </button>
        <button class="share-btn" onclick={shareCard} type="button">
          &#x2197;&#xFE0F; Share
        </button>
      </div>
    </div>

    <!-- Empty variant state -->
    {#if rawPrices.length === 0 && gradedPrices.length === 0}
      <div class="empty-variant">
        <span class="empty-icon">&empty;</span>
        <p class="empty-text">No pricing data available for this variant yet.</p>
        <p class="empty-sub">This variant may be too new or not widely traded.</p>
      </div>
    {/if}
  </div>
{/if}

{#if pricingStore.pricingError}
  <div class="pricing-error">
    <span class="error-icon">&#x26A0;&#xFE0F;</span>
    <span class="error-text">{pricingStore.pricingError}</span>
    <button
      class="error-close"
      onclick={() => pricingStore.clearError()}
      aria-label="Dismiss pricing error"
      type="button"
    >
      &#x2715;
    </button>
  </div>
{/if}

<Toast message={toastMessage} />

<style>
  .pricing-section {
    margin-top: 20px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 20px;
    margin-bottom: 10px;
  }

  .graded-header {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .section-label-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .section-period {
    font-size: 10px;
    color: var(--text-dim);
  }

  .price-cards-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .company-pills {
    display: flex;
    gap: 4px;
  }

  .company-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    background: none;
    border: 0.5px solid var(--border-subtle);
    border-radius: var(--radius-badge);
    padding: 2px 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .company-pill:hover {
    border-color: rgba(255, 255, 255, 0.1);
    background: none;
  }

  .company-pill.active {
    border-color: var(--amber-border);
    background-color: var(--amber-dim);
    color: var(--amber);
  }

  .company-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* Share section */
  .share-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 0.5px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }

  .share-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .share-buttons {
    display: flex;
    gap: 8px;
  }

  .share-btn {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    background: none;
    border: 0.5px solid var(--border-subtle);
    border-radius: var(--radius-badge);
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .share-btn:hover {
    border-color: var(--amber-border);
    color: var(--amber);
    background: none;
  }

  /* Empty variant state */
  .empty-variant {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-dim);
  }

  .empty-icon {
    font-size: 28px;
    display: block;
    margin-bottom: 8px;
    opacity: 0.5;
  }

  .empty-text {
    margin: 0 0 4px 0;
    font-size: 13px;
    color: var(--text-muted);
  }

  .empty-sub {
    margin: 0;
    font-size: 11px;
    color: var(--text-dim);
  }

  /* Pricing error */
  .pricing-error {
    margin-top: 16px;
    background-color: rgba(248, 113, 113, 0.08);
    border: 0.5px solid rgba(248, 113, 113, 0.2);
    border-radius: var(--radius-input);
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .error-icon { font-size: 1.1em; flex-shrink: 0; }
  .error-text { color: var(--price-red); flex: 1; font-size: 12px; }

  .error-close {
    background-color: transparent;
    border: none;
    color: var(--price-red);
    cursor: pointer;
    padding: 0;
    font-size: 1em;
    flex-shrink: 0;
    transition: opacity 0.15s ease;
  }

  .error-close:hover { opacity: 0.7; background: none; }

  @media (max-width: 768px) {
    .price-cards-row {
      flex-wrap: wrap;
    }

    .price-cards-row > :global(.price-card) {
      min-width: calc(50% - 4px);
      flex: 0 0 calc(50% - 4px);
    }
  }

  @media (max-width: 480px) {
    .price-cards-row > :global(.price-card) {
      min-width: 100%;
      flex: 0 0 100%;
    }
  }
</style>
