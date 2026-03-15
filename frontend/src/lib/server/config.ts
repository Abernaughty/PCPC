import { env } from '$env/dynamic/private';
import type { AppConfig } from './models/types';

export function getConfig(): AppConfig {
  return {
    cosmosDbConnectionString: env.COSMOS_DB_CONNECTION_STRING ?? '',
    cosmosDbDatabaseName: env.COSMOS_DB_DATABASE_NAME ?? 'PokemonCards',
    cosmosDbCardsContainerName: env.COSMOS_DB_CARDS_CONTAINER_NAME ?? 'Cards',
    cosmosDbSetsContainerName: env.COSMOS_DB_SETS_CONTAINER_NAME ?? 'Sets',
    redisConnectionString: env.REDIS_CONNECTION_STRING,
    enableRedisCache: env.ENABLE_REDIS_CACHE === 'true',
    pokeDataApiKey: env.POKEDATA_API_KEY ?? '',
    pokeDataApiBaseUrl: env.POKEDATA_API_BASE_URL ?? 'https://www.pokedata.io/v0',
    pokemonTcgApiKey: env.POKEMON_TCG_API_KEY ?? '',
    pokemonTcgApiBaseUrl: env.POKEMON_TCG_API_BASE_URL ?? 'https://api.pokemontcg.io/v2',
    cacheTtlSets: parseInt(env.CACHE_TTL_SETS ?? '604800', 10),
    cacheTtlCards: parseInt(env.CACHE_TTL_CARDS ?? '3600', 10),
  };
}
