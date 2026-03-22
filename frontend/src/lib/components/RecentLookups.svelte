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

  if (browser) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) lookups = JSON.parse(stored);
    } catch { lookups = []; }
  }

  export function addLookup(entry: RecentLookup): void {
    const filtered = lookups.filter((l) => !(l.setId === entry.setId && l.cardId === entry.cardId));
    lookups = [entry, ...filtered].slice(0, MAX_LOOKUPS);
    persist();
  }

  function persist(): void {
    if (!browser) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lookups)); } catch {}
  }

  async function handleChipClick(lookup: RecentLookup): Promise<void> {
    const currentSetId = setsStore.selectedSet?.id;
    if (currentSetId === lookup.setId) {
      const card = cardsStore.cardsInSet.find((c) => c.id === lookup.cardId);
      if (card) {
        cardsStore.selectCard(card);
        await pricingStore.fetchCardPrice(lookup.setId, lookup.cardId);
        addLookup(lookup);
        goto(`/cards/${lookup.setId}/${lookup.cardId}`, { replaceState: true });
      }
      return;
    }
    const allSets = setsStore.groupedSetsForDropdown;
    let targetSet = null;
    for (const group of allSets) {
      if (group.type === 'group') {
        const found = group.items.find((s) => s.id === lookup.setId);
        if (found) { targetSet = found; break; }
      }
    }
    if (!targetSet) return;
    await setsStore.selectSet(targetSet);
    const card = cardsStore.cardsInSet.find((c) => c.id === lookup.cardId);
    if (card) {
      cardsStore.selectCard(card);
      await pricingStore.fetchCardPrice(lookup.setId, lookup.cardId);
      addLookup(lookup);
      goto(`/cards/${lookup.setId}/${lookup.cardId}`, { replaceState: true });
    }
  }

  function handleRemoveAll(): void { lookups = []; persist(); }
</script>

{#if lookups.length > 0}
  <div class="recent-lookups">
    <div class="recent-header">
      <span class="recent-label">RECENT</span>
      <button class="clear-btn" onclick={handleRemoveAll} type="button" aria-label="Clear recent lookups">Clear</button>
    </div>
    <div class="chips-scroll">
      {#each lookups as lookup (`${lookup.setId}_${lookup.cardId}`)}
        <button class="lookup-chip" onclick={() => handleChipClick(lookup)} type="button" title="{lookup.name} ({lookup.setName})">
          {#if lookup.imageUrl}
            <img class="chip-thumb" src={lookup.imageUrl} alt="" loading="lazy" width="18" height="25" />
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
  .recent-lookups { margin-bottom: 16px; }
  .recent-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .recent-label { font-size: var(--fs-micro); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
  .clear-btn { background: none; border: none; font-size: var(--fs-micro); color: var(--text-dim); cursor: pointer; padding: 2px 6px; border-radius: 3px; transition: color 0.15s ease, background-color 0.15s ease; }
  .clear-btn:hover { color: var(--text-secondary); background-color: rgba(255, 255, 255, 0.04); }
  .chips-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: thin; scrollbar-color: var(--border-subtle) transparent; position: relative; -webkit-overflow-scrolling: touch; }
  .chips-scroll::-webkit-scrollbar { height: 3px; }
  .chips-scroll::-webkit-scrollbar-track { background: transparent; }
  .chips-scroll::-webkit-scrollbar-thumb { background-color: var(--border-subtle); border-radius: 3px; }
  .lookup-chip { display: flex; align-items: center; gap: 6px; padding: 5px 10px 5px 6px; background-color: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius-input); cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: border-color 0.15s ease, background-color 0.15s ease; min-height: 36px; }
  .lookup-chip:hover { border-color: rgba(255, 255, 255, 0.1); background-color: rgba(255, 255, 255, 0.03); }
  .chip-thumb { width: 18px; height: 25px; object-fit: cover; border-radius: 2px; flex-shrink: 0; }
  .chip-thumb-placeholder { width: 18px; height: 25px; background-color: rgba(255, 255, 255, 0.04); border-radius: 2px; flex-shrink: 0; }
  .chip-name { font-size: var(--fs-badge); font-weight: 500; color: var(--text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 768px) { .lookup-chip { min-height: 44px; padding: 8px 10px 8px 6px; } .chip-name { max-width: 100px; } }
  @media (max-width: 480px) { .chip-name { max-width: 80px; font-size: var(--fs-micro); } }
</style>
