<script lang="ts">
  /**
   * Toast — lightweight notification for clipboard copy feedback.
   * Usage: bind a `message` string; when non-empty the toast shows,
   * then auto-dismisses after `duration` ms.
   */
  interface Props {
    message: string;
    duration?: number;
  }

  let { message, duration = 1500 }: Props = $props();

  let visible = $state(false);
  let displayText = $state('');
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (message) {
      displayText = message;
      visible = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        visible = false;
      }, duration);
    }
  });
</script>

{#if visible}
  <div class="toast" role="status" aria-live="polite">
    {displayText}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--surface-2);
    border: 1px solid var(--border-subtle);
    color: var(--price-green);
    font-size: 12px;
    font-weight: 500;
    padding: 8px 16px;
    border-radius: var(--radius-input);
    z-index: 1000;
    pointer-events: none;
    animation: toast-in 0.2s ease-out;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }
</style>
