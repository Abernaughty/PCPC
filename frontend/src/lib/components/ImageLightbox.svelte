<script lang="ts">
  interface Props {
    imageUrl: string;
    altText?: string;
    onclose: () => void;
  }

  let { imageUrl, altText = 'Card image', onclose }: Props = $props();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onclose();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }

  // Lock body scroll on mount, restore on unmount
  $effect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="lightbox-backdrop"
  on:click={handleBackdropClick}
  role="dialog"
  aria-label="Card image preview"
  aria-modal="true"
>
  <button
    class="lightbox-close"
    on:click={onclose}
    aria-label="Close image preview"
    type="button"
  >
    &times;
  </button>

  <div class="lightbox-content">
    <img
      src={imageUrl}
      alt={altText}
      class="lightbox-image"
    />
  </div>
</div>

<style>
  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease-out;
    cursor: pointer;
  }

  .lightbox-close {
    position: absolute;
    top: 16px;
    right: 20px;
    z-index: 1001;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary, #e8eaef);
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  .lightbox-close:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .lightbox-content {
    animation: scaleIn 0.2s ease-out;
    cursor: default;
    max-width: 90vw;
    max-height: 90vh;
  }

  .lightbox-image {
    max-width: 90vw;
    max-height: 85vh;
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
