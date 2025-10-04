<script>
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let items = [];
  export let placeholder = 'Search...';
  export let labelField = 'name';
  export let secondaryField = null;
  export let value = '';
  export let disabled = false;
  
  // State
  let isFocused = false;
  let filteredItems = [];
  let displayItems = []; // Limited set of items to actually display
  let showingAllResults = true; // Whether we're showing all results or a subset
  let highlightedIndex = -1;
  let inputElement;
  let dropdownElement;
  
  const dispatch = createEventDispatcher();
  
  // Config for the dropdown
  const maxDisplayItems = 50; // Maximum number of items to display in dropdown
  
  // Filter items based on the current search value
  function filterItems() {
    console.log(`Filtering items. Items: ${items.length}, Value: '${value}'`);
    
    if (!value || !value.trim() || items.length === 0) {
      console.log('No value or no items, clearing results');
      filteredItems = [];
      displayItems = [];
      showingAllResults = true;
      return;
    }
    
    const searchLower = value.toLowerCase();
    
    // Get all items that match the search text in name field
    const matches = items.filter(item => {
      // Make sure item and labelField exist
      if (!item || !item[labelField]) return false;
      
      // Extract the base name (without variant information)
      let baseName = item[labelField];
      if (baseName.includes(' Master Ball Holo')) {
        baseName = baseName.replace(' Master Ball Holo', '');
      } else if (baseName.includes(' Poke ball Holo')) {
        baseName = baseName.replace(' Poke ball Holo', '');
      } else if (baseName.includes(' Reverse Holo')) {
        baseName = baseName.replace(' Reverse Holo', '');
      }
      
      // Check if the base name includes the search text
      return baseName.toLowerCase().includes(searchLower);
    });
    
    console.log(`Found ${matches.length} matching items for '${value}'`);
    
    // Sort results by:
    // 1. Exact base name matches first
    // 2. Starts with search text next
    // 3. Contains search text last
    // 4. Then by card number
    const sortedMatches = matches.sort((a, b) => {
      // Extract base names for both items
      let aName = a[labelField];
      let bName = b[labelField];
      
      if (aName.includes(' Master Ball Holo')) {
        aName = aName.replace(' Master Ball Holo', '');
      } else if (aName.includes(' Poke ball Holo')) {
        aName = aName.replace(' Poke ball Holo', '');
      } else if (aName.includes(' Reverse Holo')) {
        aName = aName.replace(' Reverse Holo', '');
      }
      
      if (bName.includes(' Master Ball Holo')) {
        bName = bName.replace(' Master Ball Holo', '');
      } else if (bName.includes(' Poke ball Holo')) {
        bName = bName.replace(' Poke ball Holo', '');
      } else if (bName.includes(' Reverse Holo')) {
        bName = bName.replace(' Reverse Holo', '');
      }
      
      aName = aName.toLowerCase();
      bName = bName.toLowerCase();
      
      // Exact matches first
      if (aName === searchLower && bName !== searchLower) return -1;
      if (bName === searchLower && aName !== searchLower) return 1;
      
      // Then matches that start with the search text
      if (aName.startsWith(searchLower) && !bName.startsWith(searchLower)) return -1;
      if (bName.startsWith(searchLower) && !aName.startsWith(searchLower)) return 1;
      
      // If base names are the same, sort by card number
      if (aName === bName) {
        // Convert to numbers and sort
        const aNum = parseInt(a.num || '0', 10);
        const bNum = parseInt(b.num || '0', 10);
        return aNum - bNum;
      }
      
      // Then sort alphabetically by base name
      return aName.localeCompare(bName);
    });
    
    filteredItems = sortedMatches;
    
    // If we have too many matches, limit the display but keep all for filtering
    displayItems = filteredItems.slice(0, maxDisplayItems);
    showingAllResults = displayItems.length === filteredItems.length;
    
    console.log(`Done filtering. Found ${filteredItems.length} matches, displaying ${displayItems.length}`);
    console.log('showingAllResults:', showingAllResults);
    console.log('isFocused:', isFocused);
    
    // Reset highlighted index when filtered items change
    highlightedIndex = -1;
  }
  
  // Update filtered items when items or value changes
  $: {
    console.log(`Items: ${items.length}, Value: ${value}`);
    filterItems();
  }
  
  // Functions
  // Make sure to handle focus/blur properly
  function handleFocus() {
    console.log('Input focused');
    isFocused = true;
  }
  
  function handleBlur(event) {
    console.log('Input blur event');
    // Short delay to allow click to register on dropdown items
    setTimeout(() => {
      // Don't blur if clicking inside the dropdown
      if (dropdownElement && dropdownElement.contains(event.relatedTarget)) {
        console.log('Clicked inside dropdown, keeping focus');
        return;
      }
      console.log('Losing focus');
      isFocused = false;
    }, 100);
  }
  
  function handleKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, filteredItems.length - 1);
        scrollToHighlighted();
        break;
      case 'ArrowUp':
        event.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        scrollToHighlighted();
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
          selectItem(filteredItems[highlightedIndex]);
        }
        break;
      case 'Escape':
        inputElement.blur();
        isFocused = false;
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
  
  function selectItem(item) {
    value = item[labelField];
    isFocused = false;
    dispatch('select', item);
  }
  
  function getDisplayText(item) {
    if (!item) return '';
    
    let displayText = item[labelField];
    
    // Add variant information if available
    let variantInfo = [];
    
    // Check if it's a holographic variant
    if (displayText.includes('Master Ball Holo')) {
      variantInfo.push('Master Ball Holo');
      displayText = displayText.replace(' Master Ball Holo', '');
    } else if (displayText.includes('Poke ball Holo')) {
      variantInfo.push('Poké Ball Holo');
      displayText = displayText.replace(' Poke ball Holo', '');
    } else if (displayText.includes('Reverse Holo')) {
      variantInfo.push('Reverse Holo');
      displayText = displayText.replace(' Reverse Holo', '');
    } else if (displayText.endsWith(' ex')) {
      variantInfo.push('EX');
    }
    
    // Check if it's a secret rare
    if (item.secret === true) {
      variantInfo.push('Secret Rare');
    } else if (item.rarity) {
      variantInfo.push(item.rarity);
    }
    
    // Add card number
    if (item.num) {
      variantInfo.push(`#${item.num}`);
    }
    
    // Combine all the information
    if (variantInfo.length > 0) {
      displayText += ` (${variantInfo.join(' | ')})`;
    }
    
    return displayText;
  }
  
  function handleInput(event) {
    value = event.target.value;
    // Trigger filtering immediately
    filterItems();
    // Ensure the input is focused when typing
    if (!isFocused) {
      isFocused = true;
    }
    dispatch('input', event);
  }
</script>

<div class="searchable-input">
  <div class="input-container">
    <input
      bind:this={inputElement}
      type="text"
      bind:value
      on:input={handleInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
      placeholder={placeholder}
      autocomplete="off"
      {disabled}
      id="cardName"
    />
    {#if value && filteredItems.length > 0}
      <div class="icon">
        {#if isFocused}
          <span>▲</span>
        {:else}
          <span>▼</span>
        {/if}
      </div>
    {/if}
  </div>
  
  {#if isFocused && value && filteredItems.length > 0}
    <div class="dropdown" bind:this={dropdownElement}>
      <div class="debug-info" style="font-size: 10px; color: #999; padding: 2px; text-align: center;">
        Items: {filteredItems.length}, Focused: {isFocused ? 'yes' : 'no'}, Value: '{value}'</div>
      {#each displayItems as item, index}
        <div 
          class="item item-{index} {highlightedIndex === index ? 'highlighted' : ''}"
          on:mousedown={() => selectItem(item)}
          on:mouseover={() => highlightedIndex = index}
        >
          {getDisplayText(item)}
        </div>
      {/each}
      
      {#if !showingAllResults}
        <div class="results-info">
          Showing {displayItems.length} of {filteredItems.length} results. Keep typing to narrow down.
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .searchable-input {
    position: relative;
    width: 100%;
  }
  
  .input-container {
    position: relative;
    width: 100%;
  }
  
  input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    padding-right: 2rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 1rem;
    transition: border-color 0.3s ease;
  }
  
  input:focus {
    outline: none;
    border-color: #3c5aa6;
    box-shadow: 0 0 0 2px rgba(60, 90, 166, 0.2);
  }
  
  .icon {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #666;
    pointer-events: none;
  }
  
  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    max-height: 300px;
    overflow-y: auto;
    background-color: white;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 4px 4px;
    z-index: 10;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    margin-top: -1px;
  }
  
  .item {
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
    border-bottom: 1px solid #f0f0f0;
  }
  
  .item:last-child {
    border-bottom: none;
  }
  
  .item:hover, .highlighted {
    background-color: #f0f0f0;
  }
  
  .results-info {
    padding: 0.5rem 0.75rem;
    color: #666;
    font-style: italic;
    font-size: 0.8rem;
    text-align: center;
    background-color: #f9f9f9;
    border-top: 1px solid #eee;
  }
</style>