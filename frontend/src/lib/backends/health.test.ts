import { describe, it, expect, afterEach, vi } from 'vitest';
import { statusFromHttp, probeHealth, HEALTH_TIMEOUT_MS } from './health';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('statusFromHttp', () => {
  it('maps 200 to healthy', () => {
    expect(statusFromHttp(200)).toBe('healthy');
  });

  it('maps 207 to degraded', () => {
    expect(statusFromHttp(207)).toBe('degraded');
  });

  it('maps everything else to unhealthy', () => {
    expect(statusFromHttp(503)).toBe('unhealthy');
    expect(statusFromHttp(404)).toBe('unhealthy');
    expect(statusFromHttp(500)).toBe('unhealthy');
  });
});

describe('probeHealth', () => {
  it('reports a healthy backend with latency and no message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    );

    const health = await probeHealth('https://example.test/api/health');
    expect(health.status).toBe('healthy');
    expect(health.message).toBeUndefined();
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    expect(health.checkedAt).toBeTypeOf('number');
  });

  it('reports a degraded backend on HTTP 207 without an error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('partial', { status: 207 }))
    );

    const health = await probeHealth('https://example.test/api/health');
    expect(health.status).toBe('degraded');
    // 207 is still within Response.ok (200-299), so no message is attached
    expect(health.message).toBeUndefined();
  });

  it('reports an unhealthy backend on HTTP 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('down', { status: 503 }))
    );

    const health = await probeHealth('https://example.test/api/health');
    expect(health.status).toBe('unhealthy');
    expect(health.message).toBe('HTTP 503');
  });

  it('never throws on network errors and surfaces the message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const health = await probeHealth('https://example.test/api/health');
    expect(health.status).toBe('unhealthy');
    expect(health.message).toBe('ECONNREFUSED');
    expect(health.latencyMs).toBeUndefined();
  });

  it('treats an aborted request as a timeout', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const health = await probeHealth('https://example.test/api/health');
    expect(health.status).toBe('unhealthy');
    expect(health.message).toBe(`timeout after ${HEALTH_TIMEOUT_MS}ms`);
  });
});
