// Scrydex API response shapes (snake_case as returned by api.scrydex.com).
//
// These mirror the upstream wire format exactly so a service-layer
// boundary can map them to camelCase domain types for persistence and
// UI consumption. Lifted from frontend/src/lib/server/services/scrydexApi.ts
// so backend and frontend share one canonical definition.

export interface ScrydexExpansion {
  id: string;
  code: string;
  name: string;
  series: string;
  release_date: string;
  total: number;
  printed_total: number;
  language: string;
  language_code: string;
  is_online_only: boolean;
  logo?: string;
  symbol?: string;
  /** English translations for JP sets (work in progress on Scrydex side) */
  translation?: {
    en?: {
      name?: string;
    };
  };
}

export interface ScrydexCard {
  id: string;
  name: string;
  number: string;
  printed_number?: string;
  rarity?: string;
  rarity_code?: string;
  artist?: string;
  language?: string;
  language_code?: string;
  expansion: {
    id: string;
    code: string;
    name: string;
    series?: string;
  };
  images?: ScrydexImage[];
  variants?: ScrydexVariant[];
}

export interface ScrydexImage {
  type: string;
  small: string;
  medium: string;
  large: string;
}

export interface ScrydexVariant {
  name: string;
  images?: ScrydexImage[];
  prices?: ScrydexPrice[];
}

export interface ScrydexPrice {
  condition: string;
  type: 'raw' | 'graded';
  company?: string;
  grade?: string;
  is_perfect: boolean;
  is_error: boolean;
  is_signed: boolean;
  low: number;
  mid?: number;
  high?: number;
  market: number;
  currency: string;
  trends?: {
    days_1?: { price_change: number; percent_change: number };
    days_7?: { price_change: number; percent_change: number };
    days_14?: { price_change: number; percent_change: number };
    days_30?: { price_change: number; percent_change: number };
    days_90?: { price_change: number; percent_change: number };
    days_180?: { price_change: number; percent_change: number };
  };
}

/**
 * Raw paginated response shape from the Scrydex API (snake_case).
 *
 * Some query params (e.g. ?select=) strip pagination metadata
 * from the response, so pagination loops must be resilient to missing
 * metadata. Use `data.length < requestedPageSize` as the stop condition.
 */
export interface ScrydexRawPaginatedResponse<T> {
  data: T[];
  page?: number;
  page_size?: number;
  count?: number;
  total_count?: number;
}

export interface ScrydexPaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface ScrydexUsage {
  totalCredits: number;
  remainingCredits: number;
  usedCredits: number;
  overageCreditRate: number;
}

export interface ScrydexListing {
  id: string;
  seller?: string;
  price?: number;
  currency?: string;
  condition?: string;
  url?: string;
}
