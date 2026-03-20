<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { setsStore } from '$lib/stores/sets.svelte';
  import { cardsStore } from '$lib/stores/cards.svelte';
  import { pricingStore } from '$lib/stores/pricing.svelte';

  interface RecentLookup {
    setId: string;
    cardId: string;
    name: string;
    imageUrl: string | null;
    setName: string;
  }

  const STORAGE_KEY = 'pcpc_recent_lookups';
  const MAX_LOOKUPS = 8;

  let lookups = $state<RecentLookup[]>([]);

  // Load from localStorage on mount
  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        lookups = JSON.parse(stored);
      }
    } catch {
      lookups = [];
    }
  }

  /**
   * Add a lookup to the recent list.
   * Called imperatively from the parent after a price fetch completes.
   */
  export function addLookup(entry: RecentLookup): void {
    const filtered = lookups.filter(
      (l) => !(l.setId === entry.setId && l.cardId === entry.cardId)
    );
    lookups = [entry, ...filtered].slice(0, MAX_LOOKUPS);
    persist();
  }

  function persist(): void {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lookups));
    } catch {
      // localStorage full or unavailable
    }
  }

  async function handleChipClick(lookup: RecentLookup): Promise<void> {
    const currentSetId = setsStore.selectedSet?.id;

    if (currentSetId === lookup.setId) {
      // Same set already selected — cards are already loaded.
      // Just select the card directly and fetch pricing.
      const card = cardsStore.cardsInSet.find((c) => c.id === lookup.cardId);
      if (card) {
        cardsStore.selectCard(card);
        await pricingStore.fetchCardPrice(lookup.setId, lookup.cardId);
        // Move this lookup to the front of the list
        addLookup(lookup);
        // Update URL to deep link
        goto(`/cards/${lookup.setId}/${lookup.cardId}`, { replaceState: true });
      }
      return;
    }

    // Different set — need to select it and wait for cards to load.
    const allSets = setsStore.groupedSetsForDropdown;
    let targetSet = null;
    for (const group of allSets) {
      if (group.type === 'group') {
        const found = group.items.find((s) => s.id === lookup.setId);
        if (found) {
          targetSet = found;
          break;
        }
      }
    }

    if (!targetSet) return;

    // selectSet triggers loadCardsForSet which is async.
    // Await it so cards are loaded before we try to select one.
    await setsStore.selectSet(targetSet);

    const card = cardsStore.cardsInSet.find((c) => c.id === lookup.cardId);
    if (card) {
      cardsStore.selectCard(card);
      await pricingStore.fetchCardPrice(lookup.setId, lookup.cardId);
      addLookup(lookup);
      // Update URL to deep link
      goto(`/cards/${lookup.setId}/${lookup.cardId}`, { replaceState: true });
    }
  }

  function handleRemoveAll(): void {
    lookups = [];
    persist();
  }
</script>

{#if lookups.length > 0}
  <div class="recent-lookups">
    <div class="recent-header">
      <span class="recent-label">RECENT</span>
      <button
        class="clear-btn"
        onclick={handleRemoveAll}
        type="button"
        aria-label="Clear recent lookups"
      >
        Clear
      </button>
    </div>
    <div class="chips-scroll">
      {#each lookups as lookup (`${lookup.setId}_${lookup.cardId}`)}
        <button
          class="lookup-chip"
          onclick={() => handleChipClick(lookup)}
          type="button"
          title="{lookup.name} ({lookup.setName})"
        >
          {#if lookup.imageUrl}
            <img
              class="chip-thumb"
              src={lookup.imageUrl}
              alt=""
              loading="lazy"
              width="18"
              height="25"
            />
          {:else}
            <span class="chip-thumb-placeholder"></span>
          {/if}
          <span class="chip-name">{lookup.name}</span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .recent-lookups {
    margin-bottom: 16px;
  }

  .recent-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .recent-label {
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted);
  }

  .clear-btn {
    background: none;
    border: none;
    font-size: 10px;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 3px;
    transition: color 0.15s ease, background-color 0.15s ease;
  }

  .clear-btn:hover {
    color: var(--text-secondary);
    background-color: rgba(255, 255, 255, 0.04);
  }

  .chips-scroll {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: thin;
    scrollbar-color: var(--border-subtle) transparent;
    position: relative;
    -webkit-overflow-scrolling: touch;
  }

  .chips-scroll::-webkit-scrollbar {
    height: 3px;
  }

  .chips-scroll::-webkit-scrollbar-track {
    background: transparent;
  }

  .chips-scroll::-webkit-scrollbar-thumb {
    background-color: var(--border-subtle);
    border-radius: 3px;
  }

  .lookup-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px 5px 6px;
    background-color: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-input);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .lookup-chip:hover {
    border-color: rgba(255, 255, 255, 0.1);
    background-color: rgba(255, 255, 255, 0.03);
  }

  .chip-thumb {
    width: 18px;
    height: 25px;
    object-fit: cover;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .chip-thumb-placeholder {
    width: 18px;
    height: 25px;
    background-color: rgba(255, 255, 255, 0.04);
    border-radius: 2px;
    flex-shrink: 0;
  }

  .chip-name {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary);
  }
</style>
