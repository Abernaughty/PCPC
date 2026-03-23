<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  interface Props {
    items?: any[]; placeholder?: string; labelField?: string; secondaryField?: string | null; searchFields?: string[]; value?: any; onselect?: (item: any) => void; item?: Snippet<[any, boolean]>; groupHeader?: Snippet<[any]>;
  }

  let { items = [], placeholder = 'Select an item...', labelField = 'name', secondaryField = null, searchFields, value = undefined, onselect, item: itemSnippet, groupHeader: groupHeaderSnippet }: Props = $props();

  let searchText = $state('');
  let showDropdown = $state(false);
  let highlightedIndex = $state(-1);
  let inputElement: HTMLInputElement | undefined = $state();
  let dropdownElement: HTMLDivElement | undefined = $state();

  const resolvedSearchFields = $derived.by(() => { if (searchFields && searchFields.length > 0) return searchFields; const fields = [labelField]; if (secondaryField) fields.push(secondaryField); return fields; });
  const isGroupedItems = $derived.by(() => items.length > 0 && items[0]?.type === 'group');
  const flattenedItems = $derived.by(() => { if (!isGroupedItems) return items; return items.flatMap((group: any) => group.items || []); });

  function matchesSearch(item: any, lowerSearch: string): boolean { return resolvedSearchFields.some((field) => { const val = item[field]; return val != null && String(val).toLowerCase().includes(lowerSearch); }); }

  const filteredItems = $derived.by(() => {
    if (!searchText.trim()) return items;
    const lowerSearch = searchText.toLowerCase();
    if (isGroupedItems) { return items.map((group: any) => ({ ...group, items: (group.items || []).filter((item: any) => matchesSearch(item, lowerSearch)) })).filter((group: any) => group.items.length > 0); }
    else { return items.filter((item: any) => matchesSearch(item, lowerSearch)); }
  });

  const allSelectableItems = $derived.by(() => { const lowerSearch = searchText.trim().toLowerCase(); if (!lowerSearch) return flattenedItems; return flattenedItems.filter((item: any) => matchesSearch(item, lowerSearch)); });

  const displayText = $derived.by(() => { if (!value) return ''; return `${value[labelField] || ''} ${secondaryField && value[secondaryField] ? `(${value[secondaryField]})` : ''}`.trim(); });

  // Sync searchText with value: show display text when selected, clear when value is null
  $effect(() => {
    if (value && !showDropdown) {
      searchText = displayText;
    } else if (!value) {
      searchText = '';
    }
  });

  $effect(() => {
    if (!showDropdown) return;
    const handleOutsideClick = (event: MouseEvent) => { if (dropdownElement && inputElement && !dropdownElement.contains(event.target as Node) && !inputElement.contains(event.target as Node)) { showDropdown = false; highlightedIndex = -1; } };
    document.addEventListener('click', handleOutsideClick);
    return () => { document.removeEventListener('click', handleOutsideClick); };
  });

  function handleInputClick() { if (!showDropdown) showDropdown = true; highlightedIndex = -1; }
  function handleInputChange(e: Event) { const target = e.target as HTMLInputElement; searchText = target.value; showDropdown = true; highlightedIndex = -1; }
  function handleInputFocus() { showDropdown = true; }
  function handleItemSelect(item: any) { onselect?.(item); searchText = displayText; showDropdown = false; highlightedIndex = -1; }
  function handleClear(e: MouseEvent) { e.stopPropagation(); onselect?.(null); searchText = ''; showDropdown = true; highlightedIndex = -1; inputElement?.focus(); }
  function handleKeyDown(e: KeyboardEvent) { if (!showDropdown && e.key !== 'ArrowDown' && e.key !== 'Enter') return; if (e.key === 'ArrowDown') { e.preventDefault(); showDropdown = true; highlightedIndex = Math.min(highlightedIndex + 1, allSelectableItems.length - 1); } else if (e.key === 'ArrowUp') { e.preventDefault(); highlightedIndex = Math.max(highlightedIndex - 1, -1); } else if (e.key === 'Enter') { e.preventDefault(); if (highlightedIndex >= 0 && highlightedIndex < allSelectableItems.length) handleItemSelect(allSelectableItems[highlightedIndex]); } else if (e.key === 'Escape') { e.preventDefault(); showDropdown = false; highlightedIndex = -1; } }
  function handleMouseOver(index: number) { highlightedIndex = index; }

  onMount(() => { if (inputElement) { inputElement.addEventListener('click', handleInputClick); inputElement.addEventListener('input', handleInputChange); inputElement.addEventListener('focus', handleInputFocus); inputElement.addEventListener('keydown', handleKeyDown); } return () => { if (inputElement) { inputElement.removeEventListener('click', handleInputClick); inputElement.removeEventListener('input', handleInputChange); inputElement.removeEventListener('focus', handleInputFocus); inputElement.removeEventListener('keydown', handleKeyDown); } }; });
</script>

<div class="searchable-select-container">
  <div class="input-wrapper">
    <input bind:this={inputElement} type="text" {placeholder} value={searchText} class="searchable-input" aria-label="Search items" />
    {#if value}<button onclick={handleClear} class="clear-button" aria-label="Clear selection" type="button">&#x2715;</button>{/if}
    <span class="dropdown-icon">&#x25BC;</span>
  </div>

  {#if showDropdown}
    <div bind:this={dropdownElement} class="dropdown">
      {#if isGroupedItems}
        {#each filteredItems as group (group.label)}
          {#if group.items && group.items.length > 0}
            <div class="group">
              {#if groupHeaderSnippet}{@render groupHeaderSnippet(group)}{:else}<div class="group-label">{group.label}</div>{/if}
              {#each group.items as groupItem, idx (groupItem.id)}
                {@const globalIdx = allSelectableItems.indexOf(groupItem)}
                {@const isHighlighted = highlightedIndex === globalIdx}
                <div class="dropdown-item" class:highlighted={isHighlighted} class:selected={value?.id === groupItem.id} onmouseover={() => handleMouseOver(globalIdx)} onclick={() => handleItemSelect(groupItem)} role="option" aria-selected={isHighlighted}>
                  {#if itemSnippet}{@render itemSnippet(groupItem, value?.id === groupItem.id)}{:else}<span class="item-label">{groupItem[labelField]}</span>{#if secondaryField}<span class="item-secondary">{groupItem[secondaryField]}</span>{/if}{/if}
                </div>
              {/each}
            </div>
          {/if}
        {/each}
      {:else}
        {#each filteredItems as flatItem, idx (flatItem.id)}
          {@const isHighlighted = highlightedIndex === idx}
          <div class="dropdown-item" class:highlighted={isHighlighted} class:selected={value?.id === flatItem.id} onmouseover={() => handleMouseOver(idx)} onclick={() => handleItemSelect(flatItem)} role="option" aria-selected={isHighlighted}>
            {#if itemSnippet}{@render itemSnippet(flatItem, value?.id === flatItem.id)}{:else}<span class="item-label">{flatItem[labelField]}</span>{#if secondaryField}<span class="item-secondary">{flatItem[secondaryField]}</span>{/if}{/if}
          </div>
        {/each}
      {/if}
      {#if filteredItems.length === 0 || (isGroupedItems && filteredItems.every((g: any) => !g.items || g.items.length === 0))}<div class="no-results">No results found</div>{/if}
    </div>
  {/if}
</div>

<style>
  .searchable-select-container { position: relative; width: 100%; font-family: inherit; }
  .input-wrapper { position: relative; display: flex; align-items: center; }
  .searchable-input { width: 100%; padding: 0.6em 2.5em 0.6em 0.8em; border: 1px solid var(--border-subtle); border-radius: var(--radius-input, 6px); background-color: var(--surface-2); color: var(--text-primary); font-size: var(--fs-body); font-family: inherit; transition: border-color var(--transition-speed, 0.2s) ease, box-shadow var(--transition-speed, 0.2s) ease; }
  .searchable-input:focus { outline: none; border-color: var(--accent-red); box-shadow: var(--focus-ring); }
  .clear-button { position: absolute; right: 2.2em; top: 50%; transform: translateY(-50%); background-color: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 0.2em 0.4em; font-size: 1.2em; transition: color var(--transition-speed, 0.2s) ease; }
  .clear-button:hover { color: var(--text-primary); }
  .dropdown-icon { position: absolute; right: 0.6em; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8em; pointer-events: none; }
  .dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 4px; background-color: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-input, 6px); box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.4)); z-index: 1000; max-height: 340px; overflow-y: auto; }
  .group-label { padding: 8px 12px; background-color: var(--surface-1); color: var(--text-muted); font-weight: 500; font-size: var(--fs-badge); text-transform: uppercase; letter-spacing: 0.5px; position: sticky; top: 0; z-index: 1; }
  .dropdown-item { padding: 0; color: var(--text-primary); cursor: pointer; transition: background-color var(--transition-speed, 0.2s) ease; }
  .dropdown-item:hover, .dropdown-item.highlighted { background-color: var(--bg-hover, rgba(255, 255, 255, 0.04)); }
  .dropdown-item.selected { border-left: 3px solid var(--accent-red); }
  .item-label { font-weight: 500; font-size: var(--fs-body); padding: 8px 12px; display: inline; }
  .item-secondary { color: var(--text-muted); font-size: var(--fs-badge); padding-right: 12px; }
  .no-results { padding: 16px 12px; color: var(--text-muted); text-align: center; font-size: var(--fs-body); }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--surface-2); }
  ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb-bg, var(--surface-1)); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover-bg, var(--text-dim)); }
  @media (max-width: 768px) { .searchable-input { padding: 0.7em 2.5em 0.7em 0.8em; font-size: 14px; min-height: 44px; } .dropdown { max-height: 50vh; } }
</style>