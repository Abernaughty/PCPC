// Canonical persistence/transport types — re-exported from @pcpc/shared
// so they are identical across the SvelteKit BFF, Azure Functions, and
// (Phase 2.2+) the ACA-containerized Functions image.
export type {
  Card,
  CardImage,
  CardVariant,
  VariantPrice,
  PriceTrends,
  TrendData,
  PokemonSet,
  ApiResponse,
  PaginatedResponse,
  ErrorResponse,
} from "@pcpc/shared";

// Health-check envelopes are intentionally NOT re-exported from
// @pcpc/shared. Path A (this BFF) and Path B (Azure Functions) ship
// different shapes today (Path A: `components`/`latency`, Path B:
// `checks`/`responseTime`); unifying them is out of scope for Phase 2.1.
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

// Config remains frontend-local — sourced from SvelteKit env at runtime.
export interface AppConfig {
  cosmosDbConnectionString: string;
  cosmosDbDatabaseName: string;
  cosmosDbCardsContainerName: string;
  cosmosDbSetsContainerName: string;
  redisConnectionString?: string;
  enableRedisCache: boolean;
  scrydexApiKey: string;
  scrydexTeamId: string;
  scrydexApiBaseUrl: string;
  cacheTtlSets: number;
  cacheTtlCards: number;
}
