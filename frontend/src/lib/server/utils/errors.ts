import { json } from '@sveltejs/kit';
import type { ApiResponse } from '../models/types';

export function apiError(message: string, status: number = 500): Response {
  const body: ApiResponse<never> = {
    status,
    error: message,
    timestamp: new Date().toISOString(),
  };
  return json(body, { status });
}

export function apiSuccess<T>(data: T, status: number = 200, cached?: boolean): Response {
  const body: ApiResponse<T> = {
    status,
    data,
    timestamp: new Date().toISOString(),
    cached,
  };
  return json(body, { status });
}
