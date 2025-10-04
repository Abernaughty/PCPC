<script>
  import { createEventDispatcher } from 'svelte';
  
  // Props
  export let variants = [];
  export let isVisible = false;
  
  // State
  let selectedVariant = null;
  
  const dispatch = createEventDispatcher();
  
  // Functions
  function selectVariant(variant) {
    selectedVariant = variant;
    dispatch('select', variant);
  }
  
  function close() {
    dispatch('close');
  }
  
  // Reset selected variant when variants change
  $: {
    if (variants && variants.length) {
      selectedVariant = null;
    }
  }
  
  // Determine if a variant is selected
  function isSelected(variant) {
    return selectedVariant && selectedVariant.id === variant.id;
  }
</script>

{#if isVisible && variants.length > 0}
  <div 
    class="overlay" 
    on:click={close}
    on:keydown={e => e.key === 'Escape' && close()}
    role="presentation"
  >
    <div 
      class="modal" 
      role="dialog"
      aria-labelledby="variant-selector-title"
      aria-modal="true"
    >
      <div class="modal-header">
        <h3 id="variant-selector-title">Multiple Variants Found</h3>
        <button class="close-button" on:click={close}>&times;</button>
      </div>
      
      <div class="modal-body">
        <p>Multiple versions of "{variants[0]?.name}" were found in this set. Please select the specific variant:</p>
        
        <div class="variants-list" role="listbox">
          {#each variants as variant}
            <div 
              class="variant-item {isSelected(variant) ? 'selected' : ''}"
              on:click={() => selectVariant(variant)}
              on:keydown={e => e.key === 'Enter' && selectVariant(variant)}
              on:focus={() => {}}
              role="option"
              tabindex="0"
              aria-selected={isSelected(variant)}
            >
              <div class="variant-details">
                <div class="variant-name">{variant.name}</div>
                <div class="variant-info">
                  <span class="variant-number">#{variant.num}</span>
                  {#if variant.rarity}
                    <span class="variant-rarity">{variant.rarity}</span>
                  {/if}
                  {#if variant.variant}
                    <span class="variant-type">{variant.variant}</span>
                  {/if}
                </div>
                {#if variant.image_url}
                  <div class="variant-thumbnail">
                    <img src={variant.image_url} alt={variant.name} />
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          class="confirm-button" 
          disabled={!selectedVariant}
          on:click={() => {
            if (selectedVariant) {
              dispatch('confirm', selectedVariant);
              close();
            }
          }}
        >
          Select Variant
        </button>
        <button class="cancel-button" on:click={close}>
          Cancel
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }
  
  .modal {
    background-color: var(--bg-container);
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px var(--shadow-medium);
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border-primary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .modal-header h3 {
    margin: 0;
    color: var(--color-pokemon-blue);
  }
  
  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 0;
    margin: 0;
    line-height: 1;
  }
  
  .modal-body {
    padding: 1rem;
    overflow-y: auto;
    color: var(--text-primary);
  }
  
  .variants-list {
    margin-top: 1rem;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border-primary);
    border-radius: 4px;
  }
  
  .variant-item {
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-secondary);
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .variant-item:last-child {
    border-bottom: none;
  }
  
  .variant-item:hover {
    background-color: var(--bg-hover);
  }
  
  .variant-item.selected {
    background-color: rgba(60, 90, 166, 0.1);
    border-left: 3px solid var(--color-pokemon-blue);
  }
  
  .variant-details {
    display: flex;
    flex-direction: column;
  }
  
  .variant-name {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  
  .variant-info {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }
  
  .variant-number {
    color: var(--text-secondary);
  }
  
  .variant-rarity {
    color: var(--color-pokemon-red);
    font-weight: 500;
  }
  
  .variant-type {
    color: var(--color-pokemon-blue);
    font-style: italic;
  }
  
  .variant-thumbnail {
    margin-top: 0.5rem;
    max-width: 100px;
  }
  
  .variant-thumbnail img {
    width: 100%;
    height: auto;
    border-radius: 4px;
    border: 1px solid var(--border-primary);
  }
  
  .modal-footer {
    padding: 1rem;
    border-top: 1px solid var(--border-primary);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  
  .confirm-button {
    background-color: var(--color-pokemon-red);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
  }
  
  .confirm-button:disabled {
    background-color: var(--border-primary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  .cancel-button {
    background-color: var(--bg-hover);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
