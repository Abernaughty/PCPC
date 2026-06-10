import * as azureFunctions from "@azure/functions";
import { logger } from "./utils/logger";
import { BlobStorageService } from "./services/BlobStorageService";
import { CosmosDbService } from "./services/CosmosDbService";
import { MonitoringService } from "./services/MonitoringService";
import { PokeDataApiService } from "./services/PokeDataApiService";
import { PokemonTcgApiService } from "./services/PokemonTcgApiService";
import { RedisCacheService } from "./services/RedisCacheService";
import { SetMappingRepository } from "./services/SetMappingRepository";
import { SetMatchingEngine } from "./services/SetMatchingEngine";
import { PokeDataToTcgMappingService } from "./services/PokeDataToTcgMappingService";
import { ImageUrlUpdateService } from "./services/ImageUrlUpdateService";
import { SetMappingOrchestrator } from "./services/SetMappingOrchestrator";
const { app } = azureFunctions;

logger.info(
  `Initializing Azure Functions services (env: ${
    process.env.NODE_ENV || "unknown"
  })`
);
logger.debug("Environment variable status", {
  COSMOS_DB_CONNECTION_STRING: !!process.env.COSMOS_DB_CONNECTION_STRING,
  COSMOS_DB_DATABASE_NAME: process.env.COSMOS_DB_DATABASE_NAME || "NOT SET",
  POKEDATA_API_KEY: !!process.env.POKEDATA_API_KEY,
  POKEDATA_API_BASE_URL: process.env.POKEDATA_API_BASE_URL || "NOT SET",
  POKEMON_TCG_API_KEY: !!process.env.POKEMON_TCG_API_KEY,
  REDIS_CACHE_ENABLED: process.env.ENABLE_REDIS_CACHE === "true",
});

// Initialize shared services
export const cosmosDbService = new CosmosDbService(
  process.env.COSMOS_DB_CONNECTION_STRING || ""
);

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

export const monitoringService = MonitoringService.getInstance();

export const setMappingRepository = new SetMappingRepository(
  process.env.COSMOS_DB_CONNECTION_STRING || ""
);

const mappingCacheTtlSeconds = parseInt(
  process.env.SET_MAPPING_CACHE_TTL_SECONDS || "900",
  10
);

export const pokeDataToTcgMappingService = new PokeDataToTcgMappingService(
  setMappingRepository,
  mappingCacheTtlSeconds
);

export const imageUrlUpdateService = new ImageUrlUpdateService(
  cosmosDbService,
  pokeDataToTcgMappingService
);

const setMatchingEngine = new SetMatchingEngine();

export const setMappingOrchestrator = new SetMappingOrchestrator(
  pokeDataApiService,
  pokemonTcgApiService,
  setMappingRepository,
  setMatchingEngine,
  pokeDataToTcgMappingService,
  imageUrlUpdateService,
  monitoringService
);

logger.info("All services initialized");

// Import function handlers
import { getCardInfo } from "./functions/GetCardInfo";
import { getCardsBySet } from "./functions/GetCardsBySet";
import { getSetList } from "./functions/GetSetList";
import { healthCheck } from "./functions/HealthCheck";
import { monitorCredits } from "./functions/MonitorCredits";
import { refreshData } from "./functions/RefreshData";
import { synchronizeSetMappings } from "./functions/SynchronizeSetMappings";

// Register functions
app.http("getSetList", {
  methods: ["GET"],
  authLevel: "function",
  route: "sets",
  handler: getSetList,
});

app.http("getCardInfo", {
  methods: ["GET"],
  authLevel: "function",
  route: "sets/{setId}/cards/{cardId}",
  handler: getCardInfo,
});

app.http("getCardsBySet", {
  methods: ["GET"],
  authLevel: "function",
  route: "sets/{setId}/cards",
  handler: getCardsBySet,
});

app.http("healthCheck", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});

// Register timer-triggered functions
app.timer("refreshData", {
  schedule: "0 0 */12 * * *",
  handler: refreshData,
});

app.timer("monitorCredits", {
  schedule: "0 0 */6 * * *",
  handler: monitorCredits,
});

app.timer("synchronizeSetMappings", {
  schedule: process.env.SET_MAPPING_SYNC_CRON || "0 0 7 * * *",
  handler: synchronizeSetMappings,
});

// Test deployment with path-based triggers - 2025-06-09
