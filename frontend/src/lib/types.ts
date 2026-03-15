/**
 * Frontend type definitions for PCPC
 */

// Set types
export interface PokemonSet {
  id: string | number;
  code: string | null;
  name: string;
  series?: string;
  release_date?: string;
  releaseDate?: string;
  cardCount?: number;
}

export interface GroupedSets {
  type: 'group';
  label: string;
  items: PokemonSet[];
}

// Card types
export interface PokemonCard {
  id: string | number;
  name: string;
  number?: string;
  cardNumber?: string;
  rarity?: string;
  imageUrl?: string;
  imageUrlHiRes?: string;
  images?: {
    small?: string;
    large?: string;
    original?: string;
    variants?: Record<string, string>;
  };
  variants?: CardVariant[];
}

export interface CardVariant {
  id: string | number;
  name: string;
  type?: string;
  rarity?: string;
  imageUrl?: string;
  number?: string;
}

// Pricing types
export interface PriceData {
  market?: number;
  low?: number;
  mid?: number;
  high?: number;
}

export interface EnhancedPriceData {
  psaGrades?: Record<string, { value: number }>;
  cgcGrades?: Record<string, { value: number }>;
  ebayRaw?: { value: number };
}

export interface PricingResult {
  pricing: Record<string, PriceData | EnhancedPriceData | Record<string, unknown>>;
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
