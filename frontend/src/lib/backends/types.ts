/**
 * Backend abstraction types
 *
 * The frontend talks to a single `BackendDefinition` at a time. Switching
 * paths (?backend=vercel|azure|aca) swaps the active definition; everything
 * downstream — routes, stores, services — stays unchanged.
 *
 * See docs/adr/ADR-008 (Path A vs Path B gateway tradeoff) and
 * docs/adr/ADR-009 (Path B vs Path C runtime tradeoff) for context.
 */

import type { ApiResponse } from '$lib/types';

export type BackendId = 'vercel' | 'azure' | 'aca';

/**
 * Health states map directly onto the existing /api/health response codes:
 *   200 → healthy, 207 → degraded, 503 → unhealthy.
 * `unknown` covers the pre-first-check window so the UI can render a
 * neutral state rather than incorrectly claiming a path is broken.
 */
export type BackendHealthStatus =
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'unknown';

export interface BackendHealth {
  status: BackendHealthStatus;
  latencyMs?: number;
  checkedAt?: number;
  message?: string;
}

/**
 * A `BackendFetcher` accepts the same path strings the existing api.ts
 * service produces (e.g. `/sets?language=en&all=true`) and returns the
 * canonical Scrydex-shaped envelope. As of Phase 2 both paths serve
 * Scrydex shape natively, so the fetchers are thin pass-throughs.
 */
export interface BackendFetcher {
  fetch<T>(canonicalPath: string, init?: RequestInit): Promise<ApiResponse<T>>;
}

export interface BackendDefinition {
  id: BackendId;
  label: string;
  shortLabel: string;
  description: string;
  /** Always-on backends are visible in the toggle even before the first healthcheck. */
  alwaysVisible: boolean;
  fetcher: BackendFetcher;
  healthcheck: () => Promise<BackendHealth>;
}
