<script lang="ts">
  import type { PokemonCard, PokemonSet } from '$lib/types';

  interface Props {
    card: PokemonCard;
    set: PokemonSet;
    imageUrl?: string | null;
    onlightbox?: (imageUrl: string) => void;
  }

  let { card, set, imageUrl = null, onlightbox }: Props = $props();

  let largeImageUrl = $derived(card.images?.[0]?.large ?? card.images?.[0]?.medium ?? imageUrl ?? '');

  let glowColor = $derived.by(() => {
    const r = card.rarity?.toLowerCase() ?? '';
    if (r.includes('special art') || r.includes('sar')) return 'rgba(251, 191, 36, 0.25)';
    if (r.includes('ultra') || r.includes('ur')) return 'rgba(251, 191, 36, 0.2)';
    if (r.includes('full art')) return 'rgba(244, 114, 182, 0.2)';
    if (r.includes('holo')) return 'rgba(167, 139, 250, 0.18)';
    if (r.includes('rare')) return 'rgba(96, 165, 250, 0.15)';
    return 'rgba(255, 255, 255, 0.06)';
  });

  function openLightbox() {
    if (largeImageUrl && onlightbox) onlightbox(largeImageUrl);
  }
</script>

<div class="card-sidebar">
  {#if imageUrl}
    <button class="card-image-button" onclick={openLightbox} type="button" aria-label="View full size image of {card.name}">
      <div class="ambient-glow" style="background: {glowColor};"></div>
      <img src={imageUrl} alt="{card.name} card image" class="card-image" loading="lazy" />
      <div class="zoom-overlay"><span class="zoom-label">Zoom</span></div>
    </button>
  {:else}
    <div class="card-back"><div class="card-back-inner"><div class="pokeball-orb"><div class="pokeball-top"></div><div class="pokeball-line"></div><div class="pokeball-center"></div></div></div></div>
  {/if}
</div>

<style>
  .card-sidebar { flex-shrink: 0; width: var(--sidebar-width, 200px); }
  .card-image-button { position: relative; display: block; width: 100%; padding: 0; margin: 0; border: none; background: none; cursor: pointer; border-radius: 8px; overflow: visible; }
  .ambient-glow { position: absolute; bottom: -8px; left: 10%; right: 10%; height: 60%; border-radius: 50%; filter: blur(16px); opacity: 0.5; z-index: 0; pointer-events: none; }
  .card-image { width: 100%; height: auto; display: block; border-radius: 8px; position: relative; z-index: 1; transition: transform 0.3s ease; }
  .card-image-button:hover .card-image { transform: scale(1.03); }
  .zoom-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.45); border-radius: 8px; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; z-index: 2; }
  .card-image-button:hover .zoom-overlay { opacity: 1; }
  .zoom-label { color: #fff; font-size: var(--fs-body); font-weight: 500; letter-spacing: 0.3px; padding: 5px 12px; background: rgba(0, 0, 0, 0.5); border-radius: 16px; }
  .card-back { width: 100%; aspect-ratio: 2.5 / 3.5; border-radius: 8px; background: linear-gradient(135deg, #2d1b4e 0%, #1a1028 100%); display: flex; align-items: center; justify-content: center; border: 0.5px solid var(--border-subtle); }
  .card-back-inner { width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; }
  .pokeball-orb { width: 48px; height: 48px; border-radius: 50%; position: relative; overflow: hidden; border: 2px solid rgba(255, 255, 255, 0.15); }
  .pokeball-top { position: absolute; top: 0; left: 0; right: 0; height: 50%; background: rgba(232, 69, 60, 0.4); }
  .pokeball-line { position: absolute; top: 50%; left: 0; right: 0; height: 2px; background: rgba(255, 255, 255, 0.2); transform: translateY(-50%); }
  .pokeball-center { position: absolute; top: 50%; left: 50%; width: 12px; height: 12px; border-radius: 50%; background: rgba(255, 255, 255, 0.15); border: 2px solid rgba(255, 255, 255, 0.25); transform: translate(-50%, -50%); }
  @media (max-width: 768px) { .card-sidebar { width: 180px; } }
</style>
