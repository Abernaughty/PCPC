/**
 * Backend abstraction — public re-exports.
 *
 * Consumers should only import from `$lib/backends`; internal modules
 * (path-a-vercel, path-b-azure) are implementation details.
 */

export { backendStore } from './store.svelte';
export { pathA } from './path-a-vercel';
export { pathB } from './path-b-azure';
export type {
  BackendDefinition,
  BackendFetcher,
  BackendHealth,
  BackendHealthStatus,
  BackendId,
} from './types';
