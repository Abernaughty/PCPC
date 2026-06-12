import { describe, it, expect } from 'vitest';
import { apiError, apiSuccess } from './errors';

describe('apiError', () => {
  it('returns a JSON response with the given status and message', async () => {
    const response = apiError('Set not found', 404);
    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body.status).toBe(404);
    expect(body.error).toBe('Set not found');
    expect(body.data).toBeUndefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('defaults to status 500', async () => {
    const response = apiError('boom');
    expect(response.status).toBe(500);
    expect((await response.json()).status).toBe(500);
  });
});

describe('apiSuccess', () => {
  it('wraps data with status and timestamp', async () => {
    const response = apiSuccess({ cards: [1, 2, 3] });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe(200);
    expect(body.data).toEqual({ cards: [1, 2, 3] });
    expect(body.error).toBeUndefined();
  });

  it('passes through the cached flag and custom status', async () => {
    const response = apiSuccess('ok', 201, true);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.cached).toBe(true);
  });
});
