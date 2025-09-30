# Frontend CSS Theming System Refactor

## Issue Summary

The frontend components have inconsistent theming implementation with numerous hardcoded color values that break the dark/light theme system. This makes it difficult to maintain consistent styling and causes visual inconsistencies across the application.

## Problem Description

### Current State

- A comprehensive CSS variable system exists in `global.css` with proper light/dark theme support
- Some components (like `SearchableSelect`) properly use CSS variables
- Many components have hardcoded colors that ignore the theme system
- Inconsistent styling patterns across components make maintenance difficult

### Specific Issues Identified

#### 1. Hardcoded White Backgrounds

**Components affected:**

- `CardSearchSelect.svelte` - dropdown background hardcoded to `white`
- `SearchableInput.svelte` - modal background hardcoded to `white`
- `CardVariantSelector.svelte` - modal background hardcoded to `white`
- `FeatureFlagDebugPanel.svelte` - panel background hardcoded to `white`

**Impact:** These components appear with white backgrounds in dark mode, breaking the theme consistency.

#### 2. Hardcoded Text Colors

**Components affected:**

- `App.svelte` - header h1 text hardcoded to `white`
- `CardSearchSelect.svelte` - text colors hardcoded to `#333`, `#666`
- `SearchableInput.svelte` - various text colors hardcoded
- `CardVariantSelector.svelte` - text colors hardcoded
- `FeatureFlagDebugPanel.svelte` - button text hardcoded to `white`

**Impact:** Text doesn't adapt to theme changes, causing readability issues.

#### 3. Hardcoded Interactive States

**Components affected:**

- `CardSearchSelect.svelte` - hover states use `#f0f0f0`, `#3c5aa6`
- `SearchableInput.svelte` - hover/focus states hardcoded
- `CardVariantSelector.svelte` - selection states hardcoded

**Impact:** Interactive feedback doesn't match the current theme.

#### 4. Hardcoded Border Colors

**Components affected:**

- `CardSearchSelect.svelte` - borders use `#ddd`, `#f0f0f0`
- `SearchableInput.svelte` - borders hardcoded
- `CardVariantSelector.svelte` - borders hardcoded

**Impact:** Component boundaries don't adapt to theme.

### Detailed Component Analysis

#### CardSearchSelect.svelte

```css
/* PROBLEMATIC - Hardcoded values */
.dropdown {
  background-color: white; /* Should be: var(--bg-dropdown) */
  border: 1px solid #ddd; /* Should be: var(--border-primary) */
}

.card-item {
  color: #333; /* Should be: var(--text-primary) */
  border-bottom: 1px solid #f0f0f0; /* Should be: var(--border-secondary) */
}

.card-item:hover {
  background-color: #f0f0f0; /* Should be: var(--bg-hover) */
  color: #3c5aa6; /* Should be: var(--color-pokemon-blue) */
}
```

#### App.svelte

```css
/* PROBLEMATIC - Hardcoded header text */
h1 {
  color: white; /* Should be: var(--text-inverse) */
}

/* PROBLEMATIC - Hardcoded rgba values */
.theme-toggle {
  background-color: rgba(255, 255, 255, 0.2); /* Should use theme variables */
}
```

#### Other Components

Similar patterns exist in:

- `SearchableInput.svelte` - 15+ hardcoded color values
- `CardVariantSelector.svelte` - 20+ hardcoded color values
- `FeatureFlagDebugPanel.svelte` - 10+ hardcoded color values

## Available CSS Variables

The following CSS variables are already defined in `global.css` and should be used:

### Background Colors

- `--bg-primary` - Main page background
- `--bg-secondary` - Card containers, scrollbar tracks
- `--bg-tertiary` - Results sections
- `--bg-container` - Form containers
- `--bg-dropdown` - Input fields and dropdowns
- `--bg-hover` - Hover states
- `--bg-group-header` - Group headers

### Text Colors

- `--text-primary` - Main text
- `--text-secondary` - Secondary text
- `--text-muted` - Disabled/placeholder text
- `--text-inverse` - Text on dark backgrounds

### Border Colors

- `--border-primary` - Primary borders
- `--border-secondary` - Secondary borders
- `--border-input` - Input field borders
- `--border-focus` - Focused input borders

### Theme Colors

- `--color-pokemon-blue` - Brand blue
- `--color-pokemon-red` - Brand red
- `--color-pokemon-red-dark` - Dark red for hover states

## Proposed Solution

### Phase 1: Critical Fixes

1. **Fix dropdown backgrounds** - Replace hardcoded `white` with `var(--bg-dropdown)`
2. **Fix header text** - Replace hardcoded `white` with `var(--text-inverse)`
3. **Fix primary text colors** - Replace hardcoded dark colors with `var(--text-primary)`

### Phase 2: Comprehensive Refactor

1. **Audit all components** - Systematically replace all hardcoded colors
2. **Standardize hover states** - Use consistent `var(--bg-hover)` patterns
3. **Unify border styling** - Use theme-aware border variables
4. **Test theme switching** - Ensure all components respond to theme changes

### Phase 3: Style Guide Creation

1. **Document CSS variable usage** - Create guidelines for component styling
2. **Create component templates** - Standardized patterns for new components
3. **Add linting rules** - Prevent hardcoded colors in future development

## Implementation Priority

### High Priority (Immediate)

- [ ] `CardSearchSelect.svelte` - Fixes dropdown white background issue
- [ ] `App.svelte` - Fixes header text color issue
- [ ] `SearchableInput.svelte` - Modal background fix

### Medium Priority

- [ ] `CardVariantSelector.svelte` - Complete theming overhaul
- [ ] `FeatureFlagDebugPanel.svelte` - Debug panel theming
- [ ] Remaining hardcoded rgba values in `App.svelte`

### Low Priority

- [ ] Style guide documentation
- [ ] Linting rule implementation
- [ ] Component template creation

## Testing Requirements

- [ ] Verify all components in light mode
- [ ] Verify all components in dark mode
- [ ] Test theme switching transitions
- [ ] Verify accessibility contrast ratios
- [ ] Cross-browser compatibility testing

## Success Criteria

1. All dropdown menus respect the current theme
2. Header text adapts to theme changes
3. No hardcoded color values remain in component styles
4. Smooth transitions between light and dark themes
5. Consistent visual hierarchy across all components

## Related Files

- `app/frontend/public/global.css` - Theme variable definitions
- `app/frontend/src/App.svelte` - Main application component
- `app/frontend/src/components/CardSearchSelect.svelte` - Primary dropdown component
- `app/frontend/src/components/SearchableSelect.svelte` - Reference implementation (correctly uses variables)
- `app/frontend/src/components/SearchableInput.svelte` - Input component
- `app/frontend/src/components/CardVariantSelector.svelte` - Modal component
- `app/frontend/src/components/FeatureFlagDebugPanel.svelte` - Debug component

## Labels

- `frontend`
- `css`
- `theming`
- `refactor`
- `accessibility`
- `high-priority`
