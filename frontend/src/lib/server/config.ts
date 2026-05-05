import { env } from '$env/dynamic/private';
import type { AppConfig } from './models/types';

export function getConfig(): AppConfig {
  return {
    cosmosDbConnectionString: env.COSMOS_DB_CONNECTION_STRING ?? '',
    cosmosDbDatabaseName: env.COSMOS_DB_DATABASE_NAME ?? 'PokemonCardsScrydex',
    cosmosDbCardsContainerName: env.COSMOS_DB_CARDS_CONTAINER_NAME ?? 'Cards',
    cosmosDbSetsContainerName: env.COSMOS_DB_SETS_CONTAINER_NAME ?? 'Sets',
    redisConnectionString: env.REDIS_CONNECTION_STRING,
    enableRedisCache: env.ENABLE_REDIS_CACHE === 'true',
    scrydexApiKey: env.SCRYDEX_API_KEY ?? '',
    scrydexTeamId: env.SCRYDEX_TEAM_ID ?? '',
    scrydexApiBaseUrl: env.SCRYDEX_API_BASE_URL ?? 'https://api.scrydex.com/pokemon/v1',
    cacheTtlSets: parseInt(env.CACHE_TTL_SETS ?? '604800', 10),
    cacheTtlCards: parseInt(env.CACHE_TTL_CARDS ?? '3600', 10),
  };
}
