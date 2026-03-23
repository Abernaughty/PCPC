<script lang="ts">
  import { SearchableSelect, CardSearchSelect } from '$lib/components';
  import SetDropdownItem from '$lib/components/SetDropdownItem.svelte';
  import SetGroupHeader from '$lib/components/SetGroupHeader.svelte';
  import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
  import { setsStore, type LanguageFilter } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';
  import type { PokemonSet, PokemonCard } from '$lib/types';

  interface Props {
    onsetselect?: (set: PokemonSet | null) => void;
    oncardselect?: (card: PokemonCard | null) => void;
    onpricefetched?: (info: { setId: string; cardId: string; name: string; imageUrl: string | null; setName: string }) => void;
  }

  let { onsetselect, oncardselect, onpricefetched }: Props = $props();

  let printedTotal = $derived(setsStore.selectedSet?.printedTotal ?? setsStore.selectedSet?.total ?? null);

  // Card select is disabled only when no set is selected.
  let cardSelectDisabled = $derived(!setsStore.selectedSet);

  // Dynamic placeholder for card search based on loading state
  let cardPlaceholder = $derived.by(() => {
    if (!setsStore.selectedSet) return 'Select a set first...';
    if (cardsStore.isLoadingCards) return 'Loading cards...';
    if (cardsStore.cardsInSet.length === 0) return 'No cards found';
    return 'Search cards...';
  });

  function handleSetSelect(item: any) {
    if (item) { setsStore.selectSet(item); } else { setsStore.clearSet(); cardsStore.resetCards(); }
    onsetselect?.(item ?? null);
  }

  function handleCardSelect(card: any) {
    if (!card) {
      oncardselect?.(null);
      return;
    }

    const set = setsStore.selectedSet;
    if (!set) return;

    // Select the card in the store
    cardsStore.selectCard(card);
    oncardselect?.(card);

    // Immediately fetch pricing via fast-path (pre-loaded data, no API call)
    pricingStore.fetchCardPrice(set.id, card.id, card).then((result) => {
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
    });
  }

  function handleLanguageChange(lang: LanguageFilter) {
    setsStore.setLanguage(lang);
  }

  function handleOnlineOnlyToggle() {
    setsStore.setShowOnlineOnly(!setsStore.showOnlineOnly);
  }
</script>

<div class="search-container">
  <div class="search-form">
    <div class="search-fields">
      <div class="field-group">
        <label class="field-label">EXPANSION</label>
        <SearchableSelect items={setsStore.groupedSetsForDropdown} placeholder="Search sets..." labelField="name" searchFields={['name', 'code']} value={setsStore.selectedSet} onselect={handleSetSelect}>
          {#snippet item(set, selected)}<SetDropdownItem {set} {selected} />{/snippet}
          {#snippet groupHeader(group)}<SetGroupHeader {group} />{/snippet}
        </SearchableSelect>
        {#if setsStore.isLoadingSets}<div class="loading-skeleton"><SkeletonLoader variant="set-rows" /></div>{/if}
      </div>
      <div class="field-group">
        <label class="field-label">CARD</label>
        <CardSearchSelect cards={cardsStore.cardsInSet} placeholder={cardPlaceholder} selectedCard={cardsStore.selectedCard} disabled={cardSelectDisabled} {printedTotal} onselect={handleCardSelect} />
        {#if cardsStore.isLoadingCards}<div class="loading-skeleton"><SkeletonLoader variant="card-rows" /></div>{/if}
      </div>
    </div>
  </div>

  <div class="filter-row">
    <div class="language-toggle">
      <span class="filter-label">Sets:</span>
      <button type="button" class="lang-btn" class:active={setsStore.language === 'en'} onclick={() => handleLanguageChange('en')}>EN</button>
      <button type="button" class="lang-btn" class:active={setsStore.language === 'jp'} onclick={() => handleLanguageChange('jp')}>JP</button>
      <button type="button" class="lang-btn" class:active={setsStore.language === 'both'} onclick={() => handleLanguageChange('both')}>Both</button>
    </div>
    <label class="online-toggle">
      <input type="checkbox" checked={setsStore.showOnlineOnly} onchange={handleOnlineOnlyToggle} />
      <span class="toggle-label">Include online-only</span>
    </label>
  </div>
</div>

<style>
  .search-container { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
  .search-form { display: flex; align-items: flex-end; gap: 12px; }
  .search-fields { display: flex; gap: 12px; flex: 1; min-width: 0; }
  .field-group { flex: 1; min-width: 0; }
  .field-label { display: block; font-size: var(--fs-micro); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
  .loading-skeleton { margin-top: 6px; padding: 2px 0; }
  .filter-row { display: flex; align-items: center; gap: 16px; padding: 0 2px; }
  .filter-label { font-size: var(--fs-micro); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
  .language-toggle { display: flex; align-items: center; gap: 4px; }
  .lang-btn { font-size: var(--fs-micro); padding: 2px 10px; border-radius: var(--radius-badge); background: transparent; color: var(--text-muted); border: 1px solid var(--border-subtle); cursor: pointer; font-weight: 500; line-height: 1.4; font-family: inherit; transition: all 0.15s ease; }
  .lang-btn:hover:not(.active) { background: var(--bg-hover); color: var(--text-secondary); }
  .lang-btn.active { background: rgba(232, 69, 60, 0.12); color: var(--accent-red); border-color: var(--accent-red); }
  .online-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .online-toggle input { width: 14px; height: 14px; accent-color: var(--accent-red); cursor: pointer; }
  .toggle-label { font-size: var(--fs-micro); color: var(--text-muted); letter-spacing: 0.3px; user-select: none; }
  @media (max-width: 768px) { .filter-row { flex-wrap: wrap; gap: 8px; } .search-form { flex-direction: column; align-items: stretch; } .search-fields { flex-direction: column; } }
</style>
