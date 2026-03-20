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

<!-- F: Inline search form with button to the right -->
<div class="search-form">
  <div class="search-fields">
    <div class="field-group">
      <label class="field-label">EXPANSION</label>
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

    <div class="field-group">
      <label class="field-label">CARD</label>
      <CardSearchSelect
        cards={cardsStore.cardsInSet}
        placeholder="Search cards..."
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
    class="get-price-btn"
    onclick={handleGetPrice}
    disabled={!setsStore.selectedSet || !cardsStore.selectedCard || pricingStore.isLoading}
    type="button"
  >
    {pricingStore.isLoading ? 'Getting Price...' : 'Get Price'}
  </button>
</div>

<style>
  /* F: Search form — inputs and button on one row */
  .search-form {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 16px;
  }

  .search-fields {
    display: flex;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .field-group {
    flex: 1;
    min-width: 0;
  }

  .field-label {
    display: block;
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .loading-skeleton {
    margin-top: 6px;
    padding: 2px 0;
  }

  .get-price-btn {
    flex-shrink: 0;
    padding: 9px 20px;
    border: none;
    border-radius: var(--radius-input);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    letter-spacing: 0.2px;
    white-space: nowrap;
    background-color: var(--amber);
    color: #0d0f14;
  }

  .get-price-btn:hover:not(:disabled) {
    background-color: #d4a574;
    box-shadow: 0 2px 8px rgba(196, 154, 108, 0.25);
  }

  .get-price-btn:disabled {
    background-color: var(--surface-2);
    color: var(--text-dim);
    cursor: not-allowed;
    border: 0.5px solid var(--border-subtle);
  }

  @media (max-width: 768px) {
    .search-form {
      flex-direction: column;
      align-items: stretch;
    }

    .search-fields {
      flex-direction: column;
    }

    .get-price-btn {
      padding: 12px 20px;
      min-height: 44px;
    }
  }
</style>
