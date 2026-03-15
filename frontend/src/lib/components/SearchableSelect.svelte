<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    items?: any[];
    placeholder?: string;
    labelField?: string;
    secondaryField?: string | null;
    value?: any;
    onselect?: (item: any) => void;
  }

  let {
    items = [],
    placeholder = 'Select an item...',
    labelField = 'name',
    secondaryField = null,
    value = undefined,
    onselect
  }: Props = $props();

  let searchText = $state('');
  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);
  let inputElement: HTMLInputElement | undefined = $state();
  let dropdownElement: HTMLDivElement | undefined = $state();

  // Check if items are grouped
  const isGroupedItems = $derived.by(() => {
    return items.length > 0 && items[0]?.type === 'group';
  });

  // Flatten items if grouped
  const flattenedItems = $derived.by(() => {
    if (!isGroupedItems) return items;
    return items.flatMap((group: any) => group.items || []);
  });

  // Filter items based on search text
  const filteredItems = $derived.by(() => {
    if (!searchText.trim()) {
      return items;
    }

    const lowerSearch = searchText.toLowerCase();

    if (isGroupedItems) {
      return items
        .map((group: any) => ({
          ...group,
          items: (group.items || []).filter(
            (item: any) =>
              String(item[labelField] || '').toLowerCase().includes(lowerSearch) ||
              (secondaryField && String(item[secondaryField] || '').toLowerCase().includes(lowerSearch))
          )
        }))
        .filter((group: any) => group.items.length > 0);
    } else {
      return items.filter(
        (item: any) =>
          String(item[labelField] || '').toLowerCase().includes(lowerSearch) ||
          (secondaryField && String(item[secondaryField] || '').toLowerCase().includes(lowerSearch))
      );
    }
  });

  // Get all selectable items for keyboard navigation
  const allSelectableItems = $derived.by(() => {
    return flattenedItems.filter(
      (item: any) =>
        !searchText.trim() ||
        String(item[labelField] || '').toLowerCase().includes(searchText.toLowerCase()) ||
        (secondaryField && String(item[secondaryField] || '').toLowerCase().includes(searchText.toLowerCase()))
    );
  });

  // Get display text for selected value
  const displayText = $derived.by(() => {
    if (!value) return '';
    return `${value[labelField] || ''} ${secondaryField && value[secondaryField] ? `(${value[secondaryField]})` : ''}`.trim();
  });

  // Update searchText when value changes from outside
  $effect(() => {
    if (value && !showDropdown) {
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

  function handleItemSelect(item: any) {
    if (onselect) {
      onselect(item);
    }
    searchText = displayText;
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
      highlightedIndex = Math.min(highlightedIndex + 1, allSelectableItems.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = Math.max(highlightedIndex - 1, -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < allSelectableItems.length) {
        handleItemSelect(allSelectableItems[highlightedIndex]);
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

<div class="searchable-select-container">
  <div class="input-wrapper">
    <input
      bind:this={inputElement}
      type="text"
      {placeholder}
      value={searchText}
      class="searchable-input"
      aria-label="Search items"
    />
    {#if value}
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
      {#if isGroupedItems}
        {#each filteredItems as group (group.label)}
          {#if group.items && group.items.length > 0}
            <div class="group">
              <div class="group-label">{group.label}</div>
              {#each group.items as item, idx (item.id)}
                {@const globalIdx = allSelectableItems.indexOf(item)}
                <div
                  class="dropdown-item"
                  class:highlighted={highlightedIndex === globalIdx}
                  onmouseover={() => handleMouseOver(globalIdx)}
                  onclick={() => handleItemSelect(item)}
                  role="option"
                  aria-selected={highlightedIndex === globalIdx}
                >
                  <span class="item-label">{item[labelField]}</span>
                  {#if secondaryField}
                    <span class="item-secondary">{item[secondaryField]}</span>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      {:else}
        {#each filteredItems as item, idx (item.id)}
          <div
            class="dropdown-item"
            class:highlighted={highlightedIndex === idx}
            onmouseover={() => handleMouseOver(idx)}
            onclick={() => handleItemSelect(item)}
            role="option"
            aria-selected={highlightedIndex === idx}
          >
            <span class="item-label">{item[labelField]}</span>
            {#if secondaryField}
              <span class="item-secondary">{item[secondaryField]}</span>
            {/if}
          </div>
        {/each}
      {/if}

      {#if filteredItems.length === 0}
        <div class="no-results">No results found</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .searchable-select-container {
    position: relative;
    width: 100%;
    font-family: inherit;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .searchable-input {
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

  .searchable-input:focus {
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

  .group {
    padding: 0.4em 0;
  }

  .group-label {
    padding: 0.6em 0.8em;
    background-color: var(--bg-group-header);
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.9em;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .dropdown-item {
    padding: 0.8em;
    color: var(--text-primary);
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background-color var(--transition-speed) ease;
  }

  .dropdown-item:hover,
  .dropdown-item.highlighted {
    background-color: var(--bg-hover);
  }

  .item-label {
    font-weight: 500;
  }

  .item-secondary {
    color: var(--text-secondary);
    font-size: 0.9em;
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
