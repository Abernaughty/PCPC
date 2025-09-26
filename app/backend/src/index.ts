import * as azureFunctions from "@azure/functions";
import { BlobStorageService } from "./services/BlobStorageService";
import { CosmosDbService } from "./services/CosmosDbService";
import { PokeDataApiService } from "./services/PokeDataApiService";
import { PokemonTcgApiService } from "./services/PokemonTcgApiService";
import { RedisCacheService } from "./services/RedisCacheService";
const { app } = azureFunctions;

// Enhanced logging for service initialization
console.log("🚀 [STARTUP] Initializing Azure Functions services...");
console.log(`📊 [STARTUP] Environment: ${process.env.NODE_ENV || "unknown"}`);
console.log(
  `🐛 [STARTUP] Debug Mode: ${
    process.env.DEBUG_MODE === "true" ? "ENABLED" : "DISABLED"
  }`
);

// Log environment variable status (without exposing sensitive values)
console.log("🔧 [STARTUP] Environment Variables Status:");
console.log(
  `  - COSMOS_DB_CONNECTION_STRING: ${
    process.env.COSMOS_DB_CONNECTION_STRING ? "✅ SET" : "❌ MISSING"
  }`
);
console.log(
  `  - COSMOS_DB_DATABASE_NAME: ${
    process.env.COSMOS_DB_DATABASE_NAME || "NOT SET"
  }`
);
console.log(
  `  - COSMOS_DB_CARDS_CONTAINER_NAME: ${
    process.env.COSMOS_DB_CONTAINER_NAME || "NOT SET"
  }`
);
console.log(
  `  - COSMOS_DB_SETS_CONTAINER_NAME: ${
    process.env.COSMOS_DB_CONTAINER_NAME || "NOT SET"
  }`
);
console.log(
  `  - POKEDATA_API_KEY: ${
    process.env.POKEDATA_API_KEY ? "✅ SET" : "❌ MISSING"
  }`
);
console.log(
  `  - POKEDATA_API_BASE_URL: ${process.env.POKEDATA_API_BASE_URL || "NOT SET"}`
);
console.log(
  `  - POKEMON_TCG_API_KEY: ${
    process.env.POKEMON_TCG_API_KEY ? "✅ SET" : "❌ MISSING"
  }`
);
console.log(
  `  - REDIS_CACHE_ENABLED: ${
    process.env.ENABLE_REDIS_CACHE === "true" ? "✅ ENABLED" : "❌ DISABLED"
  }`
);

// Initialize shared services with enhanced logging
console.log("🗄️ [STARTUP] Initializing Cosmos DB Service...");
export const cosmosDbService = new CosmosDbService(
  process.env.COSMOS_DB_CONNECTION_STRING || ""
);

console.log("🔄 [STARTUP] Initializing Redis Cache Service...");
export const redisCacheService = new RedisCacheService(
  process.env.REDIS_CONNECTION_STRING || "",
  process.env.ENABLE_REDIS_CACHE === "true"
);

console.log("📦 [STARTUP] Initializing Blob Storage Service...");
export const blobStorageService = new BlobStorageService(
  process.env.BLOB_STORAGE_CONNECTION_STRING || ""
);

console.log("🎮 [STARTUP] Initializing Pokemon TCG API Service...");
export const pokemonTcgApiService = new PokemonTcgApiService(
  process.env.POKEMON_TCG_API_KEY || "",
  process.env.POKEMON_TCG_API_BASE_URL
);

console.log("🔥 [STARTUP] Initializing PokeData API Service...");
export const pokeDataApiService = new PokeDataApiService(
  process.env.POKEDATA_API_KEY || "",
  process.env.POKEDATA_API_BASE_URL
);

console.log("✅ [STARTUP] All services initialized successfully!");

// Import function handlers
import { getCardInfo } from "./functions/GetCardInfo";
import { getCardsBySet } from "./functions/GetCardsBySet";
import { getSetList } from "./functions/GetSetList";
import { monitorCredits } from "./functions/MonitorCredits";
import { refreshData } from "./functions/RefreshData";

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

// Register timer-triggered functions
app.timer("refreshData", {
  schedule: "0 0 */12 * * *",
  handler: refreshData,
});

app.timer("monitorCredits", {
  schedule: "0 0 */6 * * *",
  handler: monitorCredits,
});

// Test deployment with path-based triggers - 2025-06-09
