/**
 * Path B — Azure API Management → Functions v4 (Consumption).
 *
 * The Functions code currently serves PokeData-shaped responses; the
 * pokedata→scrydex adapter reshapes them so the frontend can consume both
 * paths interchangeably. The adapter is removed in Phase 2 along with the
 * Functions schema migration.
 *
 * Base URL is configurable via the public env var
 * `PUBLIC_AZURE_API_BASE_URL`. Until the `api.pcpc.maber.io` custom domain
 * is provisioned in Phase 1B, the default points at the dev APIM hostname.
 */

import { env } from '$env/dynamic/public';
import type { ApiResponse } from '$lib/types';
import { probeHealth } from './health';
import {
  adaptPathBEnvelope,
} from './adapters/pokedata-to-scrydex';
import type { BackendDefinition, BackendFetcher, BackendHealth } from './types';

/**
 * Path B base URL.
 *
 * Falls back to the dev APIM hostname so the toggle works out-of-the-box
 * for local dev without env-var setup. Each Vercel deployment should set
 * PUBLIC_AZURE_API_BASE_URL to the matching custom domain once Phase 1B
 * provisions them:
 *   dev      → https://dev-api.pcpc.maber.io
 *   staging  → https://staging-api.pcpc.maber.io
 *   prod     → https://api.pcpc.maber.io
 */
const PATH_B_BASE = (() => {
  const fromEnv = env.PUBLIC_AZURE_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  return 'https://pcpc-apim-dev.azure-api.net/pcpc-api/v1';
})();

type EndpointHint = Parameters<typeof adaptPathBEnvelope>[1];

/**
 * Translate the canonical path the frontend produces into a Path B URL +
 * an endpoint hint for the response adapter. `canonicalPath` always
 * starts with `/`.
 *
 *   Frontend canonical               Path B target                       hint
 *   /sets?language=en&all=true   →   /sets?language=ENGLISH&all=true     sets
 *   /sets/sv8/cards              →   /sets/sv8/cards                     cards-by-set
 *   /sets/sv8/cards/12345        →   /sets/sv8/cards/12345               card-info
 *   /health                      →   /health                             health
 */
function translateCanonicalPath(
  canonicalPath: string
): { url: string; hint: EndpointHint } {
  const [pathPart, queryPart = ''] = canonicalPath.split('?');
  const params = new URLSearchParams(queryPart);

  // Translate language codes Scrydex → PokeData.
  const language = params.get('language');
  if (language) {
    if (language === 'en') params.set('language', 'ENGLISH');
    else if (language === 'ja' || language === 'jp') params.set('language', 'JAPANESE');
  }

  let hint: EndpointHint = 'passthrough';
  if (pathPart === '/sets') hint = 'sets';
  else if (/^\/sets\/[^/]+\/cards\/[^/]+$/.test(pathPart)) hint = 'card-info';
  else if (/^\/sets\/[^/]+\/cards$/.test(pathPart)) hint = 'cards-by-set';
  else if (pathPart === '/health') hint = 'health';

  const query = params.toString();
  const url = `${PATH_B_BASE}${pathPart}${query ? `?${query}` : ''}`;
  return { url, hint };
}

const fetcher: BackendFetcher = {
  async fetch<T>(canonicalPath: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const { url, hint } = translateCanonicalPath(canonicalPath);

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });

    const envelope = (await response.json()) as ApiResponse<unknown>;
    return adaptPathBEnvelope<T>(envelope, hint);
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
