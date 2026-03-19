<script lang="ts">
  import { SearchableSelect, CardSearchSelect } from '$lib/components';
  import SetDropdownItem from '$lib/components/SetDropdownItem.svelte';
  import SetGroupHeader from '$lib/components/SetGroupHeader.svelte';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import type { PokemonSet, PokemonCard } from '$lib/types';

  interface Props {
    onsetselect?: (set: PokemonSet | null) => void;
    oncardselect?: (card: PokemonCard | null) => void;
    ongetprice?: () => void;
  }

  let { onsetselect, oncardselect, ongetprice }: Props = $props();

  let printedTotal = $derived(
    setsStore.selectedSet?.printedTotal ?? setsStore.selectedSet?.total ?? null
  );

  function handleSetSelect(item: any) {
    if (item) {
      setsStore.selectSet(item);
    } else {
      cardsStore.resetCards();
    }
    onsetselect?.(item ?? null);
  }

  function handleCardSelect(card: any) {
    if (card) {
      cardsStore.selectCard(card);
    }
    oncardselect?.(card ?? null);
  }

  function handleGetPrice() {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (card && set) {
      pricingStore.fetchCardPrice(set.id, card.id);
    }
    ongetprice?.();
  }
</script>

<div class="form-container">
  <div class="form-group">
    <label for="set-select" class="form-label">Select a Set</label>
    <SearchableSelect
      items={setsStore.groupedSetsForDropdown}
      placeholder="Search sets..."
      labelField="name"
      searchFields={['name', 'code']}
      value={setsStore.selectedSet}
      onselect={handleSetSelect}
    >
      {#snippet item(set, selected)}
        <SetDropdownItem {set} {selected} />
      {/snippet}
      {#snippet groupHeader(group)}
        <SetGroupHeader {group} />
      {/snippet}
    </SearchableSelect>
    {#if setsStore.isLoadingSets}
      <div class="loading-indicator">Loading sets...</div>
    {/if}
  </div>

  <div class="form-group">
    <label for="card-select" class="form-label">Select a Card</label>
    <CardSearchSelect
      cards={cardsStore.cardsInSet}
      placeholder="Search cards by name or number..."
      selectedCard={cardsStore.selectedCard}
      {printedTotal}
      onselect={handleCardSelect}
    />
    {#if cardsStore.isLoadingCards}
      <div class="loading-indicator">Loading cards...</div>
    {/if}
  </div>

  <button
    class="button button-primary"
    onclick={handleGetPrice}
    disabled={!setsStore.selectedSet || !cardsStore.selectedCard || pricingStore.isLoading}
    type="button"
  >
    {pricingStore.isLoading ? 'Getting Price...' : 'Get Price'}
  </button>
</div>

<style>
  .form-container {
    background-color: var(--bg-container);
    border: 1px solid var(--border-primary);
    border-radius: 8px;
    padding: 2em;
    margin-bottom: 2em;
    box-shadow: 0 2px 8px var(--shadow-light);
  }

  .form-group {
    margin-bottom: 1.5em;
  }

  .form-group:last-of-type {
    margin-bottom: 1.5em;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: var(--color-heading);
    font-size: 0.95em;
  }

  .loading-indicator {
    margin-top: 0.5em;
    padding: 0.5em;
    color: var(--text-secondary);
    font-size: 0.9em;
    font-style: italic;
  }

  .button {
    padding: 0.8em 1.6em;
    border: none;
    border-radius: 4px;
    font-size: 1em;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-speed) ease;
    font-family: inherit;
  }

  .button-primary {
    background-color: var(--color-button-primary-bg);
    color: var(--button-text-color);
    width: 100%;
  }

  .button-primary:hover:not(:disabled) {
    background-color: var(--color-button-primary-hover-bg);
    box-shadow: 0 4px 12px rgba(238, 21, 21, 0.3);
  }

  .button-primary:disabled {
    background-color: var(--button-disabled-bg);
    color: var(--button-disabled-text);
    cursor: not-allowed;
  }
</style>
