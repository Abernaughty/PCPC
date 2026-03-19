<script lang="ts">
  import { onMount } from 'svelte';
  import type { PokemonCard } from '$lib/types';
  import { getRarityColor, getRarityWeight, isGradientRarity, getRarityInfo, RARITY_LEGEND } from '$lib/utils/rarityMap';

  type SortMode = 'number' | 'name' | 'rarity';

  interface Props {
    cards?: PokemonCard[];
    placeholder?: string;
    selectedCard?: PokemonCard;
    printedTotal?: number | null;
    onselect?: (card: PokemonCard | null) => void;
  }

  let {
    cards = [],
    placeholder = 'Search cards...',
    selectedCard = undefined,
    printedTotal = null,
    onselect
  }: Props = $props();

  let searchText = $state('');
  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);
  let sortMode = $state<SortMode>('number');
  let inputElement: HTMLInputElement | undefined = $state();
  let dropdownElement: HTMLDivElement | undefined = $state();
  let cardListElement: HTMLDivElement | undefined = $state();

  // IntersectionObserver for lazy-loading thumbnails
  let observer: IntersectionObserver | null = null;

  // Set up IntersectionObserver when dropdown opens, tear down when it closes
  $effect(() => {
    if (showDropdown && cardListElement) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              const src = img.dataset.src;
              if (src) {
                img.src = src;
                delete img.dataset.src;
              }
              observer?.unobserve(img);
            }
          }
        },
        {
          root: cardListElement,
          rootMargin: '50px',
          threshold: 0,
        }
      );

      const images = cardListElement.querySelectorAll('img[data-src]');
      images.forEach((img) => observer?.observe(img));
    }

    return () => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    };
  });

  // Re-observe images when filteredCards or sortMode changes (list re-renders)
  $effect(() => {
    const _ = filteredCards;
    const __ = sortMode;

    if (showDropdown && cardListElement && observer) {
      queueMicrotask(() => {
        if (!cardListElement || !observer) return;
        const images = cardListElement.querySelectorAll('img[data-src]');
        images.forEach((img) => observer?.observe(img));
      });
    }
  });

  // Parse card number for numeric sorting
  function parseCardNumber(card: PokemonCard): number {
    const num = card.number || card.cardNumber || '0';
    const parsed = parseInt(num, 10);
    return isNaN(parsed) ? 999999 : parsed;
  }

  // Filter cards based on search
  const filteredCards = $derived.by(() => {
    let result = cards;

    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase();
      result = cards.filter((card) => {
        const name = String(card.name || '').toLowerCase();
        const number = String(card.number || card.cardNumber || '').toLowerCase();
        return name.includes(lowerSearch) || number.includes(lowerSearch);
      });
    }

    const sorted = [...result];
    switch (sortMode) {
      case 'number':
        sorted.sort((a, b) => parseCardNumber(a) - parseCardNumber(b));
        break;
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'rarity':
        sorted.sort((a, b) => getRarityWeight(b.rarity) - getRarityWeight(a.rarity));
        break;
    }

    return sorted;
  });

  // Format card number display
  function formatCardNumber(card: PokemonCard): string {
    const num = card.number || card.cardNumber || '';
    if (!num) return '';
    const total = printedTotal;
    return total ? `#${num}/${total}` : `#${num}`;
  }

  // Get thumbnail URL from card images
  function getThumbnailUrl(card: PokemonCard): string | null {
    if (!card.images || card.images.length === 0) return null;
    return card.images[0].small || card.images[0].medium || null;
  }

  // Get display text for selected card
  const displayText = $derived.by(() => {
    if (!selectedCard) return '';
    const num = selectedCard.number || selectedCard.cardNumber || '';
    return num ? `${selectedCard.name} (#${num})` : selectedCard.name;
  });

  // Sync searchText with selectedCard prop.
  // When selectedCard is set (e.g. user picks a card), show its display text.
  // When selectedCard is cleared (e.g. parent resets after set change), clear the input.
  $effect(() => {
    if (selectedCard && !showDropdown) {
      searchText = displayText;
    } else if (!selectedCard) {
      searchText = '';
    }
  });

  // Outside click handler
  $effect(() => {
    if (!showDropdown) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        dropdownElement &&
        inputElement &&
        !dropdownElement.contains(event.target as Node) &&
        !inputElement.contains(event.target as Node)
      ) {
        showDropdown = false;
        highlightedIndex = -1;
      }
    };

    document.addEventListener('click', handleOutsideClick);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  });

  function handleInputClick() {
    // Open only - never close on click. Closing is handled by
    // outside-click and Escape key. This prevents the flash bug
    // where focus fires first (opening) then click toggles (closing).
    if (!showDropdown) {
      showDropdown = true;
    }
    highlightedIndex = -1;
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    searchText = target.value;
    showDropdown = true;
    highlightedIndex = -1;
  }

  function handleInputFocus() {
    showDropdown = true;
  }

  function handleCardSelect(card: PokemonCard) {
    if (onselect) {
      onselect(card);
    }
    showDropdown = false;
    highlightedIndex = -1;
  }

  function handleClear(e: MouseEvent) {
    e.stopPropagation();
    if (onselect) {
      onselect(null);
    }
    searchText = '';
    showDropdown = false;
    highlightedIndex = -1;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!showDropdown && e.key !== 'ArrowDown' && e.key !== 'Enter') {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      showDropdown = true;
      highlightedIndex = Math.min(highlightedIndex + 1, filteredCards.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredCards.length) {
        handleCardSelect(filteredCards[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      showDropdown = false;
      highlightedIndex = -1;
    }
  }

  function handleMouseOver(index: number) {
    highlightedIndex = index;
  }

  function setSortMode(mode: SortMode) {
    sortMode = mode;
  }

  onMount(() => {
    if (inputElement) {
      inputElement.addEventListener('click', handleInputClick);
      inputElement.addEventListener('input', handleInputChange);
      inputElement.addEventListener('focus', handleInputFocus);
      inputElement.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (inputElement) {
        inputElement.removeEventListener('click', handleInputClick);
        inputElement.removeEventListener('input', handleInputChange);
        inputElement.removeEventListener('focus', handleInputFocus);
        inputElement.removeEventListener('keydown', handleKeyDown);
      }
    };
  });
</script>

<div class="card-search-select-container">
  <div class="input-wrapper">
    <input
      bind:this={inputElement}
      type="text"
      {placeholder}
      value={searchText}
      class="search-input"
      aria-label="Search cards"
    />
    {#if selectedCard}
      <button
        onclick={handleClear}
        class="clear-btn"
        aria-label="Clear selection"
        type="button"
      >
        &#x2715;
      </button>
    {/if}
    <span class="dropdown-icon">&#x25BC;</span>
  </div>

  {#if showDropdown}
    <div bind:this={dropdownElement} class="dropdown">
      <!-- Sort toggle bar -->
      <div class="sort-bar">
        <span class="sort-label">Sort:</span>
        <button
          type="button"
          class="sort-btn" class:active={sortMode === 'number'}
          onclick={() => setSortMode('number')}
        >By #</button>
        <button
          type="button"
          class="sort-btn" class:active={sortMode === 'name'}
          onclick={() => setSortMode('name')}
        >By name</button>
        <button
          type="button"
          class="sort-btn" class:active={sortMode === 'rarity'}
          onclick={() => setSortMode('rarity')}
        >By rarity</button>
      </div>

      <!-- Card list -->
      <div bind:this={cardListElement} class="card-list">
        {#each filteredCards as card, idx (card.id)}
          {@const thumbUrl = getThumbnailUrl(card)}
          {@const cardNum = formatCardNumber(card)}
          {@const rarityColor = getRarityColor(card.rarity)}
          {@const gradient = isGradientRarity(card.rarity)}
          {@const isSelected = selectedCard?.id === card.id}
          <div
            class="card-item"
            class:highlighted={highlightedIndex === idx}
            class:selected={isSelected}
            onmouseover={() => handleMouseOver(idx)}
            onclick={() => handleCardSelect(card)}
            role="option"
            aria-selected={highlightedIndex === idx}
          >
            <!-- Thumbnail (lazy-loaded via IntersectionObserver) -->
            <div class="card-thumb">
              {#if thumbUrl}
                <img
                  data-src={thumbUrl}
                  alt=""
                  class="thumb-img"
                  width="22"
                  height="30"
                />
              {:else}
                <div class="thumb-placeholder"></div>
              {/if}
            </div>

            <!-- Rarity dot -->
            <span
              class="rarity-dot"
              class:gradient-dot={gradient}
              style:background-color={gradient ? undefined : rarityColor}
              style:background-image={gradient ? `linear-gradient(135deg, var(--rarity-sar-from), var(--rarity-sar-to))` : undefined}
              title={getRarityInfo(card.rarity).label}
            ></span>

            <!-- Card info -->
            <div class="card-info">
              <span class="card-name">{card.name}</span>
              {#if cardNum}
                <span class="card-number">{cardNum}</span>
              {/if}
            </div>
          </div>
        {/each}

        {#if filteredCards.length === 0}
          <div class="no-results">No cards found</div>
        {/if}
      </div>

      <!-- Rarity legend -->
      <div class="rarity-legend">
        {#each RARITY_LEGEND as entry}
          <span class="legend-item">
            <span
              class="legend-dot"
              style:background-color={entry.colorTo ? undefined : entry.color}
              style:background-image={entry.colorTo ? `linear-gradient(135deg, ${entry.color}, ${entry.colorTo})` : undefined}
            ></span>
            <span class="legend-label">{entry.label}</span>
          </span>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .card-search-select-container {
    position: relative;
    width: 100%;
    font-family: inherit;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.6em 2.5em 0.6em 0.8em;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input);
    background-color: var(--surface-2);
    color: var(--text-primary);
    font-size: 12px;
    font-family: inherit;
    transition: all var(--transition-speed) var(--transition-fn);
  }

  .search-input:focus {
    outline: none;
    border-color: var(--accent-red);
    box-shadow: var(--focus-ring);
  }

  .clear-btn {
    position: absolute;
    right: 2.2em;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.2em 0.4em;
    font-size: 12px;
    line-height: 1;
  }

  .clear-btn:hover {
    color: var(--text-primary);
    background: transparent;
  }

  .dropdown-icon {
    position: absolute;
    right: 0.6em;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-dim);
    font-size: 0.7em;
    pointer-events: none;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 4px;
    background-color: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input);
    box-shadow: var(--shadow-md);
    z-index: 1000;
    display: flex;
    flex-direction: column;
  }

  /* Sort toggle bar */
  .sort-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--border-faint);
    flex-shrink: 0;
  }

  .sort-label {
    font-size: 10px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-right: 2px;
  }

  .sort-btn {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: var(--radius-badge);
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    font-weight: 500;
    line-height: 1.4;
  }

  .sort-btn:hover:not(.active) {
    background: var(--bg-hover);
    color: var(--text-secondary);
  }

  .sort-btn.active {
    background: rgba(232, 69, 60, 0.12);
    color: var(--accent-red);
    border-color: var(--accent-red);
  }

  /* Card list */
  .card-list {
    max-height: 300px;
    overflow-y: auto;
    flex: 1;
  }

  .card-item {
    padding: 6px 8px;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background-color var(--transition-speed) var(--transition-fn);
    border-left: 3px solid transparent;
  }

  .card-item:hover,
  .card-item.highlighted {
    background-color: var(--bg-hover);
  }

  .card-item.selected {
    border-left-color: var(--accent-red);
    background-color: rgba(232, 69, 60, 0.06);
  }

  /* Thumbnail */
  .card-thumb {
    flex-shrink: 0;
    width: 22px;
    height: 30px;
    border-radius: 2px;
    overflow: hidden;
    background-color: var(--surface-1);
  }

  .thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-placeholder {
    width: 100%;
    height: 100%;
    background: var(--surface-1);
  }

  /* Rarity dot */
  .rarity-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .gradient-dot {
    background-color: transparent;
  }

  /* Card info */
  .card-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1px;
  }

  .card-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-number {
    font-size: 10px;
    color: var(--text-muted);
  }

  .no-results {
    padding: 16px 8px;
    color: var(--text-muted);
    text-align: center;
    font-size: 12px;
  }

  /* Rarity legend */
  .rarity-legend {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border-top: 1px solid var(--border-faint);
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .legend-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-label {
    font-size: 9px;
    color: var(--text-dim);
    letter-spacing: 0.3px;
  }

  /* Scrollbar */
  .card-list::-webkit-scrollbar { width: 6px; }
  .card-list::-webkit-scrollbar-track { background: transparent; }
  .card-list::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-bg);
    border-radius: 3px;
  }
  .card-list::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-bg);
  }
</style>
