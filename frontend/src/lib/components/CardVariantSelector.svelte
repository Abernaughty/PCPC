<script lang="ts">
  import type { CardVariant } from '$lib/types';

  interface Props {
    variants?: CardVariant[];
    isVisible?: boolean;
    onselect?: (variant: CardVariant) => void;
    onconfirm?: (variant: CardVariant) => void;
    onclose?: () => void;
  }

  let {
    variants = [],
    isVisible = false,
    onselect,
    onconfirm,
    onclose
  }: Props = $props();

  let selectedVariant = $state<CardVariant | null>(null);

  // Reset selectedVariant when variants change
  $effect(() => {
    if (variants.length > 0) {
      selectedVariant = null;
    }
  });

  function handleVariantSelect(variant: CardVariant) {
    selectedVariant = variant;
    if (onselect) {
      onselect(variant);
    }
  }

  function handleConfirm() {
    if (selectedVariant && onconfirm) {
      onconfirm(selectedVariant);
    }
  }

  function handleCancel() {
    selectedVariant = null;
    if (onclose) {
      onclose();
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  }
</script>

{#if isVisible}
  <div class="variant-selector-overlay" onclick={handleOverlayClick} role="presentation">
    <div class="variant-modal">
      <div class="modal-header">
        <h2 class="modal-title">Select Card Variant</h2>
        <button
          class="close-button"
          onclick={handleCancel}
          aria-label="Close modal"
          type="button"
        >
          ✕
        </button>
      </div>

      <div class="modal-content">
        {#if variants.length === 0}
          <div class="no-variants">No variants available</div>
        {:else}
          <div class="variants-grid">
            {#each variants as variant (variant.name)}
              <button
                class="variant-card"
                class:selected={selectedVariant?.name === variant.name}
                onclick={() => handleVariantSelect(variant)}
                type="button"
                aria-pressed={selectedVariant?.name === variant.name}
              >
                {#if variant.images && variant.images.length > 0}
                  <img src={variant.images[0].small} alt={variant.name} class="variant-image" />
                {/if}
                <div class="variant-info">
                  <div class="variant-name">{variant.name}</div>
                  {#if variant.prices && variant.prices.length > 0}
                    <div class="variant-type">{variant.prices.length} price{variant.prices.length !== 1 ? 's' : ''}</div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="button button-secondary" onclick={handleCancel} type="button">
          Cancel
        </button>
        <button
          class="button button-primary"
          onclick={handleConfirm}
          disabled={!selectedVariant}
          type="button"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .variant-selector-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .variant-modal {
    background-color: var(--bg-container);
    border-radius: 8px;
    box-shadow: 0 20px 60px var(--shadow-heavy);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    padding: 1.5em;
    border-bottom: 1px solid var(--border-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-title {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.4em;
    font-weight: 600;
  }

  .close-button {
    background-color: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 1.5em;
    cursor: pointer;
    padding: 0;
    transition: color var(--transition-speed) ease;
  }

  .close-button:hover {
    color: var(--text-primary);
  }

  .modal-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5em;
  }

  .no-variants {
    padding: 2em 1em;
    text-align: center;
    color: var(--text-muted);
  }

  .variants-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1em;
  }

  .variant-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5em;
    padding: 1em;
    border: 2px solid var(--border-primary);
    border-radius: 6px;
    background-color: var(--bg-secondary);
    cursor: pointer;
    transition: all var(--transition-speed) ease;
    text-align: center;
  }

  .variant-card:hover {
    background-color: var(--bg-hover);
    border-color: var(--border-focus);
  }

  .variant-card.selected {
    border-color: var(--color-variant-selected-border);
    background-color: var(--bg-hover);
    box-shadow: 0 0 8px rgba(60, 90, 166, 0.3);
  }

  .variant-image {
    max-width: 100%;
    height: auto;
    max-height: 100px;
    border-radius: 4px;
  }

  .variant-info {
    width: 100%;
  }

  .variant-name {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.9em;
    word-break: break-word;
  }

  .variant-type {
    color: var(--color-variant-type);
    font-size: 0.8em;
    margin-top: 0.3em;
  }

  .variant-rarity {
    color: var(--color-variant-rarity);
    font-size: 0.8em;
    margin-top: 0.3em;
  }

  .modal-footer {
    padding: 1.5em;
    border-top: 1px solid var(--border-secondary);
    display: flex;
    gap: 1em;
    justify-content: flex-end;
  }

  .button {
    padding: 0.6em 1.2em;
    border: none;
    border-radius: 4px;
    font-size: 1em;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-speed) ease;
    font-family: inherit;
  }

  .button-primary {
    background-color: var(--color-button-primary-bg);
    color: var(--button-text-color);
  }

  .button-primary:hover:not(:disabled) {
    background-color: var(--color-button-primary-hover-bg);
  }

  .button-primary:disabled {
    background-color: var(--button-disabled-bg);
    color: var(--button-disabled-text);
    cursor: not-allowed;
  }

  .button-secondary {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }

  .button-secondary:hover {
    background-color: var(--bg-hover);
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--bg-secondary);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-bg);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-bg);
  }
</style>
