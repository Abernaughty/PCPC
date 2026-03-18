<script lang="ts">
  /**
   * SetGroupHeader — Presentational component for expansion group headers.
   *
   * Layout:
   *   SCARLET & VIOLET                 2023 – present
   *
   * Sticky-positioned so it stays visible while scrolling within the group.
   */
  import type { GroupedSets } from '$lib/types';

  interface Props {
    group: GroupedSets;
  }

  let { group }: Props = $props();
</script>

<div class="group-header">
  <span class="group-header__label">{group.label}</span>
  {#if group.dateRange}
    <span class="group-header__range">{group.dateRange}</span>
  {/if}
</div>

<style>
  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background-color: var(--surface-1);
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .group-header__label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .group-header__range {
    font-size: 10px;
    color: var(--text-dim);
    flex-shrink: 0;
    margin-left: 12px;
    letter-spacing: 0.2px;
  }
</style>