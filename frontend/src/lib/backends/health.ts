/**
 * Healthcheck utilities shared by all backend definitions.
 *
 * Each path's healthcheck must resolve within `HEALTH_TIMEOUT_MS` or it is
 * treated as unhealthy. A path that does not respond gracefully degrades
 * out of the toggle UI rather than producing user-visible errors.
 */

import type { BackendHealth, BackendHealthStatus } from './types';

export const HEALTH_TIMEOUT_MS = 2000;

/** Convert an HTTP status code to a BackendHealthStatus. */
export function statusFromHttp(httpStatus: number): BackendHealthStatus {
  if (httpStatus === 200) return 'healthy';
  if (httpStatus === 207) return 'degraded';
  return 'unhealthy';
}

/**
 * Issue a GET to `url`, abort after `HEALTH_TIMEOUT_MS`, and return a
 * `BackendHealth` describing the outcome. Never throws.
 */
export async function probeHealth(url: string): Promise<BackendHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: statusFromHttp(response.status),
      latencyMs,
      checkedAt: Date.now(),
      message: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message =
      (error as Error).name === 'AbortError'
        ? `timeout after ${HEALTH_TIMEOUT_MS}ms`
        : (error as Error).message;
    return {
      status: 'unhealthy',
      checkedAt: Date.now(),
      message,
    };
  } finally {
    clearTimeout(timer);
  }
}
