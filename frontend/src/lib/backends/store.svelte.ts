/**
 * Backend selection store (Svelte 5 runes).
 *
 * Responsibilities:
 *   - Hold the currently active `BackendDefinition`.
 *   - Sync to/from the `?backend=` URL query parameter.
 *   - Persist the user's last choice in localStorage so toggling survives
 *     page reloads.
 *   - Run an initial healthcheck for every registered backend and refresh
 *     periodically.
 *   - Auto-fall-back to the default backend if the active one becomes
 *     unhealthy.
 */

import { browser } from '$app/environment';
import { createContextLogger } from '$lib/services/logger';
import { pathA } from './path-a-vercel';
import { pathB } from './path-b-azure';
import { pathC } from './path-c-aca';
import type {
  BackendDefinition,
  BackendHealth,
  BackendId,
} from './types';

const log = createContextLogger('backendStore');

const STORAGE_KEY = 'pcpc_active_backend';
const QUERY_PARAM = 'backend';
const HEALTH_REFRESH_MS = 60_000;

const REGISTRY: Record<BackendId, BackendDefinition> = {
  vercel: pathA,
  azure: pathB,
  aca: pathC,
};

const ALL: BackendDefinition[] = [pathA, pathB, pathC];

const DEFAULT_ID: BackendId = 'vercel';

function isBackendId(value: string | null): value is BackendId {
  return value === 'vercel' || value === 'azure' || value === 'aca';
}

function readUrlBackendId(): BackendId | null {
  if (!browser) return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get(QUERY_PARAM);
  return isBackendId(value) ? value : null;
}

function readStoredBackendId(): BackendId | null {
  if (!browser) return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isBackendId(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredBackendId(id: BackendId): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* quota errors ignored */
  }
}

function writeUrlBackendId(id: BackendId): void {
  if (!browser) return;
  const url = new URL(window.location.href);
  if (id === DEFAULT_ID) {
    url.searchParams.delete(QUERY_PARAM);
  } else {
    url.searchParams.set(QUERY_PARAM, id);
  }
  history.replaceState(history.state, '', url.toString());
}

function resolveInitialId(): BackendId {
  return readUrlBackendId() ?? readStoredBackendId() ?? DEFAULT_ID;
}

function createBackendStore() {
  let activeId: BackendId = $state(DEFAULT_ID);
  const healthMap: Record<BackendId, BackendHealth> = $state({
    vercel: { status: 'unknown' },
    azure: { status: 'unknown' },
    aca: { status: 'unknown' },
  });

  let pollHandle: ReturnType<typeof setInterval> | null = null;

  function setActive(id: BackendId): void {
    if (!REGISTRY[id]) return;
    if (activeId === id) return;
    activeId = id;
    writeStoredBackendId(id);
    writeUrlBackendId(id);
    log.info(`Active backend → ${id}`);
  }

  async function refreshHealth(id: BackendId): Promise<BackendHealth> {
    const def = REGISTRY[id];
    try {
      const result = await def.healthcheck();
      healthMap[id] = result;
      return result;
    } catch (err) {
      const result: BackendHealth = {
        status: 'unhealthy',
        checkedAt: Date.now(),
        message: (err as Error).message,
      };
      healthMap[id] = result;
      return result;
    }
  }

  async function refreshAllHealth(): Promise<void> {
    await Promise.all(ALL.map((def) => refreshHealth(def.id)));
    // If the active backend went unhealthy and the default is healthy,
    // fall back automatically. Don't override a user-pinned choice that
    // happens to be unhealthy if the alternative is also unhealthy.
    const activeHealth = healthMap[activeId];
    if (
      activeId !== DEFAULT_ID &&
      activeHealth.status === 'unhealthy' &&
      healthMap[DEFAULT_ID].status !== 'unhealthy'
    ) {
      log.warn(
        `Active backend "${activeId}" is unhealthy; reverting to "${DEFAULT_ID}"`
      );
      setActive(DEFAULT_ID);
    }
  }

  function init(): void {
    if (!browser) return;
    activeId = resolveInitialId();
    writeUrlBackendId(activeId);
    writeStoredBackendId(activeId);
    void refreshAllHealth();
    if (pollHandle === null) {
      pollHandle = setInterval(() => {
        void refreshAllHealth();
      }, HEALTH_REFRESH_MS);
    }
  }

  return {
    /** All registered backends in declaration order. */
    get all() {
      return ALL;
    },
    /** ID of the currently active backend. */
    get activeId() {
      return activeId;
    },
    /** Active `BackendDefinition`. */
    get active() {
      return REGISTRY[activeId];
    },
    /** Latest health snapshot for every backend. */
    get health() {
      return healthMap;
    },
    /** Default backend ID (the user-facing fallback). */
    get defaultId() {
      return DEFAULT_ID;
    },
    setActive,
    refreshHealth,
    refreshAllHealth,
    init,
  };
}

export const backendStore = createBackendStore();
