<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { uiLogger } from '../services/loggerService';
  
  // Props
  export let cards = [];  // This will be the list of cards from the selected set
  export let placeholder = 'Search for a card...';
  export let selectedCard = null;  // Two-way binding
  
  // Local state
  let searchText = '';
  let showDropdown = false;
  let filteredCards = [];
  let highlightedIndex = -1;
  let inputElement;
  let dropdownElement;
  
  // Set up event dispatcher
  const dispatch = createEventDispatcher();
  
  // Function to generate display text for a card (with number if available)
  function getCardDisplayText(card) {
    if (!card) return '';
    return card.num ? `${card.name} (${card.num})` : card.name;
  }
  
  // Watch for changes to selectedCard and update searchText only when input doesn't have focus
  $: if (selectedCard && selectedCard.name && inputElement && !inputElement.matches(':focus')) {
    searchText = getCardDisplayText(selectedCard);
  }
  
  // Update filtered cards when cards or searchText changes
  $: {
    if (searchText && searchText.trim() !== '') {
      const search = searchText.toLowerCase().trim();
      
      filteredCards = cards.filter(card => {
        // Skip cards without a name
        if (!card || !card.name) return false;
        
        // Match on name
        const nameMatch = card.name.toLowerCase().includes(search);
        
        // Also match on card number if available
        const numMatch = card.num && card.num.toLowerCase().includes(search);
        
        return nameMatch || numMatch;
      });
      
      // Always show dropdown when searching
      if (inputElement && inputElement.matches(':focus')) {
        showDropdown = true;
      }
    } else {
      // When empty, show all cards (up to a reasonable limit)
      filteredCards = [...cards].slice(0, 500); // Increased from 100 to 500 to match backend pagination
    }
    
    // Reset highlight when results change
    highlightedIndex = -1;
  }
  
  // Handle input changes
  function handleInput() {
    showDropdown = true;
    
    // If text no longer matches the selected card, clear the selection immediately
    if (selectedCard && searchText !== getCardDisplayText(selectedCard)) {
      selectedCard = null;
      dispatch('select', null);
    }
  }
  
  // Handle focus on the input
  function handleFocus() {
    showDropdown = true;
  }
  
  // Handle selection of a card
  function handleSelect(card) {
    if (!card) return;
    
    selectedCard = card;
    searchText = getCardDisplayText(card);
    
    // Close dropdown
    closeDropdown();
    dispatch('select', card);
    
    // Log user interaction for analytics
    uiLogger.logInteraction('card_selected', { cardName: card.name, cardNum: card.num });
  }
  
  // Close the dropdown
  function closeDropdown() {
    showDropdown = false;
  }
  
  // Handle keyboard navigation
  function handleKeydown(event) {
    if (!showDropdown) return;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredCards.length - 1);
        scrollToHighlighted();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        scrollToHighlighted();
        break;
        
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filteredCards.length) {
          handleSelect(filteredCards[highlightedIndex]);
        }
        break;
        
      case 'Escape':
        closeDropdown();
        break;
        
      case 'Backspace':
        // Special case for backspace - ensure dropdown stays open
        if (searchText.length <= 1) {
          setTimeout(() => {
            showDropdown = true;
          }, 0);
        }
        break;
    }
  }
  
  // Scroll to highlighted item in the dropdown
  function scrollToHighlighted() {
    if (highlightedIndex >= 0 && dropdownElement) {
      const highlightedEl = dropdownElement.querySelector(`.card-item-${highlightedIndex}`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }
  
  // Function to clear the current selection (to be called from parent)
  export function clearSelection() {
    selectedCard = null;
    searchText = '';
    dispatch('select', null);
    
    // Keep dropdown closed after clear unless user focuses the input
    showDropdown = false;
    
    // Optional: focus the input after clearing
    if (inputElement) {
      inputElement.focus();
    }
  }
  
  // Focus the input after clearing and show dropdown
  export function clearAndFocus() {
    clearSelection();
    
    // Focus the input
    if (inputElement) {
      inputElement.focus();
      
      // Ensure dropdown is shown
      setTimeout(() => {
        showDropdown = true;
        
        // Force refilter with empty search
        searchText = '';
        filteredCards = [...cards].slice(0, 500); // Increased from 100 to 500 to match backend pagination
      }, 10);
    }
  }
  
  // Handle clicks outside the component to close the dropdown
  function handleOutsideClick(event) {
    if (showDropdown && inputElement && !dropdownElement.contains(event.target) && !inputElement.contains(event.target)) {
      closeDropdown();
    }
  }
  
  // Set up event listeners on mount
  onMount(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  });
</script>

<div class="card-search">
  <div class="input-wrapper">
    <input
      type="text"
      bind:this={inputElement}
      bind:value={searchText}
      on:input={handleInput}
      on:focus={handleFocus}
      on:keydown={handleKeydown}
      placeholder={placeholder}
      autocomplete="off"
    />
    {#if searchText}
      <span 
        class="clear-icon" 
        on:click|stopPropagation={() => clearSelection()}
        on:keydown={e => e.key === 'Enter' && clearSelection()}
        title="Clear selection"
        role="button"
        tabindex="0"
      >
        <div class="clear-icon-circle">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="white"/>
          </svg>
        </div>
      </span>
    {/if}
    <span class="icon">{showDropdown ? '▲' : '▼'}</span>
  </div>
  
  {#if showDropdown}
    <div class="dropdown" bind:this={dropdownElement}>
      {#if filteredCards.length === 0}
        <div class="no-results">No matching cards found</div>
      {:else}
        {#each filteredCards as card, index}
          <div
            class="card-item card-item-{index} {highlightedIndex === index ? 'highlighted' : ''}"
            on:click={() => handleSelect(card)}
            on:keydown={e => e.key === 'Enter' && handleSelect(card)}
            on:mouseover={() => highlightedIndex = index}
            on:focus={() => highlightedIndex = index}
            role="option"
            tabindex="0"
            aria-selected={highlightedIndex === index}
          >
            <div class="card-info">
              <span class="card-name">
                {card.name}
                {#if card.num}
                  <span class="card-num">({card.num})</span>
                {/if}
              </span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .card-search {
    position: relative;
    width: 100%;
  }
  
  .input-wrapper {
    position: relative;
  }
  
  input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    padding-right: 3.5rem;
    border: 1px solid var(--border-input);
    border-radius: 4px;
    font-size: 1rem;
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
    transition: border-color 0.3s ease;
  }
  
  .clear-icon {
    position: absolute;
    right: 2.5rem; /* Position it to the left of the dropdown arrow - increased spacing */
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-icon-circle {
    background-color: var(--color-pokemon-red);
    border-radius: 50%;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-sizing: border-box;
    transition: background-color 0.2s ease;
  }

  .clear-icon:hover .clear-icon-circle {
    background-color: var(--color-pokemon-red-dark);
  }
  
  input:focus {
    outline: none;
    border-color: var(--border-focus);
    box-shadow: 0 0 0 2px rgba(60, 90, 166, 0.2);
  }
  
  .icon {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-secondary);
    pointer-events: none;
  }
  
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
    background-color: var(--bg-dropdown);
    border: 1px solid var(--border-primary);
    border-top: none;
    border-radius: 0 0 4px 4px;
    z-index: 10;
    box-shadow: 0 4px 8px var(--shadow-medium);
    margin-top: -1px;
  }
  
  .card-item {
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border-secondary);
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.15s ease;
    color: var(--text-primary);
  }
  
  .card-item:last-child {
    border-bottom: none;
  }
  
  .card-item:hover, .highlighted {
    background-color: var(--bg-hover);
    color: var(--color-pokemon-blue);
  }
  
  .card-info {
    display: flex;
    width: 100%;
  }
  
  .card-name {
    font-weight: 500;
    color: inherit;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .card-num {
    font-weight: normal;
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-left: 4px;
  }
  
  .no-results {
    padding: 0.75rem;
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
  }
</style>
