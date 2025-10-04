import { writable } from 'svelte/store';

// Check for saved theme preference or default to 'light'
const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') : 'light';
const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Initialize with stored theme, system preference, or default to light
const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');

// Create the theme store
export const theme = writable(initialTheme);

// Subscribe to theme changes and update localStorage and document
theme.subscribe(value => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme', value);
    document.documentElement.setAttribute('data-theme', value);
  }
});

// Function to toggle theme
export function toggleTheme() {
  theme.update(t => t === 'light' ? 'dark' : 'light');
}

// Initialize theme on page load
if (typeof window !== 'undefined') {
  document.documentElement.setAttribute('data-theme', initialTheme);
}
