<script lang="ts">
  /**
   * BackendToggle — corner badge that surfaces and switches the active
   * backend. Healthcheck-driven graceful degradation: backends whose
   * healthcheck does not return healthy/degraded within
   * HEALTH_TIMEOUT_MS are dimmed and unselectable. The default backend
   * (Path A) is always visible.
   *
   * Click the badge to open a small popover listing every registered
   * backend with status + latency. Selecting one mutates the URL,
   * persists the choice in localStorage, and triggers a page-state
   * refresh by reloading the home route's data.
   */

  import { onMount } from 'svelte';
  import { backendStore } from '$lib/backends';
  import type { BackendDefinition, BackendHealthStatus } from '$lib/backends';

  let isOpen = $state(false);
  let containerRef: HTMLDivElement | null = $state(null);

  let activeId = $derived(backendStore.activeId);
  let active = $derived(backendStore.active);
  let health = $derived(backendStore.health);

  let activeStatus: BackendHealthStatus = $derived(health[activeId].status);
  let activeLatency = $derived(health[activeId].latencyMs);

  function statusDot(status: BackendHealthStatus): string {
    if (status === 'healthy') return '●';
    if (status === 'degraded') return '◐';
    if (status === 'unhealthy') return '○';
    return '◌';
  }

  function statusLabel(status: BackendHealthStatus): string {
    if (status === 'healthy') return 'healthy';
    if (status === 'degraded') return 'degraded';
    if (status === 'unhealthy') return 'unhealthy';
    return 'checking…';
  }

  function isSelectable(def: BackendDefinition): boolean {
    if (def.alwaysVisible) return true;
    const status = health[def.id].status;
    return status === 'healthy' || status === 'degraded';
  }

  function visibleBackends(): BackendDefinition[] {
    return backendStore.all.filter(
      (def) => def.alwaysVisible || isSelectable(def) || def.id === activeId
    );
  }

  function handleSelect(def: BackendDefinition): void {
    if (!isSelectable(def)) return;
    backendStore.setActive(def.id);
    isOpen = false;
    // Reload so stores re-fetch through the new backend. A soft
    // re-fetch would also work but means re-coordinating every store;
    // a full reload is the most honest demonstration of the swap.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  function handleClickOutside(event: MouseEvent): void {
    if (!isOpen) return;
    const target = event.target as Node;
    // Treat both the badge AND the popover as "inside" — the popover is a
    // sibling of the badge inside the same `.backend-toggle` container, so
    // clicking an option must not close the popover before its own click
    // handler fires.
    if (containerRef && !containerRef.contains(target)) {
      isOpen = false;
    }
  }

  function handleKey(event: KeyboardEvent): void {
    if (event.key === 'Escape' && isOpen) isOpen = false;
  }

  onMount(() => {
    backendStore.init();
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  });
</script>

<div class="backend-toggle" data-status={activeStatus} bind:this={containerRef}>
  <button
    class="badge"
    type="button"
    aria-haspopup="menu"
    aria-expanded={isOpen}
    aria-label={`Backend: ${active.shortLabel} (${statusLabel(activeStatus)}). Click to switch.`}
    onclick={() => (isOpen = !isOpen)}
  >
    <span class="dot" aria-hidden="true">{statusDot(activeStatus)}</span>
    <span class="label">{active.shortLabel}</span>
    {#if activeLatency !== undefined}
      <span class="latency">{activeLatency}ms</span>
    {/if}
  </button>

  {#if isOpen}
    <div class="popover" role="menu">
      <div class="popover-header">
        <span class="popover-title">Backend</span>
        <span class="popover-help">?backend=…</span>
      </div>
      <ul class="options">
        {#each visibleBackends() as def (def.id)}
          {@const status = health[def.id].status}
          {@const latency = health[def.id].latencyMs}
          {@const selectable = isSelectable(def)}
          <li>
            <button
              type="button"
              class="option"
              class:active={def.id === activeId}
              class:disabled={!selectable}
              role="menuitemradio"
              aria-checked={def.id === activeId}
              aria-disabled={!selectable}
              disabled={!selectable && def.id !== activeId}
              onclick={() => handleSelect(def)}
            >
              <span class="option-row">
                <span class="option-dot" data-status={status} aria-hidden="true">
                  {statusDot(status)}
                </span>
                <span class="option-label">{def.label}</span>
                {#if latency !== undefined}
                  <span class="option-latency">{latency}ms</span>
                {/if}
              </span>
              <span class="option-desc">{def.description}</span>
              {#if !selectable && def.id !== activeId}
                <span class="option-note">unavailable — {statusLabel(status)}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
      <div class="popover-footer">
        <a
          href="https://github.com/Abernaughty/PCPC/blob/main/docs/architecture-comparison.md"
          target="_blank"
          rel="noopener"
        >
          Compare architectures →
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .backend-toggle {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 50;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 12px;
    line-height: 1;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(20, 20, 20, 0.78);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: background 120ms ease, border-color 120ms ease;
  }

  .badge:hover {
    background: rgba(40, 40, 40, 0.88);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .dot {
    font-size: 10px;
    line-height: 1;
  }

  .backend-toggle[data-status='healthy'] .dot {
    color: #4ade80;
  }
  .backend-toggle[data-status='degraded'] .dot {
    color: #facc15;
  }
  .backend-toggle[data-status='unhealthy'] .dot {
    color: #f87171;
  }
  .backend-toggle[data-status='unknown'] .dot {
    color: #94a3b8;
  }

  .label {
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .latency {
    color: #cbd5e1;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
  }

  .popover {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    min-width: 280px;
    background: rgba(15, 15, 15, 0.95);
    color: #f5f5f5;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(12px);
    overflow: hidden;
  }

  .popover-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 12px 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popover-title {
    font-weight: 600;
    font-size: 12px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #e2e8f0;
  }

  .popover-help {
    color: #94a3b8;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
  }

  .options {
    list-style: none;
    margin: 0;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option {
    width: 100%;
    text-align: left;
    background: transparent;
    color: inherit;
    border: none;
    border-radius: 6px;
    padding: 8px 10px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .option:hover:not(.disabled) {
    background: rgba(255, 255, 255, 0.06);
  }

  .option.active {
    background: rgba(74, 222, 128, 0.08);
  }

  .option.disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .option-dot[data-status='healthy'] {
    color: #4ade80;
  }
  .option-dot[data-status='degraded'] {
    color: #facc15;
  }
  .option-dot[data-status='unhealthy'] {
    color: #f87171;
  }
  .option-dot[data-status='unknown'] {
    color: #94a3b8;
  }

  .option-label {
    flex: 1;
    font-weight: 500;
  }

  .option-latency {
    color: #cbd5e1;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
  }

  .option-desc {
    color: #94a3b8;
    font-size: 11px;
    line-height: 1.4;
  }

  .option-note {
    color: #f87171;
    font-size: 11px;
  }

  .popover-footer {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding: 8px 12px;
  }

  .popover-footer a {
    color: #93c5fd;
    text-decoration: none;
    font-size: 11px;
  }

  .popover-footer a:hover {
    text-decoration: underline;
  }
</style>
