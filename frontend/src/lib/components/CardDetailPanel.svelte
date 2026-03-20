<script lang="ts">
  import type { PokemonCard, PokemonSet } from '$lib/types';
  import ImageLightbox from './ImageLightbox.svelte';

  interface Props {
    card: PokemonCard;
    set: PokemonSet;
    imageUrl?: string | null;
  }

  let { card, set, imageUrl = null }: Props = $props();

  let showLightbox = $state(false);

  // Derive the large image URL from card data, falling back to the passed imageUrl
  let largeImageUrl = $derived(
    card.images?.[0]?.large ?? card.images?.[0]?.medium ?? imageUrl ?? ''
  );

  function openLightbox() {
    if (largeImageUrl) {
      showLightbox = true;
    }
  }

  function closeLightbox() {
    showLightbox = false;
  }
</script>

<div class="card-details-layout">
  {#if imageUrl}
    <div class="card-image-section">
      <button
        class="card-image-button"
        on:click={openLightbox}
        type="button"
        aria-label="View full size image of {card.name}"
      >
        <img
          src={imageUrl}
          alt="{card.name} card image"
          class="card-image"
          loading="lazy"
        />
        <div class="zoom-overlay">
          <span class="zoom-icon">&#128269; Zoom</span>
        </div>
      </button>
    </div>
  {/if}

  <div class="card-info-section">
    <h2 class="section-title">Card Information</h2>
    <div class="card-info-grid">
      <div class="info-item">
        <span class="info-label">Card:</span>
        <span class="info-value">{card.name}</span>
      </div>
      {#if card.number || card.cardNumber}
        <div class="info-item">
          <span class="info-label">Number:</span>
          <span class="info-value">#{card.number || card.cardNumber}</span>
        </div>
      {/if}
      <div class="info-item">
        <span class="info-label">Set:</span>
        <span class="info-value">{set.name}</span>
      </div>
      {#if set.code}
        <div class="info-item">
          <span class="info-label">Set Code:</span>
          <span class="info-value">{set.code}</span>
        </div>
      {/if}
      {#if card.rarity}
        <div class="info-item">
          <span class="info-label">Rarity:</span>
          <span class="info-value">{card.rarity}</span>
        </div>
      {/if}
      {#if card.artist}
        <div class="info-item">
          <span class="info-label">Artist:</span>
          <span class="info-value">{card.artist}</span>
        </div>
      {/if}
    </div>
  </div>
</div>

{#if showLightbox && largeImageUrl}
  <ImageLightbox
    imageUrl={largeImageUrl}
    altText="{card.name} - full size"
    onclose={closeLightbox}
  />
{/if}

<style>
  .card-details-layout {
    display: flex;
    gap: 2em;
    align-items: flex-start;
  }

  .card-image-section {
    flex-shrink: 0;
    width: 250px;
  }

  .card-image-button {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    margin: 0;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 8px;
    overflow: hidden;
  }

  .card-image {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 8px;
    box-shadow: 0 4px 16px var(--shadow-medium);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .card-image-button:hover .card-image {
    transform: scale(1.03);
    box-shadow: 0 8px 24px var(--shadow-medium);
  }

  .zoom-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.45);
    border-radius: 8px;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .card-image-button:hover .zoom-overlay {
    opacity: 1;
  }

  .zoom-icon {
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.3px;
    padding: 6px 14px;
    background: rgba(0, 0, 0, 0.5);
    border-radius: 20px;
    backdrop-filter: blur(4px);
  }

  .section-title {
    margin: 0 0 1.5em 0;
    font-size: 1.3em;
    font-weight: 600;
    color: var(--color-heading);
    border-bottom: 2px solid var(--border-primary);
    padding-bottom: 0.5em;
  }

  .card-info-section {
    flex: 1;
    min-width: 0;
  }

  .card-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1em;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    padding: 1em;
    background-color: var(--bg-secondary);
    border-radius: 4px;
    border-left: 4px solid var(--color-pokemon-blue);
  }

  .info-label {
    font-weight: 600;
    color: var(--color-heading);
    font-size: 0.9em;
    text-transform: uppercase;
    margin-bottom: 0.3em;
  }

  .info-value {
    color: var(--text-primary);
    font-size: 1.1em;
  }

  @media (max-width: 768px) {
    .card-details-layout {
      flex-direction: column;
      align-items: center;
    }

    .card-image-section {
      width: 200px;
    }

    .card-info-section {
      width: 100%;
    }

    .card-info-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
