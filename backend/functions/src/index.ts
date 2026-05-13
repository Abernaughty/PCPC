import * as azureFunctions from "@azure/functions";
import { CosmosDbService } from "./services/CosmosDbService";
import { MonitoringService } from "./services/MonitoringService";
import { RedisCacheService } from "./services/RedisCacheService";
import { ScrydexApiService } from "./services/ScrydexApiService";

const { app } = azureFunctions;

console.log("🚀 [STARTUP] Initializing Azure Functions services...");
console.log(`📊 [STARTUP] Environment: ${process.env.NODE_ENV || "unknown"}`);
console.log(
  `🐛 [STARTUP] Debug Mode: ${
    process.env.DEBUG_MODE === "true" ? "ENABLED" : "DISABLED"
  }`
);

console.log("🔧 [STARTUP] Environment Variables Status:");
console.log(
  `  - COSMOS_DB_CONNECTION_STRING: ${
    process.env.COSMOS_DB_CONNECTION_STRING ? "✅ SET" : "❌ MISSING"
  }`
);
console.log(
  `  - COSMOS_DB_DATABASE_NAME: ${process.env.COSMOS_DB_DATABASE_NAME || "NOT SET"}`
);
console.log(
  `  - COSMOS_DB_CARDS_CONTAINER_NAME: ${
    process.env.COSMOS_DB_CARDS_CONTAINER_NAME || "NOT SET"
  }`
);
console.log(
  `  - COSMOS_DB_SETS_CONTAINER_NAME: ${
    process.env.COSMOS_DB_SETS_CONTAINER_NAME || "NOT SET"
  }`
);
console.log(
  `  - SCRYDEX_API_KEY: ${
    process.env.SCRYDEX_API_KEY ? "✅ SET" : "❌ MISSING"
  }`
);
console.log(
  `  - SCRYDEX_TEAM_ID: ${
    process.env.SCRYDEX_TEAM_ID ? "✅ SET" : "❌ MISSING"
  }`
);
console.log(
  `  - SCRYDEX_API_BASE_URL: ${process.env.SCRYDEX_API_BASE_URL || "NOT SET (using default)"}`
);
console.log(
  `  - REDIS_CACHE_ENABLED: ${
    process.env.ENABLE_REDIS_CACHE === "true" ? "✅ ENABLED" : "❌ DISABLED"
  }`
);

console.log("🗄️ [STARTUP] Initializing Cosmos DB Service...");
export const cosmosDbService = new CosmosDbService(
  process.env.COSMOS_DB_CONNECTION_STRING || ""
);

console.log("🔄 [STARTUP] Initializing Redis Cache Service...");
export const redisCacheService = new RedisCacheService(
  process.env.REDIS_CONNECTION_STRING || "",
  process.env.ENABLE_REDIS_CACHE === "true"
);

console.log("🎴 [STARTUP] Initializing Scrydex API Service...");
export const scrydexApiService = new ScrydexApiService(
  process.env.SCRYDEX_API_KEY || "",
  process.env.SCRYDEX_TEAM_ID || "",
  process.env.SCRYDEX_API_BASE_URL || "https://api.scrydex.com/pokemon/v1"
);

console.log("📊 [STARTUP] Initializing Monitoring Service...");
export const monitoringService = MonitoringService.getInstance();

console.log("✅ [STARTUP] All services initialized successfully!");

// Import function handlers
import { getCardInfo } from "./functions/GetCardInfo";
import { getCardsBySet } from "./functions/GetCardsBySet";
import { getSetList } from "./functions/GetSetList";
import { healthCheck } from "./functions/HealthCheck";
import { monitorScrydexUsage } from "./functions/MonitorScrydexUsage";
import { refreshData } from "./functions/RefreshData";

// HTTP triggers
//
// authLevel: "anonymous" on the read endpoints. Auth lives at the gateway
// layer (APIM regex policy on Path B, ACA ingress CORS on Path C) per
// ADR-009's intent. With Path C bypassing APIM, function-key auth on
// the Functions host would 401 every browser request to /api/sets,
// /api/sets/{setId}/cards, and /api/cards/{cardId}. Moving auth to the
// gateway means the same code path serves both gateways without
// per-runtime branching.
//
// Side effect: Path B's Function App URL is now anonymously callable
// too. APIM still provides rate limiting, the developer portal, and
// observability — those are its value-add, not "the only ingress that
// can call this." See ADR-009's "ACR ownership" subsection nearby for
// the parallel reasoning on shared-infrastructure ownership.
app.http("getSetList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets",
  handler: getSetList,
});

app.http("getCardInfo", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets/{setId}/cards/{cardId}",
  handler: getCardInfo,
});

app.http("getCardsBySet", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "sets/{setId}/cards",
  handler: getCardsBySet,
});

app.http("healthCheck", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});

// Timer triggers
app.timer("refreshData", {
  schedule: "0 0 */12 * * *",
  handler: refreshData,
});

app.timer("monitorScrydexUsage", {
  schedule: "0 0 */6 * * *",
  handler: monitorScrydexUsage,
});
