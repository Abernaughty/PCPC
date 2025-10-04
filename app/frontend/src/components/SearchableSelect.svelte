<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { uiLogger } from '../services/loggerService';
  
  // Props
  export let items = [];
  export let placeholder = 'Search...';
  export let labelField = 'name';
  export let secondaryField = null;
  export let value = null;
  
  // State
  let searchText = '';
  let showDropdown = false;
  let filteredItems = [];
  let flattenedItems = []; // Flattened list of all items for keyboard navigation
  let highlightedIndex = -1;
  let inputElement;
  let dropdownElement;
  let isGroupedItems = false; // Initialize isGroupedItems
  let allSelectableItems = []; // Initialize allSelectableItems
  
  const dispatch = createEventDispatcher();
  
  // Update searchText when value changes and user is not typing
  $: if (value) {
    if (!inputElement || !inputElement.matches(':focus')) {
      searchText = getDisplayText(value);
    }
  }
  
  // Check if items are grouped (contains objects with type: 'group')
  $: {
    const hasGroupedItems = Array.isArray(items) && items.some(item => item && item.type === 'group');
    isGroupedItems = hasGroupedItems;
  }
  
  // Flatten grouped items for easier filtering and navigation
  $: {
    try {
      if (isGroupedItems) {
        flattenedItems = [];
        
        if (Array.isArray(items)) {
          items.forEach(group => {
            if (group && group.type === 'group' && Array.isArray(group.items)) {
              group.items.forEach(item => {
                if (item) {
                  flattenedItems.push({
                    ...item,
                    _groupLabel: group.label // Store the group label for reference
                  });
                }
              });
            }
          });
        }
      } else {
        // For non-grouped items, just copy the array
        flattenedItems = Array.isArray(items) ? [...items] : [];
      }
    } catch (error) {
      uiLogger.error('Error flattening items in SearchableSelect', { error });
      flattenedItems = [];
    }
  }
  
  // Update filtered items when items or searchText changes
  $: {
    try {
      if (searchText && searchText.trim() !== '' && (!value || searchText !== getDisplayText(value))) {
        const searchLower = searchText.toLowerCase();
        
        if (isGroupedItems) {
          // Filter the flattened items first
          const filteredFlat = flattenedItems.filter(item => {
            if (!item || !item[labelField]) return false;
            
            const primaryMatch = item[labelField].toLowerCase().includes(searchLower);
            const secondaryMatch = secondaryField && item[secondaryField] && 
                                 item[secondaryField].toLowerCase().includes(searchLower);
            return primaryMatch || secondaryMatch;
          });
          
          // Group the filtered items back into their expansions
          const groupedFiltered = {};
          filteredFlat.forEach(item => {
            const groupLabel = item._groupLabel || 'Other';
            if (!groupedFiltered[groupLabel]) {
              groupedFiltered[groupLabel] = [];
            }
            groupedFiltered[groupLabel].push(item);
          });
          
          // Convert back to the group format
          filteredItems = Object.keys(groupedFiltered).map(label => ({
            type: 'group',
            label,
            items: groupedFiltered[label]
          }));
        } else {
          // Regular filtering for non-grouped items
          filteredItems = Array.isArray(items) ? items.filter(item => {
            if (!item || !item[labelField]) return false;
            
            const primaryMatch = item[labelField].toLowerCase().includes(searchLower);
            const secondaryMatch = secondaryField && item[secondaryField] && 
                                 item[secondaryField].toLowerCase().includes(searchLower);
            return primaryMatch || secondaryMatch;
          }) : [];
        }
      } else {
        // No search text, show all items
        // Make a defensive copy to avoid reference issues
        filteredItems = Array.isArray(items) ? 
          (isGroupedItems ? 
            items.map(group => ({...group, items: [...(group.items || [])]})) : 
            [...items]
          ) : [];
      }
      
      // Reset highlighted index whenever items change
      highlightedIndex = -1;
    } catch (error) {
      uiLogger.error('Error filtering items in SearchableSelect', { error });
      filteredItems = [];
      highlightedIndex = -1;
    }
  }
  
  // Get all selectable items in a flat array for keyboard navigation
  $: {
    try {
      if (isGroupedItems) {
        // For grouped items, flatten all groups
        allSelectableItems = [];
        if (Array.isArray(filteredItems)) {
          filteredItems.forEach(group => {
            if (group && group.items && Array.isArray(group.items)) {
              allSelectableItems.push(...group.items);
            }
          });
        }
      } else {
        // For non-grouped items, just use the filtered items
        allSelectableItems = Array.isArray(filteredItems) ? filteredItems : [];
      }
    } catch (error) {
      uiLogger.error('Error getting selectable items in SearchableSelect', { error });
      allSelectableItems = [];
    }
  }
  
  function handleFocus() {
    showDropdown = true;
  }
  
  function closeDropdown() {
    showDropdown = false;
  }
  
  function handleKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!showDropdown) showDropdown = true;
        highlightedIndex = Math.min(highlightedIndex + 1, allSelectableItems.length - 1);
        scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!showDropdown) showDropdown = true;
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        scrollToHighlighted();
        break;
      case 'Enter':
        if (showDropdown && highlightedIndex >= 0 && highlightedIndex < allSelectableItems.length) {
          handleItemSelect(allSelectableItems[highlightedIndex]);
        }
        break;
      case 'Escape':
        closeDropdown();
        break;
    }
  }
  
  function scrollToHighlighted() {
    if (highlightedIndex >= 0 && dropdownElement) {
      const highlightedEl = dropdownElement.querySelector(`.item-${highlightedIndex}`);
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }
  
  function handleItemSelect(item) {
    if (!item) return;
    
    // Update the internal value and search text
    value = item;
    searchText = getDisplayText(item);
    
    // Close dropdown
    closeDropdown();
    
    // Dispatch the select event
    dispatch('select', item);
  }
  
  function getDisplayText(item) {
    if (!item) return '';
    if (secondaryField && item[secondaryField]) {
      return `${item[labelField]} (${item[secondaryField]})`;
    }
    return item[labelField];
  }
  
  function handleInput() {
    // Open dropdown when typing
    showDropdown = true;
    
    // If text changed and user had a selection, clear it
    if (value && searchText !== getDisplayText(value)) {
      value = null;
      dispatch('select', null);
    }
  }
  
  // Function to be called from outside to clear selection
  export function clearSelection() {
    value = null;
    searchText = '';
    showDropdown = true;
    filteredItems = [...items];
    dispatch('select', null);
    
    // Focus the input
    if (inputElement) {
      inputElement.focus();
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

<div class="searchable-select">
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
    <span class="dropdown-icon">{showDropdown ? '▲' : '▼'}</span>
  </div>
  
  {#if showDropdown}
    <div class="dropdown" bind:this={dropdownElement}>
      {#if isGroupedItems}
        {#if filteredItems.length === 0}
          <div class="no-results">No results found</div>
        {:else}
          {#each filteredItems as group, groupIndex}
            {#if group.type === 'group' && group.items && group.items.length > 0}
              <div class="group-header">{group.label}</div>
              {#each group.items as item, itemIndex}
                <!-- Calculate the global index for this item -->
                <div
                  class="item item-{allSelectableItems.indexOf(item)} indented {highlightedIndex === allSelectableItems.indexOf(item) ? 'highlighted' : ''}"
                  on:click={() => handleItemSelect(item)}
                  on:keydown={e => e.key === 'Enter' && handleItemSelect(item)}
                  on:mouseover={() => highlightedIndex = allSelectableItems.indexOf(item)}
                  on:focus={() => highlightedIndex = allSelectableItems.indexOf(item)}
                  role="option"
                  tabindex="0"
                  aria-selected={highlightedIndex === allSelectableItems.indexOf(item)}
                >
                  <span class="label">
                    {item[labelField]}
                    {#if secondaryField && item[secondaryField]}
                      <span class="secondary">({item[secondaryField]})</span>
                    {/if}
                  </span>
                </div>
              {/each}
            {/if}
          {/each}
        {/if}
      {:else}
        {#if filteredItems.length === 0}
          <div class="no-results">No results found</div>
        {:else}
          {#each filteredItems as item, index}
            <div
              class="item item-{index} {highlightedIndex === index ? 'highlighted' : ''}"
              on:click={() => handleItemSelect(item)}
              on:keydown={e => e.key === 'Enter' && handleItemSelect(item)}
              on:mouseover={() => highlightedIndex = index}
              on:focus={() => highlightedIndex = index}
              role="option"
              tabindex="0"
              aria-selected={highlightedIndex === index}
            >
              <span class="label">
                {item[labelField]}
                {#if secondaryField && item[secondaryField]}
                  <span class="secondary">({item[secondaryField]})</span>
                {/if}
              </span>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style>
  .searchable-select {
    position: relative;
    width: 100%;
  }
  
  .input-wrapper {
    position: relative;
  }
  
  input {
    width: 100%;
    padding: 0.5rem;
    padding-right: 3.5rem;
    font-size: 1rem;
    border: 1px solid var(--border-input);
    border-radius: 4px;
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
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
  
  .dropdown-icon {
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
    max-height: 400px; /* Increased max-height */
    overflow-y: auto;
    background-color: var(--bg-dropdown);
    border: 1px solid var(--border-primary);
    border-radius: 0 0 4px 4px;
    z-index: 10;
    box-shadow: 0 4px 8px var(--shadow-light);
  }
  
  .group-header {
    padding: 0.5rem;
    font-weight: bold;
    background-color: var(--bg-group-header);
    color: var(--color-pokemon-blue);
    border-bottom: 1px solid var(--border-primary);
    position: sticky;
    top: 0;
    z-index: 1;
  }
  
  .item {
    padding: 0.5rem;
    cursor: pointer;
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-secondary);
  }
  
  .indented {
    padding-left: 1.5rem;
    position: relative;
  }
  
  .item:last-child {
    border-bottom: none;
  }
  
  .item:hover, .highlighted {
    background-color: var(--bg-hover);
    color: var(--color-pokemon-blue);
  }
  
  .label {
    color: inherit; /* Use the parent element's color */
  }
  
  .secondary {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-left: 0.25rem;
  }
  
  .no-results {
    padding: 0.5rem;
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
  }
</style>
