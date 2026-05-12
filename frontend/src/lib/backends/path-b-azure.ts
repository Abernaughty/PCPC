/**
 * Path B — Azure API Management → Azure Functions v4 (Consumption).
 *
 * As of Phase 2 the Functions backend serves canonical Scrydex-shaped
 * envelopes directly from @pcpc/shared, so no client-side reshape is
 * needed. The previous PokeData→Scrydex adapter was removed.
 *
 * Base URL is configurable via the public env var
 * `PUBLIC_AZURE_API_BASE_URL`. Until the `api.pcpc.maber.io` custom
 * domain is provisioned (deferred per ADR-012), the default points at
 * the dev APIM hostname.
 */

import { env } from '$env/dynamic/public';
import type { ApiResponse } from '$lib/types';
import { probeHealth } from './health';
import type { BackendDefinition, BackendFetcher, BackendHealth } from './types';

/**
 * Path B base URL.
 *
 * Falls back to the dev APIM hostname so the toggle works out-of-the-box
 * for local dev without env-var setup. Each Vercel deployment should set
 * PUBLIC_AZURE_API_BASE_URL to the matching custom domain when those are
 * re-enabled post-ADR-012:
 *   dev      → https://dev-api.pcpc.maber.io
 *   staging  → https://staging-api.pcpc.maber.io
 *   prod     → https://api.pcpc.maber.io
 */
const PATH_B_BASE = (() => {
  const fromEnv = env.PUBLIC_AZURE_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  return 'https://pcpc-apim-dev.azure-api.net/pcpc-api/v1';
})();

/**
 * Translate the canonical path the frontend produces into a Path B URL.
 * The Scrydex shape is now native on both sides, so this is a near-
 * passthrough — no language code translation, no field reshape.
 *
 *   Frontend canonical               Path B target
 *   /sets?language=en&all=true   →   /sets?language=en&all=true
 *   /sets/sv8/cards              →   /sets/sv8/cards
 *   /sets/sv8/cards/12345        →   /sets/sv8/cards/12345
 *   /health                      →   /health
 */
function translateCanonicalPath(canonicalPath: string): string {
  return `${PATH_B_BASE}${canonicalPath}`;
}

const fetcher: BackendFetcher = {
  async fetch<T>(canonicalPath: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const url = translateCanonicalPath(canonicalPath);
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    return (await response.json()) as ApiResponse<T>;
  },
};

async function healthcheck(): Promise<BackendHealth> {
  return probeHealth(`${PATH_B_BASE}/health`);
}

export const pathB: BackendDefinition = {
  id: 'azure',
  label: 'APIM + Azure Functions',
  shortLabel: 'Azure',
  description:
    'Azure API Management (Consumption) routing to Azure Functions v4 (Node.js 22).',
  alwaysVisible: false,
  fetcher,
  healthcheck,
};

export const __PATH_B_BASE_FOR_TESTS = PATH_B_BASE;
