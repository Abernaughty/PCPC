/**
 * UI Store - Application UI state management using Svelte 5 runes
 * Handles error state and network status
 */

import { browser } from '$app/environment';
import { createContextLogger } from '$lib/services/logger';

const log = createContextLogger('uiStore');

interface UIStore {
  error: string | null;
  isOnline: boolean;
  setError(message: string | null): void;
  clearError(): void;
}

/**
 * Create the UI store with Svelte 5 runes
 */
function createUIStore(): UIStore {
  let error: string | null = $state(null);
  let isOnline: boolean = $state(true);

  /**
   * Set up network status listeners
   */
  if (browser) {
    const handleOnline = () => {
      isOnline = true;
      log.info('Network: online');
    };

    const handleOffline = () => {
      isOnline = false;
      log.warn('Network: offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize with current status
    isOnline = navigator.onLine;

    // Cleanup listeners on unload
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }

  /**
   * Set an error message
   */
  function setError(message: string | null): void {
    error = message;
    if (message) {
      log.error(`UI Error: ${message}`);
    }
  }

  /**
   * Clear error message
   */
  function clearError(): void {
    error = null;
  }

  return {
    get error() {
      return error;
    },

    get isOnline() {
      return isOnline;
    },

    setError,
    clearError,
  };
}

// Export singleton instance
export const uiStore = createUIStore();
