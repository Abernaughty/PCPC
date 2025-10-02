# PCPC Frontend Theming Style Guide

## Overview

This style guide documents the CSS theming system for the PCPC frontend application. It provides a comprehensive reference for the design token hierarchy, usage patterns, and best practices for maintaining consistent, theme-aware component styling.

**Last Updated:** October 1, 2025  
**Version:** 1.0.0

---

## Table of Contents

1. [Design Token System](#design-token-system)
2. [Token Categories](#token-categories)
3. [Component Styling Patterns](#component-styling-patterns)
4. [Do's and Don'ts](#dos-and-donts)
5. [Reference Implementation](#reference-implementation)
6. [Common Patterns](#common-patterns)
7. [Accessibility Guidelines](#accessibility-guidelines)
8. [Migration Guide](#migration-guide)

---

## Design Token System

### Architecture

PCPC uses a **semantic token system** with CSS Custom Properties (CSS Variables) for runtime theme switching. The system is defined in `app/frontend/public/global.css` and follows this hierarchy:

```
Semantic Tokens (Purpose-Based)
└─> Component Usage
    └─> Runtime Theme Switching
```

### Theme Switching

Themes are controlled via the `data-theme` attribute on the root element:

```html
<!-- Light Mode (default) -->
<html data-theme="light">
  <!-- Dark Mode -->
  <html data-theme="dark"></html>
</html>
```

All theme transitions are smooth with a 0.3s ease animation applied globally.

---

## Token Categories

### 1. Background Colors

#### Page & Layout Backgrounds

| Token                | Light Mode        | Dark Mode | Usage                                   |
| -------------------- | ----------------- | --------- | --------------------------------------- |
| `--bg-primary`       | `#000000`         | `#000000` | Main page background behind all content |
| `--bg-secondary`     | `rgba(0,0,0,0.9)` | `#41444e` | Card image containers, scrollbar tracks |
| `--bg-tertiary`      | `rgba(0,0,0,0.9)` | `#41444e` | Results section background              |
| `--bg-image-opacity` | `1`               | `1`       | Background image opacity                |

#### Container Backgrounds

| Token               | Light Mode        | Dark Mode | Usage                                 |
| ------------------- | ----------------- | --------- | ------------------------------------- |
| `--bg-container`    | `rgba(0,0,0,0.9)` | `#41444e` | Main form container background        |
| `--bg-dropdown`     | `#41444e`         | `#22242f` | Input fields, dropdown menus          |
| `--bg-hover`        | `#000000`         | `#22242f` | Hover states for interactive elements |
| `--bg-group-header` | `#000000`         | `#41444e` | Group headers in dropdown lists       |

**Usage Example:**

```css
.form-container {
  background-color: var(--bg-container);
}

.dropdown-menu {
  background-color: var(--bg-dropdown);
}

.dropdown-item:hover {
  background-color: var(--bg-hover);
}
```

### 2. Typography Colors

| Token              | Light Mode | Dark Mode | Usage                                  |
| ------------------ | ---------- | --------- | -------------------------------------- |
| `--text-primary`   | `#000000`  | `#d7dee3` | Main text (labels, body, card details) |
| `--text-secondary` | `#000000`  | `#d7dee3` | Secondary text (currency, timestamps)  |
| `--text-muted`     | `#000000`  | `#e3d7d7` | Disabled inputs, placeholders          |
| `--text-inverse`   | `#000000`  | `#eeff00` | Text on contrasting backgrounds        |

**Usage Example:**

```css
.label {
  color: var(--text-primary);
}

.timestamp {
  color: var(--text-secondary);
}

input::placeholder {
  color: var(--text-muted);
}

.header-text {
  color: var(--text-inverse);
}
```

### 3. Border Colors

| Token                | Light Mode | Dark Mode | Usage                                     |
| -------------------- | ---------- | --------- | ----------------------------------------- |
| `--border-primary`   | `#000000`  | `#22242f` | Primary borders (results, cards, buttons) |
| `--border-secondary` | `#000000`  | `#000000` | Secondary borders (list separators)       |
| `--border-input`     | `#000000`  | `#48365b` | Input field borders (normal state)        |
| `--border-focus`     | `#000000`  | `#48365b` | Input field borders (focused state)       |

**Usage Example:**

```css
.card {
  border: 1px solid var(--border-primary);
}

.list-item {
  border-bottom: 1px solid var(--border-secondary);
}

input {
  border: 1px solid var(--border-input);
}

input:focus {
  border-color: var(--border-focus);
}
```

### 4. Brand Colors (Pokemon Theme)

| Token                      | Light Mode | Dark Mode | Usage                               |
| -------------------------- | ---------- | --------- | ----------------------------------- |
| `--color-pokemon-blue`     | `#000000`  | `#d7dee3` | Header, headings, cached indicators |
| `--color-pokemon-red`      | `#000000`  | `#ff0000` | Primary buttons, prices, errors     |
| `--color-pokemon-red-dark` | `#000000`  | `#ff0000` | Button hover states                 |

**Usage Example:**

```css
.header {
  background-color: var(--color-pokemon-blue);
}

.price-value {
  color: var(--color-pokemon-red);
}

.primary-button {
  background-color: var(--color-pokemon-red);
}

.primary-button:hover {
  background-color: var(--color-pokemon-red-dark);
}
```

### 5. Interactive States

| Token            | Light Mode | Dark Mode | Usage                                     |
| ---------------- | ---------- | --------- | ----------------------------------------- |
| `--bg-hover`     | `#000000`  | `#22242f` | Hover background for interactive elements |
| `--border-focus` | `#000000`  | `#48365b` | Focus state borders                       |

### 6. Shadows

| Token             | Light Mode        | Dark Mode         | Usage                            |
| ----------------- | ----------------- | ----------------- | -------------------------------- |
| `--shadow-light`  | `rgba(0,0,0,0.1)` | `rgba(0,0,0,0.3)` | Light shadows                    |
| `--shadow-medium` | `rgba(0,0,0,0.2)` | `rgba(0,0,0,0.5)` | Medium shadows (results section) |
| `--shadow-heavy`  | `rgba(0,0,0,0.3)` | `rgba(0,0,0,0.7)` | Heavy shadows (form container)   |

**Usage Example:**

```css
.card {
  box-shadow: 0 2px 4px var(--shadow-light);
}

.modal {
  box-shadow: 0 4px 8px var(--shadow-medium);
}

.elevated-container {
  box-shadow: 0 8px 16px var(--shadow-heavy);
}
```

### 7. Transitions

| Token                | Value  | Usage                                                   |
| -------------------- | ------ | ------------------------------------------------------- |
| `--transition-speed` | `0.3s` | Animation speed for theme transitions and hover effects |

**Usage Example:**

```css
.animated-element {
  transition: all var(--transition-speed) ease;
}
```

---

## Component Styling Patterns

### Pattern 1: Basic Component (Recommended)

Use semantic tokens directly in component styles:

```svelte
<style>
  .component {
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }

  .component:hover {
    background-color: var(--bg-hover);
  }
</style>
```

### Pattern 2: Interactive Elements

For buttons, links, and clickable items:

```svelte
<style>
  .button {
    background-color: var(--color-pokemon-red);
    color: white;
    border: none;
    transition: background-color var(--transition-speed) ease;
  }

  .button:hover {
    background-color: var(--color-pokemon-red-dark);
  }

  .button:disabled {
    background-color: var(--border-primary);
    color: var(--text-muted);
    cursor: not-allowed;
  }
</style>
```

### Pattern 3: Form Inputs

For text inputs, selects, and textareas:

```svelte
<style>
  .input {
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
    border: 1px solid var(--border-input);
    padding: 0.5rem;
  }

  .input:focus {
    border-color: var(--border-focus);
    outline: none;
  }

  .input::placeholder {
    color: var(--text-muted);
  }

  .input:disabled {
    color: var(--text-muted);
    background-color: var(--bg-hover);
  }
</style>
```

### Pattern 4: Dropdown Menus

For dropdown lists and select menus:

```svelte
<style>
  .dropdown {
    background-color: var(--bg-dropdown);
    border: 1px solid var(--border-primary);
    box-shadow: 0 4px 8px var(--shadow-medium);
  }

  .dropdown-item {
    color: var(--text-primary);
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-secondary);
  }

  .dropdown-item:hover {
    background-color: var(--bg-hover);
    color: var(--color-pokemon-blue);
  }

  .dropdown-item:last-child {
    border-bottom: none;
  }
</style>
```

### Pattern 5: Group Headers

For section headers within lists:

```svelte
<style>
  .group-header {
    background-color: var(--bg-group-header);
    color: var(--color-pokemon-blue);
    padding: 0.5rem;
    font-weight: bold;
    border-bottom: 1px solid var(--border-primary);
    position: sticky;
    top: 0;
  }
</style>
```

### Pattern 6: Cards and Containers

For card components and content containers:

```svelte
<style>
  .card {
    background-color: var(--bg-container);
    border: 1px solid var(--border-primary);
    border-radius: 4px;
    padding: 1rem;
    box-shadow: 0 2px 4px var(--shadow-light);
  }

  .card-header {
    color: var(--color-pokemon-blue);
    border-bottom: 1px solid var(--border-secondary);
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }

  .card-body {
    color: var(--text-primary);
  }
</style>
```

---

## Do's and Don'ts

### ✅ DO

#### Use Semantic Tokens

```css
/* ✅ CORRECT - Uses semantic tokens */
.dropdown {
  background-color: var(--bg-dropdown);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}
```

#### Use Theme-Aware Interactive States

```css
/* ✅ CORRECT - Theme-aware hover state */
.item:hover {
  background-color: var(--bg-hover);
  color: var(--color-pokemon-blue);
}
```

#### Use Consistent Spacing

```css
/* ✅ CORRECT - Consistent padding */
.component {
  padding: 0.5rem;
  margin: 0.5rem 0;
}
```

#### Use Transitions for Smooth Theme Switching

```css
/* ✅ CORRECT - Smooth transitions */
.component {
  transition: background-color var(--transition-speed) ease, color var(
        --transition-speed
      ) ease;
}
```

### ❌ DON'T

#### Don't Use Hardcoded Colors

```css
/* ❌ WRONG - Hardcoded white background */
.dropdown {
  background-color: white;
  color: #333;
  border: 1px solid #ddd;
}

/* ✅ CORRECT - Use semantic tokens */
.dropdown {
  background-color: var(--bg-dropdown);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}
```

#### Don't Use Magic RGBA Values

```css
/* ❌ WRONG - Hardcoded rgba */
.overlay {
  background-color: rgba(255, 255, 255, 0.2);
}

/* ✅ CORRECT - Use semantic tokens or define new token */
.overlay {
  background-color: var(--bg-secondary);
}
```

#### Don't Use Hardcoded Hover States

```css
/* ❌ WRONG - Hardcoded hover colors */
.item:hover {
  background-color: #f0f0f0;
  color: #3c5aa6;
}

/* ✅ CORRECT - Theme-aware hover */
.item:hover {
  background-color: var(--bg-hover);
  color: var(--color-pokemon-blue);
}
```

#### Don't Mix Hardcoded and Token-Based Styles

```css
/* ❌ WRONG - Inconsistent approach */
.component {
  background-color: var(--bg-dropdown); /* Token */
  color: #333; /* Hardcoded */
  border: 1px solid var(--border-primary); /* Token */
}

/* ✅ CORRECT - Consistent token usage */
.component {
  background-color: var(--bg-dropdown);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
}
```

---

## Reference Implementation

### SearchableSelect.svelte (Correct Pattern)

This component demonstrates the correct usage of the theming system:

```svelte
<style>
  /* Input field - uses semantic tokens */
  input {
    width: 100%;
    padding: 0.5rem;
    font-size: 1rem;
    border: 1px solid var(--border-input);
    border-radius: 4px;
    background-color: var(--bg-dropdown);
    color: var(--text-primary);
  }

  /* Dropdown menu - theme-aware */
  .dropdown {
    background-color: var(--bg-dropdown);
    border: 1px solid var(--border-primary);
    box-shadow: 0 4px 8px var(--shadow-light);
  }

  /* Group headers - uses brand colors */
  .group-header {
    background-color: var(--bg-group-header);
    color: var(--color-pokemon-blue);
    border-bottom: 1px solid var(--border-primary);
  }

  /* List items - proper hover states */
  .item {
    color: var(--text-primary);
    border-bottom: 1px solid var(--border-secondary);
  }

  .item:hover, .highlighted {
    background-color: var(--bg-hover);
    color: var(--color-pokemon-blue);
  }

  /* Secondary text - uses muted color */
  .secondary {
    color: var(--text-secondary);
  }
</style>
```

**Key Takeaways:**

1. All colors use CSS variables
2. Hover states use theme-aware tokens
3. Interactive elements have proper focus states
4. Consistent spacing and transitions

---

## Common Patterns

### Pattern: Modal/Dialog

```svelte
<style>
  .modal-overlay {
    background-color: var(--bg-secondary);
    /* Note: For semi-transparent overlays, consider adding opacity */
    opacity: 0.95;
  }

  .modal-content {
    background-color: var(--bg-container);
    border: 1px solid var(--border-primary);
    box-shadow: 0 8px 16px var(--shadow-heavy);
    color: var(--text-primary);
  }

  .modal-header {
    color: var(--color-pokemon-blue);
    border-bottom: 1px solid var(--border-secondary);
  }
</style>
```

### Pattern: List with Separators

```svelte
<style>
  .list {
    background-color: var(--bg-dropdown);
    border: 1px solid var(--border-primary);
  }

  .list-item {
    color: var(--text-primary);
    padding: 0.75rem;
    border-bottom: 1px solid var(--border-secondary);
  }

  .list-item:last-child {
    border-bottom: none;
  }

  .list-item:hover {
    background-color: var(--bg-hover);
  }
</style>
```

### Pattern: Status Indicators

```svelte
<style>
  .status {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .status-success {
    background-color: var(--color-pokemon-blue);
    color: white;
  }

  .status-error {
    background-color: var(--color-pokemon-red);
    color: white;
  }

  .status-warning {
    background-color: var(--bg-hover);
    color: var(--text-primary);
    border: 1px solid var(--border-primary);
  }
</style>
```

### Pattern: Loading States

```svelte
<style>
  .loading {
    color: var(--text-secondary);
    background-color: var(--bg-hover);
    padding: 1rem;
    text-align: center;
  }

  .skeleton {
    background-color: var(--bg-hover);
    border-radius: 4px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
```

---

## Accessibility Guidelines

### Color Contrast

Ensure sufficient color contrast ratios for accessibility:

- **Normal text:** Minimum 4.5:1 contrast ratio
- **Large text (18pt+):** Minimum 3:1 contrast ratio
- **Interactive elements:** Minimum 3:1 contrast ratio

### Focus States

Always provide visible focus indicators:

```css
.interactive-element:focus {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* Or use box-shadow for custom focus rings */
.button:focus {
  box-shadow: 0 0 0 3px rgba(60, 90, 166, 0.3);
}
```

### Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```svelte
<div
  role="button"
  tabindex="0"
  on:click={handleClick}
  on:keydown={e => e.key === 'Enter' && handleClick()}
>
  Interactive Element
</div>
```

---

## Migration Guide

### Step 1: Identify Hardcoded Colors

Search for common hardcoded color patterns:

- `color: white` or `color: #fff`
- `background-color: white` or `background: #fff`
- `color: #333` or similar dark grays
- `border: 1px solid #ddd` or similar light grays
- `rgba(255, 255, 255, ...)` or similar rgba values

### Step 2: Map to Semantic Tokens

Use this mapping guide:

| Hardcoded Value          | Semantic Token                                       | Context                   |
| ------------------------ | ---------------------------------------------------- | ------------------------- |
| `white` (background)     | `var(--bg-dropdown)`                                 | Input fields, dropdowns   |
| `white` (text)           | `var(--text-inverse)`                                | Text on dark backgrounds  |
| `#333`, `#666` (text)    | `var(--text-primary)` or `var(--text-secondary)`     | Body text                 |
| `#ddd`, `#ccc` (borders) | `var(--border-primary)` or `var(--border-secondary)` | Borders                   |
| `#f0f0f0` (hover)        | `var(--bg-hover)`                                    | Hover states              |
| `#3c5aa6` (blue)         | `var(--color-pokemon-blue)`                          | Brand blue                |
| `rgba(255,255,255,0.2)`  | `var(--bg-secondary)` + opacity                      | Semi-transparent overlays |

### Step 3: Replace Systematically

Replace one component at a time:

```css
/* BEFORE */
.dropdown {
  background-color: white;
  border: 1px solid #ddd;
  color: #333;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
  color: #3c5aa6;
}

/* AFTER */
.dropdown {
  background-color: var(--bg-dropdown);
  border: 1px solid var(--border-primary);
  color: var(--text-primary);
}

.dropdown-item:hover {
  background-color: var(--bg-hover);
  color: var(--color-pokemon-blue);
}
```

### Step 4: Test Both Themes

After each component migration:

1. Test in light mode
2. Test in dark mode
3. Test theme switching transition
4. Verify hover/focus states
5. Check accessibility contrast

### Step 5: Document Component-Specific Patterns

If a component needs unique styling, document it:

```svelte
<style>
  /* Special case: This component needs higher contrast */
  .special-dropdown {
    /* Override with more specific token if needed */
    background-color: var(--bg-container);
    /* Or define component-specific variable */
    --dropdown-bg: var(--bg-container);
  }
</style>
```

---

## Quick Reference Card

### Most Common Tokens

```css
/* Backgrounds */
--bg-dropdown        /* Input fields, dropdowns */
--bg-container       /* Form containers, cards */
--bg-hover           /* Hover states */

/* Text */
--text-primary       /* Main text */
--text-secondary     /* Secondary text */
--text-muted         /* Disabled, placeholders */

/* Borders */
--border-primary     /* Main borders */
--border-secondary   /* List separators */
--border-input       /* Input borders */

/* Brand */
--color-pokemon-blue /* Headers, links */
--color-pokemon-red  /* Buttons, prices */
```

### Common Replacements

```css
white           → var(--bg-dropdown)
#333, #666      → var(--text-primary)
#ddd, #ccc      → var(--border-primary)
#f0f0f0         → var(--bg-hover)
#3c5aa6         → var(--color-pokemon-blue)
```

---

## Conclusion

This style guide provides a comprehensive reference for maintaining consistent, theme-aware styling across the PCPC frontend application. By following these patterns and guidelines, you ensure:

1. **Consistency:** All components use the same theming system
2. **Maintainability:** Changes to the theme affect all components automatically
3. **Accessibility:** Proper contrast and focus states are maintained
4. **User Experience:** Smooth theme transitions and predictable interactions

For questions or clarifications, refer to the reference implementation in `SearchableSelect.svelte` or consult this guide.

---

**Document Version:** 1.0.0  
**Last Updated:** October 1, 2025  
**Maintained By:** PCPC Development Team
