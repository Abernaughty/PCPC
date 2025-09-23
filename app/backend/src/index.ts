import * as azureFunctions from '@azure/functions';
const { app } = azureFunctions;
import { CosmosDbService } from './services/CosmosDbService';
import { RedisCacheService } from './services/RedisCacheService';
import { BlobStorageService } from './services/BlobStorageService';
import { PokemonTcgApiService } from './services/PokemonTcgApiService';
import { PokeDataApiService } from './services/PokeDataApiService';

// Initialize shared services
export const cosmosDbService = new CosmosDbService(process.env.COSMOS_DB_CONNECTION_STRING || "");
export const redisCacheService = new RedisCacheService(
    process.env.REDIS_CONNECTION_STRING || "",
    process.env.ENABLE_REDIS_CACHE === "true"
);
export const blobStorageService = new BlobStorageService(
    process.env.BLOB_STORAGE_CONNECTION_STRING || ""
);
export const pokemonTcgApiService = new PokemonTcgApiService(
    process.env.POKEMON_TCG_API_KEY || "",
    process.env.POKEMON_TCG_API_BASE_URL
);
export const pokeDataApiService = new PokeDataApiService(
    process.env.POKEDATA_API_KEY || "",
    process.env.POKEDATA_API_BASE_URL
);

// Import function handlers
import { getSetList } from './functions/GetSetList';
import { getCardInfo } from './functions/GetCardInfo';
import { getCardsBySet } from './functions/GetCardsBySet';
import { refreshData } from './functions/RefreshData';
import { monitorCredits } from './functions/MonitorCredits';

// Register functions
app.http('getSetList', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'sets',
    handler: getSetList
});

app.http('getCardInfo', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'sets/{setId}/cards/{cardId}',
    handler: getCardInfo
});

app.http('getCardsBySet', {
    methods: ['GET'],
    authLevel: 'function',
    route: 'sets/{setId}/cards',
    handler: getCardsBySet
});


// Register timer-triggered functions
app.timer('refreshData', {
    schedule: '0 0 */12 * * *',
    handler: refreshData
});

app.timer('monitorCredits', {
    schedule: '0 0 */6 * * *',
    handler: monitorCredits
});

// Test deployment with path-based triggers - 2025-06-09