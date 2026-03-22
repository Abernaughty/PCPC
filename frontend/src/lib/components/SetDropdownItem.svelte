<script lang="ts">
  import type { PokemonSet } from '$lib/types';
  import { formatMonthYear } from '$lib/services/expansionMapper';

  interface Props {
    set: PokemonSet;
    selected?: boolean;
  }

  let { set, selected = false }: Props = $props();

  const languageCode = $derived(
    set.languageCode?.toUpperCase() ?? (set.language?.toLowerCase() === 'japanese' ? 'JP' : 'EN')
  );
  const isJapanese = $derived(languageCode === 'JP');
  const cardCount = $derived(set.cardCount ?? set.total ?? null);
  const formattedDate = $derived(formatMonthYear(set.releaseDate));
  const symbolFallback = $derived(set.code ? set.code.slice(0, 3).toUpperCase() : '?');
  let symbolError = $state(false);
  function handleSymbolError() { symbolError = true; }

  const subtitleParts = $derived.by(() => {
    const parts: string[] = [];
    if (set.code) parts.push(set.code.toUpperCase());
    if (cardCount != null) parts.push(`${cardCount} cards`);
    if (formattedDate) parts.push(formattedDate);
    return parts;
  });
</script>

<div class="set-item" class:set-item--selected={selected}>
  <div class="set-item__symbol">
    {#if set.symbol && !symbolError}
      <img src={set.symbol} alt="" width="20" height="20" class="set-item__symbol-img" onerror={handleSymbolError} loading="lazy" />
    {:else}
      <span class="set-item__symbol-text">{symbolFallback}</span>
    {/if}
  </div>
  <div class="set-item__content">
    <div class="set-item__row1">
      <span class="set-item__name">{set.name}</span>
      <span class="set-item__badge" class:set-item__badge--en={!isJapanese} class:set-item__badge--jp={isJapanese}>{languageCode}</span>
    </div>
    {#if subtitleParts.length > 0}
      <div class="set-item__row2">{subtitleParts.join(' \u00B7 ')}</div>
    {/if}
  </div>
</div>

<style>
  .set-item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; min-height: 44px; }
  .set-item__symbol { flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
  .set-item__symbol-img { width: 20px; height: 20px; object-fit: contain; filter: brightness(0.9); }
  .set-item__symbol-text { font-size: 9px; font-weight: 500; color: var(--text-dim); background-color: var(--surface-1); border-radius: 3px; padding: 2px 3px; line-height: 1; letter-spacing: 0.3px; }
  .set-item__content { flex: 1; min-width: 0; }
  .set-item__row1 { display: flex; align-items: center; gap: 6px; }
  .set-item__name { font-size: var(--fs-body); font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
  .set-item__badge { flex-shrink: 0; font-size: var(--fs-micro); font-weight: 500; padding: 1px 5px; border-radius: var(--radius-badge, 4px); letter-spacing: 0.3px; line-height: 1.4; }
  .set-item__badge--en { background-color: var(--badge-en-bg); color: var(--badge-en-text); }
  .set-item__badge--jp { background-color: var(--badge-jp-bg); color: var(--badge-jp-text); }
  .set-item__row2 { font-size: var(--fs-badge); color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>