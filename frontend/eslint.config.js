import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		// Pragmatic rule levels for the current PCPC frontend codebase. The
		// "warn" rules below are real code smells worth tracking, but blocking
		// CI on every occurrence is too aggressive while the app is still
		// evolving. Tighten to "error" once the cleanup is in flight. This
		// config was inlined from @maber/config/eslint during the Phase 0
		// consolidation.
		rules: {
			// `any` is intentional at external API boundaries (Cosmos, Scrydex).
			// Codify boundary types later; warn for now.
			'@typescript-eslint/no-explicit-any': 'warn',

			// goto() without resolve() is Svelte 5 best practice; legacy paths
			// use raw strings. Migrate as part of route refactor; warn for now.
			'svelte/no-navigation-without-resolve': 'warn',

			// Each-block keys are an optimization. Svelte handles unkeyed each
			// fine at runtime; missing keys only matter for diff stability across
			// moves. Warn so we add keys opportunistically.
			'svelte/require-each-key': 'warn',

			// Modern Svelte prefers SvelteSet/SvelteMap for reactivity, but several
			// components use Set as plain data. Migrate as part of state audit.
			'svelte/prefer-svelte-reactivity': 'warn',

			// Empty catch blocks are sometimes intentional (silent fallback). Add
			// explanatory comments rather than failing CI.
			'no-empty': 'warn',

			// @ts-ignore vs @ts-expect-error is style guidance; both suppress.
			'@typescript-eslint/ban-ts-comment': 'warn',

			// prefer-const flags assignments that could be const. Useful but not
			// blocking — fix during the next code touch.
			'prefer-const': 'warn',

			// Allow leading underscore on intentionally-unused identifiers
			// (matches the `(_, idx) =>` pattern common in callbacks).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		ignores: [
			'**/node_modules/',
			'**/dist/',
			'**/build/',
			'**/.svelte-kit/',
			'**/.turbo/',
			'**/.vercel/'
		]
	}
];
