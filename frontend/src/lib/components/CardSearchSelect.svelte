<script lang="ts">
  import { onMount } from 'svelte';
  import type { PokemonCard } from '$lib/types';
  import { getRarityColor, getRarityWeight, isGradientRarity, getRarityInfo, RARITY_LEGEND } from '$lib/utils/rarityMap';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  type SortMode = 'number' | 'name' | 'rarity' | 'priceDesc' | 'priceAsc';

  interface Props {
    cards?: PokemonCard[];
    placeholder?: string;
    selectedCard?: PokemonCard;
    printedTotal?: number | null;
    disabled?: boolean;
    onselect?: (card: PokemonCard | null) => void;
  }

  let { cards = [], placeholder = 'Search cards...', selectedCard = undefined, printedTotal = null, disabled = false, onselect }: Props = $props();

  let searchText = $state('');
  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);
  let sortMode = $state<SortMode>('number');
  let inputElement: HTMLInputElement | undefined = $state();
  let dropdownElement: HTMLDivElement | undefined = $state();
  let cardListElement: HTMLDivElement | undefined = $state();
  let observer: IntersectionObserver | null = null;

  $effect(() => { if (disabled && showDropdown) { showDropdown = false; highlightedIndex = -1; } });

  $effect(() => {
    if (showDropdown && cardListElement) {
      observer = new IntersectionObserver((entries) => { for (const entry of entries) { if (entry.isIntersecting) { const img = entry.target as HTMLImageElement; const src = img.dataset.src; if (src) { img.src = src; delete img.dataset.src; } observer?.unobserve(img); } } }, { root: cardListElement, rootMargin: '50px', threshold: 0 });
      const images = cardListElement.querySelectorAll('img[data-src]');
      images.forEach((img) => observer?.observe(img));
    }
    return () => { if (observer) { observer.disconnect(); observer = null; } };
  });

  $effect(() => { const _ = filteredCards; const __ = sortMode; if (showDropdown && cardListElement && observer) { queueMicrotask(() => { if (!cardListElement || !observer) return; const images = cardListElement.querySelectorAll('img[data-src]'); images.forEach((img) => observer?.observe(img)); }); } });

  function parseCardNumber(card: PokemonCard): number { const num = card.number || card.cardNumber || '0'; const parsed = parseInt(num, 10); return isNaN(parsed) ? 999999 : parsed; }

  /**
   * Get NM market price for a card from its pre-loaded variants.
   * Returns null if no pricing data is available.
   */
  function getCardNmPrice(card: PokemonCard): number | null {
    if (!card.variants || card.variants.length === 0) return null;
    for (const variant of card.variants) {
      if (!variant.prices) continue;
      const nmRaw = variant.prices.find((p) => p.type === 'raw' && p.condition === 'NM');
      if (nmRaw) return nmRaw.market;
      const anyRaw = variant.prices.find((p) => p.type === 'raw');
      if (anyRaw) return anyRaw.market;
    }
    return null;
  }

  /**
   * Get the currency for a card's pricing (USD or JPY).
   */
  function getCardCurrency(card: PokemonCard): string {
    if (!card.variants) return 'USD';
    for (const variant of card.variants) {
      if (!variant.prices) continue;
      for (const p of variant.prices) {
        if (p.currency) return p.currency;
      }
    }
    return 'USD';
  }

  /**
   * Get the 30-day trend direction for a card's NM price.
   * Returns 'up', 'down', or null (no change / no data).
   */
  function getCardTrend(card: PokemonCard): { direction: 'up' | 'down' | null; percent: number } {
    if (!card.variants) return { direction: null, percent: 0 };
    for (const variant of card.variants) {
      if (!variant.prices) continue;
      const nmRaw = variant.prices.find((p) => p.type === 'raw' && p.condition === 'NM');
      const price = nmRaw ?? variant.prices.find((p) => p.type === 'raw');
      if (price?.trends?.days30) {
        const pct = price.trends.days30.percentChange;
        if (pct > 0) return { direction: 'up', percent: pct };
        if (pct < 0) return { direction: 'down', percent: Math.abs(pct) };
        return { direction: null, percent: 0 };
      }
    }
    return { direction: null, percent: 0 };
  }

  const filteredCards = $derived.by(() => {
    let result = cards;
    if (searchText.trim()) { const lowerSearch = searchText.toLowerCase(); result = cards.filter((card) => { const name = String(card.name || '').toLowerCase(); const number = String(card.number || card.cardNumber || '').toLowerCase(); return name.includes(lowerSearch) || number.includes(lowerSearch); }); }
    const sorted = [...result];
    switch (sortMode) {
      case 'number': sorted.sort((a, b) => parseCardNumber(a) - parseCardNumber(b)); break;
      case 'name': sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'rarity': sorted.sort((a, b) => getRarityWeight(b.rarity) - getRarityWeight(a.rarity)); break;
      case 'priceDesc': sorted.sort((a, b) => (getCardNmPrice(b) ?? 0) - (getCardNmPrice(a) ?? 0)); break;
      case 'priceAsc': sorted.sort((a, b) => (getCardNmPrice(a) ?? 0) - (getCardNmPrice(b) ?? 0)); break;
    }
    return sorted;
  });

  function formatCardNumber(card: PokemonCard): string { const num = card.number || card.cardNumber || ''; if (!num) return ''; const total = printedTotal; return total ? `#${num}/${total}` : `#${num}`; }
  function getThumbnailUrl(card: PokemonCard): string | null { if (!card.images || card.images.length === 0) return null; return card.images[0].small || card.images[0].medium || null; }

  const displayText = $derived.by(() => { if (!selectedCard) return ''; const num = selectedCard.number || selectedCard.cardNumber || ''; return num ? `${selectedCard.name} (#${num})` : selectedCard.name; });

  $effect(() => { if (selectedCard && !showDropdown) { searchText = displayText; } else if (!selectedCard) { searchText = ''; } });

  $effect(() => {
    if (!showDropdown) return;
    const handleOutsideClick = (event: MouseEvent) => { if (dropdownElement && inputElement && !dropdownElement.contains(event.target as Node) && !inputElement.contains(event.target as Node)) { showDropdown = false; highlightedIndex = -1; } };
    document.addEventListener('click', handleOutsideClick);
    return () => { document.removeEventListener('click', handleOutsideClick); };
  });

  function handleInputClick() { if (disabled) return; if (!showDropdown) showDropdown = true; highlightedIndex = -1; }
  function handleInputChange(e: Event) { if (disabled) return; const target = e.target as HTMLInputElement; searchText = target.value; showDropdown = true; highlightedIndex = -1; }
  function handleInputFocus() { if (disabled) return; showDropdown = true; }
  function handleCardSelect(card: PokemonCard) { onselect?.(card); showDropdown = false; highlightedIndex = -1; }
  function handleClear(e: MouseEvent) { e.stopPropagation(); onselect?.(null); searchText = ''; showDropdown = true; highlightedIndex = -1; inputElement?.focus(); }
  function handleKeyDown(e: KeyboardEvent) { if (disabled) return; if (!showDropdown && e.key !== 'ArrowDown' && e.key !== 'Enter') return; if (e.key === 'ArrowDown') { e.preventDefault(); showDropdown = true; highlightedIndex = Math.min(highlightedIndex + 1, filteredCards.length - 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIndex = Math.max(highlightedIndex - 1, -1); } else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < filteredCards.length) handleCardSelect(filteredCards[highlightedIndex]); } else if (e.key === 'Escape') { e.preventDefault(); showDropdown = false; highlightedIndex = -1; } }
  function handleMouseOver(index: number) { highlightedIndex = index; }
  function handleSortMode(mode: SortMode) { sortMode = mode; }

  onMount(() => { if (inputElement) { inputElement.addEventListener('click', handleInputClick); inputElement.addEventListener('input', handleInputChange); inputElement.addEventListener('focus', handleInputFocus); inputElement.addEventListener('keydown', handleKeyDown); } return () => { if (inputElement) { inputElement.removeEventListener('click', handleInputClick); inputElement.removeEventListener('input', handleInputChange); inputElement.removeEventListener('focus', handleInputFocus); inputElement.removeEventListener('keydown', handleKeyDown); } }; });
</script>

<div class="card-search-select-container" class:disabled>
  <div class="input-wrapper">
    <input bind:this={inputElement} type="text" placeholder={disabled ? 'Select a set first...' : placeholder} value={searchText} class="search-input" aria-label="Search cards" {disabled} />
    {#if selectedCard}<button onclick={handleClear} class="clear-btn" aria-label="Clear selection" type="button">&#x2715;</button>{/if}
    <span class="dropdown-icon">&#x25BC;</span>
  </div>

  {#if showDropdown && !disabled}
    <div bind:this={dropdownElement} class="dropdown">
      <div class="sort-bar">
        <span class="sort-label">Sort:</span>
        <button type="button" class="sort-btn" class:active={sortMode === 'number'} onclick={() => handleSortMode('number')}>By #</button>
        <button type="button" class="sort-btn" class:active={sortMode === 'name'} onclick={() => handleSortMode('name')}>By name</button>
        <button type="button" class="sort-btn" class:active={sortMode === 'rarity'} onclick={() => handleSortMode('rarity')}>By rarity</button>
        <button type="button" class="sort-btn" class:active={sortMode === 'priceDesc'} onclick={() => handleSortMode('priceDesc')}>Price &#x2193;</button>
        <button type="button" class="sort-btn" class:active={sortMode === 'priceAsc'} onclick={() => handleSortMode('priceAsc')}>Price &#x2191;</button>
      </div>
      <div bind:this={cardListElement} class="card-list">
        {#each filteredCards as card, idx (card.id)}
          {@const thumbUrl = getThumbnailUrl(card)}
          {@const cardNum = formatCardNumber(card)}
          {@const rarityColor = getRarityColor(card.rarity)}
          {@const gradient = isGradientRarity(card.rarity)}
          {@const isSelected = selectedCard?.id === card.id}
          {@const nmPrice = getCardNmPrice(card)}
          {@const currency = getCardCurrency(card)}
          {@const trend = getCardTrend(card)}
          <div class="card-item" class:highlighted={highlightedIndex === idx} class:selected={isSelected} onmouseover={() => handleMouseOver(idx)} onclick={() => handleCardSelect(card)} role="option" aria-selected={highlightedIndex === idx}>
            <div class="card-thumb">{#if thumbUrl}<img data-src={thumbUrl} alt="" class="thumb-img" width="22" height="30" />{:else}<div class="thumb-placeholder"></div>{/if}</div>
            <span class="rarity-dot" class:gradient-dot={gradient} style:background-color={gradient ? undefined : rarityColor} style:background-image={gradient ? `linear-gradient(135deg, var(--rarity-sar-from), var(--rarity-sar-to))` : undefined} title={getRarityInfo(card.rarity).label}></span>
            <div class="card-info">
              <div class="card-name-row">
                <span class="card-name">{card.name}</span>
                {#if nmPrice !== null}
                  <span class="price-badge" class:price-up={trend.direction === 'up'} class:price-down={trend.direction === 'down'}>
                    {pricingStore.formatPrice(nmPrice, currency)}
                    {#if trend.direction === 'up'}<span class="trend-arrow">&#x25B2;</span>{:else if trend.direction === 'down'}<span class="trend-arrow">&#x25BC;</span>{/if}
                  </span>
                {:else}
                  <span class="price-badge no-price">&#x2013;</span>
                {/if}
              </div>
              {#if cardNum}<span class="card-number">{cardNum}</span>{/if}
            </div>
          </div>
        {/each}
        {#if filteredCards.length === 0}<div class="no-results">No cards found</div>{/if}
      </div>
      <div class="rarity-legend">
        {#each RARITY_LEGEND as entry}<span class="legend-item"><span class="legend-dot" style:background-color={entry.colorTo ? undefined : entry.color} style:background-image={entry.colorTo ? `linear-gradient(135deg, ${entry.color}, ${entry.colorTo})` : undefined}></span><span class="legend-label">{entry.label}</span></span>{/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .card-search-select-container { position: relative; width: 100%; font-family: inherit; }
  .card-search-select-container.disabled { opacity: 0.5; pointer-events: none; }
  .input-wrapper { position: relative; display: flex; align-items: center; }
  .search-input { width: 100%; padding: 0.6em 2.5em 0.6em 0.8em; border: 1px solid var(--border-subtle); border-radius: var(--radius-input); background-color: var(--surface-2); color: var(--text-primary); font-size: var(--fs-body); font-family: inherit; transition: all var(--transition-speed) var(--transition-fn); }
  .search-input:disabled { cursor: not-allowed; color: var(--text-dim); }
  .search-input:focus { outline: none; border-color: var(--accent-red); box-shadow: var(--focus-ring); }
  .search-input:disabled:focus { border-color: var(--border-subtle); box-shadow: none; }
  .clear-btn { position: absolute; right: 2.2em; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 0.2em 0.4em; font-size: var(--fs-body); line-height: 1; }
  .clear-btn:hover { color: var(--text-primary); background: transparent; }
  .dropdown-icon { position: absolute; right: 0.6em; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.7em; pointer-events: none; }
  .dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background-color: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-input); box-shadow: var(--shadow-md); z-index: 1000; display: flex; flex-direction: column; }
  .sort-bar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-bottom: 1px solid var(--border-faint); flex-shrink: 0; }
  .sort-label { font-size: var(--fs-micro); color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.5px; margin-right: 2px; }
  .sort-btn { font-size: var(--fs-micro); padding: 2px 8px; border-radius: var(--radius-badge); background: transparent; color: var(--text-muted); border: 1px solid var(--border-subtle); cursor: pointer; font-weight: 500; line-height: 1.4; font-family: inherit; }
  .sort-btn:hover:not(.active) { background: var(--bg-hover); color: var(--text-secondary); }
  .sort-btn.active { background: rgba(232, 69, 60, 0.12); color: var(--accent-red); border-color: var(--accent-red); }
  .card-list { max-height: 300px; overflow-y: auto; flex: 1; }
  .card-item { padding: 6px 8px; color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background-color var(--transition-speed) var(--transition-fn); border-left: 3px solid transparent; }
  .card-item:hover, .card-item.highlighted { background-color: var(--bg-hover); }
  .card-item.selected { border-left-color: var(--accent-red); background-color: rgba(232, 69, 60, 0.06); }
  .card-thumb { flex-shrink: 0; width: 22px; height: 30px; border-radius: 2px; overflow: hidden; background-color: var(--surface-1); }
  .thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .thumb-placeholder { width: 100%; height: 100%; background: var(--surface-1); }
  .rarity-dot { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; }
  .gradient-dot { background-color: transparent; }
  .card-info { display: flex; flex-direction: column; min-width: 0; gap: 1px; flex: 1; }
  .card-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .card-name { font-size: var(--fs-body); font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .price-badge { flex-shrink: 0; font-size: var(--fs-micro); color: var(--price-green); font-weight: 500; font-variant-numeric: tabular-nums; margin-left: auto; }
  .price-badge.price-up { color: var(--price-green); }
  .price-badge.price-down { color: var(--price-red); }
  .price-badge.no-price { color: var(--text-faint); font-weight: 400; }
  .trend-arrow { font-size: 8px; margin-left: 2px; }
  .card-number { font-size: var(--fs-micro); color: var(--text-muted); }
  .no-results { padding: 16px 8px; color: var(--text-muted); text-align: center; font-size: var(--fs-body); }
  .rarity-legend { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-top: 1px solid var(--border-faint); flex-shrink: 0; flex-wrap: wrap; }
  .legend-item { display: flex; align-items: center; gap: 3px; }
  .legend-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .legend-label { font-size: 9px; color: var(--text-dim); letter-spacing: 0.3px; }
  .card-list::-webkit-scrollbar { width: 6px; }
  .card-list::-webkit-scrollbar-track { background: transparent; }
  .card-list::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb-bg); border-radius: 3px; }
  .card-list::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover-bg); }
  @media (max-width: 768px) {
    .search-input { padding: 0.7em 2.5em 0.7em 0.8em; font-size: 14px; min-height: 44px; }
    .card-list { max-height: 45vh; }
    .card-item { padding: 8px; min-height: 44px; }
    .sort-bar { gap: 3px; padding: 5px 6px; flex-wrap: wrap; }
    .sort-btn { padding: 3px 6px; font-size: 9px; }
    .rarity-legend { gap: 6px; padding: 4px 6px; }
    .legend-label { font-size: 8px; }
  }
</style>
