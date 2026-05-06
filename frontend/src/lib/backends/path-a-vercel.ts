/**
 * Path A — SvelteKit BFF on Vercel.
 *
 * Same Vercel deployment as the frontend itself. The fetcher is a thin
 * pass-through that prefixes `/api` and forwards the standard envelope.
 * This is the canonical product experience and the default path.
 */

import type { ApiResponse } from '$lib/types';
import { probeHealth } from './health';
import type { BackendDefinition, BackendFetcher, BackendHealth } from './types';

const PATH_A_BASE = '/api';

const fetcher: BackendFetcher = {
  async fetch<T>(canonicalPath: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${PATH_A_BASE}${canonicalPath}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });

    // Both error and success bodies are JSON. Let the caller decide how to
    // surface non-2xx responses; we pass the envelope through unchanged.
    return (await response.json()) as ApiResponse<T>;
  },
};

async function healthcheck(): Promise<BackendHealth> {
  return probeHealth(`${PATH_A_BASE}/health`);
}

export const pathA: BackendDefinition = {
  id: 'vercel',
  label: 'Vercel BFF (SvelteKit)',
  shortLabel: 'Vercel',
  description: 'SvelteKit +server.ts routes co-deployed with the frontend on Vercel.',
  alwaysVisible: true,
  fetcher,
  healthcheck,
};
