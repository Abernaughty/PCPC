/**
 * Frontend type definitions for PCPC
 */

// Set types
export interface PokemonSet {
  id: string;
  code: string;
  name: string;
  series: string;
  releaseDate?: string;
  total?: number;
  printedTotal?: number;
  language?: string;
  languageCode?: string;
  isOnlineOnly?: boolean;
  logo?: string;
  symbol?: string;
  cardCount?: number;
}

export interface GroupedSets {
  type: 'group';
  label: string;
  items: PokemonSet[];
  /** Date range derived from set releaseDates, e.g. "2023 \u2013 present" */
  dateRange?: string;
}

// Card types
export interface PokemonCard {
  id: string;
  name: string;
  number?: string;
  cardNumber?: string;
  printedNumber?: string;
  rarity?: string;
  rarityCode?: string;
  artist?: string;
  images?: CardImage[];
  variants?: CardVariant[];
  /** Timestamp of when pricing was last fetched for this card */
  pricingLastUpdated?: string;
}

export interface CardImage {
  type: string;
  small: string;
  medium: string;
  large: string;
}

export interface CardVariant {
  name: string;
  images?: CardImage[];
  prices: VariantPrice[];
}

// Pricing types
export interface VariantPrice {
  condition: string;
  type: 'raw' | 'graded';
  company?: string;
  grade?: string;
  isPerfect: boolean;
  isError: boolean;
  isSigned: boolean;
  low: number;
  mid?: number;
  high?: number;
  market: number;
  currency: string;
  trends?: PriceTrends;
}

export interface PriceTrends {
  days1?: TrendData;
  days7?: TrendData;
  days14?: TrendData;
  days30?: TrendData;
  days90?: TrendData;
  days180?: TrendData;
}

export interface TrendData {
  priceChange: number;
  percentChange: number;
}

export interface PricingResult {
  variants?: CardVariant[];
  metadata?: {
    timestamp?: number;
    fromCache?: boolean;
    isStale?: boolean;
  };
}

// API response wrapper (matches backend)
export interface ApiResponse<T> {
  status: number;
  data?: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
}

// Theme
export type Theme = 'light' | 'dark';
