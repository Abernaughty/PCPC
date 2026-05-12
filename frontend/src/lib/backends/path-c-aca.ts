/**
 * Path C — Azure Container Apps (ACA) running the same Functions image
 * as Path B.
 *
 * Added in Phase 2.2. Demonstrates the container runtime envelope on top
 * of byte-identical application code: same Functions source, same Cosmos
 * data, same Scrydex upstream — only the deployment model differs (OCI
 * image on ACA with KEDA-ready scaling, instead of a ZIP on Functions
 * Consumption). See ADR-009 for the runtime tradeoff.
 *
 * Base URL is configured via `PUBLIC_ACA_API_BASE_URL` on the Vercel
 * project (set per scope: Production / Preview / Development). Unlike
 * Path B, there is intentionally NO hard-coded fallback hostname:
 *
 *   - Path B's APIM hostname is stable and known at design time, so the
 *     fallback "works out-of-the-box for local dev."
 *   - Path C's ingress FQDN is environment-generated (`<app>.<unique>
 *     .<region>.azurecontainerapps.io`) and only known post-Terraform.
 *     Encoding a guess here would mask configuration errors as healthy
 *     deploys.
 *
 * When `PUBLIC_ACA_API_BASE_URL` is unset, PATH_C_BASE is empty and the
 * healthcheck request fails cleanly. The store's auto-fallback logic
 * (see `store.svelte.ts` lines 122-135) then hides Path C from the
 * toggle until the env var is set. Path A and Path B remain unaffected.
 */

import { env } from '$env/dynamic/public';
import type { ApiResponse } from '$lib/types';
import { probeHealth } from './health';
import type { BackendDefinition, BackendFetcher, BackendHealth } from './types';

/**
 * Path C base URL.
 *
 * Resolved at module load from `PUBLIC_ACA_API_BASE_URL`. Set this in
 * the Vercel project per scope:
 *   dev      → https://<aca-fqdn-dev>
 *   staging  → https://<aca-fqdn-staging>   (added when Phase 2.2
 *               staging promotion lands)
 *   prod     → https://<aca-fqdn-prod>      (likewise)
 *
 * The dev FQDN is produced by `terraform output container_app_fqdn`
 * after the Phase 2.2 PR-2 infra applies.
 */
const PATH_C_BASE = (() => {
  const fromEnv = env.PUBLIC_ACA_API_BASE_URL;
  if (fromEnv && fromEnv.length > 0) return fromEnv.replace(/\/$/, '');
  return '';
})();

/**
 * Translate the canonical frontend path into a Path C URL. The Functions
 * code that handles these routes is bit-identical to Path B's, so this
 * is a passthrough — no shape translation.
 *
 *   Frontend canonical               Path C target
 *   /sets?language=en&all=true   →   /sets?language=en&all=true
 *   /sets/sv8/cards              →   /sets/sv8/cards
 *   /sets/sv8/cards/12345        →   /sets/sv8/cards/12345
 *   /health                      →   /health
 */
function translateCanonicalPath(canonicalPath: string): string {
  return `${PATH_C_BASE}${canonicalPath}`;
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
  // If PATH_C_BASE is empty (env var unset), probeHealth's fetch will
  // synthesize an invalid URL and reject; the store catches that and
  // marks Path C unhealthy, hiding it from the toggle.
  if (!PATH_C_BASE) {
    return {
      status: 'unhealthy',
      checkedAt: Date.now(),
      message: 'PUBLIC_ACA_API_BASE_URL is not set',
    };
  }
  return probeHealth(`${PATH_C_BASE}/health`);
}

export const pathC: BackendDefinition = {
  id: 'aca',
  label: 'ACA Containerized Functions',
  shortLabel: 'ACA',
  description:
    'Same Azure Functions code as Path B, packaged as an OCI image and deployed to Azure Container Apps with KEDA-ready scaling.',
  alwaysVisible: false,
  fetcher,
  healthcheck,
};

export const __PATH_C_BASE_FOR_TESTS = PATH_C_BASE;
