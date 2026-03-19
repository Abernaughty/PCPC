<script lang="ts">
  import { onMount } from 'svelte';
  import type { PokemonCard } from '$lib/types';

  interface Props {
    cards?: PokemonCard[];
    placeholder?: string;
    selectedCard?: PokemonCard;
    onselect?: (card: PokemonCard | null) => void;
  }

  let {
    cards = [],
    placeholder = 'Search cards...',
    selectedCard = undefined,
    onselect
  }: Props = $props();

  let searchText = $state('');
  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);
  let inputElement: HTMLInputElement | undefined = $state();
  let dropdownElement: HTMLDivElement | undefined = $state();

  // Filter cards based on search
  const filteredCards = $derived.by(() => {
    if (!searchText.trim()) return cards;

    const lowerSearch = searchText.toLowerCase();
    return cards.filter((card) => {
      const name = String(card.name || '').toLowerCase();
      const number = String(card.number || card.cardNumber || '').toLowerCase();
      return name.includes(lowerSearch) || number.includes(lowerSearch);
    });
  });

  // Get display text for selected card
  const displayText = $derived.by(() => {
    if (!selectedCard) return '';
    const num = selectedCard.number || selectedCard.cardNumber || '';
    return num ? `${selectedCard.name} (#${num})` : selectedCard.name;
  });

  // Update searchText when selectedCard changes from outside
  // Handles both selecting a card (show its name) and clearing (empty the input)
  $effect(() => {
    if (!showDropdown) {
      searchText = displayText;
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
    showDropdown = !showDropdown;
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
        class="clear-button"
        aria-label="Clear selection"
        type="button"
      >
        ✕
      </button>
    {/if}
    <span class="dropdown-icon">▼</span>
  </div>

  {#if showDropdown}
    <div bind:this={dropdownElement} class="dropdown">
      {#each filteredCards as card, idx (card.id)}
        <div
          class="card-item"
          class:highlighted={highlightedIndex === idx}
          onmouseover={() => handleMouseOver(idx)}
          onclick={() => handleCardSelect(card)}
          role="option"
          aria-selected={highlightedIndex === idx}
        >
          <span class="card-name">{card.name}</span>
          {#if card.number || card.cardNumber}
            <span class="card-number">#{card.number || card.cardNumber}</span>
          {/if}
        </div>
      {/each}

      {#if filteredCards.length === 0}
        <div class="no-results">No cards found</div>
      {/if}
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
    border: 1px solid var(--border-input);
    border-radius: 4px;
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
    font-size: 1em;
    font-family: inherit;
    transition: all var(--transition-speed) ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 3px var(--focus-ring-color);
  }

  .clear-button {
    position: absolute;
    right: 2.2em;
    top: 50%;
    transform: translateY(-50%);
    background-color: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0.2em 0.4em;
    font-size: 1.2em;
    transition: color var(--transition-speed) ease;
  }

  .clear-button:hover {
    color: var(--text-primary);
  }

  .dropdown-icon {
    position: absolute;
    right: 0.6em;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    font-size: 0.8em;
    pointer-events: none;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.4em;
    background-color: var(--bg-dropdown);
    border: 1px solid var(--border-input);
    border-radius: 4px;
    box-shadow: 0 4px 12px var(--shadow-medium);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
  }

  .card-item {
    padding: 0.8em;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background-color var(--transition-speed) ease;
  }

  .card-item:hover,
  .card-item.highlighted {
    background-color: var(--bg-hover);
  }

  .card-name {
    font-weight: 500;
    flex: 1;
  }

  .card-number {
    color: var(--text-secondary);
    font-size: 0.9em;
    margin-left: 0.5em;
  }

  .no-results {
    padding: 1em 0.8em;
    color: var(--text-muted);
    text-align: center;
    font-size: 0.9em;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: var(--bg-dropdown);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-bg);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-bg);
  }
</style>
