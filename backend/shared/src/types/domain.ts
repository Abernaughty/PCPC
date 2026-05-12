// Canonical domain types shared across PCPC paths.
//
// These are the camelCase shapes persisted in Cosmos DB and returned by
// every backend (Vercel BFF, Azure Functions / APIM, ACA-containerized
// Functions). They are mapped from Scrydex API responses at the service
// boundary; consumers downstream never see snake_case.

export interface Card {
  id: string;
  setCode: string;
  setId: string;
  setName: string;
  cardId: string;
  cardName: string;
  cardNumber: string;
  printedNumber?: string;
  rarity: string;
  rarityCode?: string;
  artist?: string;
  images?: CardImage[];
  variants?: CardVariant[];
  lastUpdated?: string;
  pricingLastUpdated?: string;
  language?: string;
  languageCode?: string;
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
  isCurrent?: boolean;
  lastUpdated?: string;
}
