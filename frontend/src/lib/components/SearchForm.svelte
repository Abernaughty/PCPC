<script lang="ts">
  import { SearchableSelect, CardSearchSelect } from '$lib/components';
  import SetDropdownItem from '$lib/components/SetDropdownItem.svelte';
  import SetGroupHeader from '$lib/components/SetGroupHeader.svelte';
  import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import type { PokemonSet, PokemonCard } from '$lib/types';

  interface Props {
    onsetselect?: (set: PokemonSet | null) => void;
    oncardselect?: (card: PokemonCard | null) => void;
    /** Called after pricing has been fetched, with the card/set info for recording */
    onpricefetched?: (info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string }) => void;
  }

  let { onsetselect, oncardselect, onpricefetched }: Props = $props();

  let printedTotal = $derived(
    setsStore.selectedSet?.printedTotal ?? setsStore.selectedSet?.total ?? null
  );

  // Card dropdown is disabled until a set is selected and cards have loaded
  let cardSelectDisabled = $derived(
    !setsStore.selectedSet || cardsStore.cardsInSet.length === 0
  );

  function handleSetSelect(item: any) {
    if (item) {
      setsStore.selectSet(item);
    } else {
      setsStore.clearSet();
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

  async function handleGetPrice() {
    const card = cardsStore.selectedCard;
    const set = setsStore.selectedSet;
    if (!card || !set) return;

    const result = await pricingStore.fetchCardPrice(set.id, card.id);

    // Notify parent after successful fetch so it can record the lookup
    if (result) {
      const imgUrl = card.images?.[0]?.small ?? null;
      onpricefetched?.({
        setId: set.id,
        cardId: card.id,
        name: card.name,
        imageUrl: imgUrl,
        setName: set.name,
      });
    }
  }
</script>

<div class="form-container">
  <div class="form-fields">
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
        <div class="loading-skeleton">
          <SkeletonLoader variant="set-rows" />
        </div>
      {/if}
    </div>

    <div class="form-group">
      <label for="card-select" class="form-label">Select a Card</label>
      <CardSearchSelect
        cards={cardsStore.cardsInSet}
        placeholder="Search cards by name or number..."
        selectedCard={cardsStore.selectedCard}
        disabled={cardSelectDisabled}
        {printedTotal}
        onselect={handleCardSelect}
      />
      {#if cardsStore.isLoadingCards}
        <div class="loading-skeleton">
          <SkeletonLoader variant="card-rows" />
        </div>
      {/if}
    </div>
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

  .form-fields {
    display: flex;
    gap: 1.5em;
    margin-bottom: 1.5em;
  }

  .form-group {
    flex: 1;
    min-width: 0;
  }

  .form-label {
    display: block;
    margin-bottom: 0.5em;
    font-weight: 600;
    color: var(--color-heading);
    font-size: 0.95em;
  }

  .loading-skeleton {
    margin-top: 8px;
    padding: 4px 0;
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

  @media (max-width: 768px) {
    .form-container {
      padding: 1em;
      margin-bottom: 1em;
    }

    .form-fields {
      flex-direction: column;
      gap: 1em;
    }

    .button {
      padding: 0.9em 1.6em;
      min-height: 44px;
    }
  }

  @media (max-width: 480px) {
    .form-container {
      padding: 0.75em;
    }

    .form-label {
      font-size: 0.85em;
    }
  }
</style>
