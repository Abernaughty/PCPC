// Card interfaces
export interface Card {
  id: string;
  setCode: string;
  setId: number;
  setName: string;
  cardId: string;
  cardName: string;
  cardNumber: string;
  rarity: string;
  imageUrl?: string;
  imageUrlHiRes?: string;
  originalImageUrl?: string;
  tcgPlayerPrice?: PriceData;
  enhancedPricing?: EnhancedPriceData;
  lastUpdated?: string;
  pokeDataId?: number;
  pricing?: Record<string, unknown>;
  pricingLastUpdated?: string;
  images?: CardImages;
}

export interface CardImages {
  small?: string;
  large?: string;
  original?: string;
  variants?: Record<string, string>;
}

export interface PriceData {
  market: number;
  low: number;
  mid: number;
  high: number;
}

export interface EnhancedPriceData {
  psaGrades?: Record<string, { value: number }>;
  cgcGrades?: Record<string, { value: number }>;
  ebayRaw?: { value: number };
}

// Set interfaces
export interface PokemonSet {
  id: string | number;
  code: string | null;
  name: string;
  series?: string;
  releaseDate?: string;
  release_date?: string;
  cardCount?: number;
  isCurrent?: boolean;
  lastUpdated?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  status: number;
  data?: T;
  error?: string;
  timestamp: string;
  cached?: boolean;
  cacheAge?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
}

// Health check
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: 'healthy' | 'unhealthy' | 'disabled';
  message?: string;
  latency?: number;
}

// Config
export interface AppConfig {
  cosmosDbConnectionString: string;
  cosmosDbDatabaseName: string;
  cosmosDbCardsContainerName: string;
  cosmosDbSetsContainerName: string;
  redisConnectionString?: string;
  enableRedisCache: boolean;
  pokeDataApiKey: string;
  pokeDataApiBaseUrl: string;
  pokemonTcgApiKey: string;
  pokemonTcgApiBaseUrl: string;
  cacheTtlSets: number;
  cacheTtlCards: number;
}
