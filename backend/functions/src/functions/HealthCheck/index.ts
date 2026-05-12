import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { monitoring } from "../../services/MonitoringService";

/**
 * HealthCheck — System health monitoring endpoint.
 *
 * Reports status for:
 * - Function runtime
 * - Cosmos DB connectivity (if configured)
 * - Scrydex API availability (if configured)
 * - Redis cache (if enabled)
 *
 * Endpoint: GET /api/health
 */

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    runtime: ComponentHealth;
    cosmosdb?: ComponentHealth;
    scrydexApi?: ComponentHealth;
    redis?: ComponentHealth;
  };
  version: string;
  environment: string;
}

interface ComponentHealth {
  status: "healthy" | "degraded" | "unhealthy" | "disabled";
  responseTime?: number;
  message?: string;
  lastChecked?: string;
}

export async function healthCheck(
  _request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  context.log(
    `[HealthCheck] Starting — Correlation ID: ${correlationId}`
  );

  try {
    const checks: HealthCheckResult["checks"] = {
      runtime: checkRuntime(),
    };

    if (process.env.COSMOS_DB_CONNECTION_STRING) {
      checks.cosmosdb = await checkCosmosDb();
    }

    if (process.env.SCRYDEX_API_KEY) {
      checks.scrydexApi = await checkScrydexApi();
    }

    if (process.env.ENABLE_REDIS_CACHE === "true") {
      checks.redis = await checkRedis();
    } else {
      checks.redis = {
        status: "disabled",
        message: "Redis caching is disabled",
      };
    }

    const overallStatus = determineOverallStatus(checks);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: monitoring.getVersion(),
      environment: monitoring.getEnvironment(),
    };

    const duration = Date.now() - startTime;

    monitoring.trackMetric("healthcheck.duration", duration, {
      correlationId,
      status: overallStatus,
    });
    monitoring.trackEvent("healthcheck.completed", {
      correlationId,
      status: overallStatus,
      duration,
      checksPerformed: Object.keys(checks).length,
    });

    context.log(
      `[HealthCheck] Completed in ${duration}ms — Status: ${overallStatus}`
    );

    const statusCode =
      overallStatus === "healthy"
        ? 200
        : overallStatus === "degraded"
        ? 207
        : 503;

    return {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
      body: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    monitoring.trackException(error as Error, {
      correlationId,
      functionName: "HealthCheck",
      duration,
    });
    context.error(`[HealthCheck] Error:`, error);

    return {
      status: 503,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: (error as Error).message,
          version: monitoring.getVersion(),
          environment: monitoring.getEnvironment(),
        },
        null,
        2
      ),
    };
  }
}

function checkRuntime(): ComponentHealth {
  return {
    status: "healthy",
    responseTime: 0,
    message: "Function runtime operational",
    lastChecked: new Date().toISOString(),
  };
}

async function checkCosmosDb(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const { CosmosDbService } = await import("../../services/CosmosDbService");
    const cosmosService = new CosmosDbService(
      process.env.COSMOS_DB_CONNECTION_STRING || ""
    );
    // Lightweight probe — single-key read by an arbitrary code. 404 is fine.
    await cosmosService.getSet("base1");
    return {
      status: "healthy",
      responseTime: Date.now() - startTime,
      message: "Cosmos DB connection successful",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      message: `Cosmos DB check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkScrydexApi(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const apiKey = process.env.SCRYDEX_API_KEY;
    const teamId = process.env.SCRYDEX_TEAM_ID || "";
    const baseUrl =
      process.env.SCRYDEX_API_BASE_URL || "https://api.scrydex.com/pokemon/v1";

    const response = await fetch(
      `${baseUrl}/en/expansions?page_size=1&select=id`,
      {
        headers: {
          "X-Api-Key": apiKey ?? "",
          "X-Team-ID": teamId,
          "Content-Type": "application/json",
        },
      }
    );

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: "healthy",
        responseTime,
        message: "Scrydex API accessible",
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      status: "degraded",
      responseTime,
      message: `Scrydex API returned status ${response.status}`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      responseTime: Date.now() - startTime,
      message: `Scrydex API check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const startTime = Date.now();
  try {
    const { RedisCacheService } = await import(
      "../../services/RedisCacheService"
    );
    const redisConnectionString =
      process.env.REDIS_CONNECTION_STRING || "redis://localhost:6379";
    const redisService = new RedisCacheService(redisConnectionString, true);
    await redisService.get("health-check-test");
    return {
      status: "healthy",
      responseTime: Date.now() - startTime,
      message: "Redis cache connection successful",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "degraded",
      responseTime: Date.now() - startTime,
      message: `Redis check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

function determineOverallStatus(
  checks: HealthCheckResult["checks"]
): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(checks)
    .filter((check): check is ComponentHealth => !!check)
    .filter((check) => check.status !== "disabled")
    .map((check) => check.status);

  if (statuses.includes("unhealthy")) return "unhealthy";
  if (statuses.includes("degraded")) return "degraded";
  return "healthy";
}
