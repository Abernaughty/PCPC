/**
 * Theme Store - Light/Dark mode management using Svelte 5 runes
 */

import { browser } from '$app/environment';

type ThemeType = 'light' | 'dark';

interface ThemeStore {
  current: ThemeType;
  toggle(): void;
  set(value: ThemeType): void;
}

/**
 * Create the theme store with Svelte 5 runes
 */
function createThemeStore(): ThemeStore {
  let theme: ThemeType = $state('light');

  // Initialize theme from localStorage or system preference
  if (browser) {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      theme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }

    // Apply to document
    document.documentElement.setAttribute('data-theme', theme);
  }

  return {
    get current() {
      return theme;
    },

    toggle() {
      theme = theme === 'light' ? 'dark' : 'light';
      if (browser) {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
    },

    set(value: ThemeType) {
      theme = value;
      if (browser) {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      }
    },
  };
}

// Export singleton instance
export const themeStore = createThemeStore();
