// Common API response envelopes used by all PCPC backends.

export interface ApiResponse<T> {
  status: number;
  data?: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
  cacheAge?: number;
}

export interface ErrorResponse {
  error: string;
  status: number;
  timestamp: string;
  path?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
}

// Health-check shapes are intentionally NOT in @pcpc/shared. Path A
// (SvelteKit BFF) and Path B (Azure Functions) emit slightly different
// envelopes today and unifying them is out of scope.
