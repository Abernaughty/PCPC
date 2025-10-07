import {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { monitoring } from "../../services/MonitoringService";

/**
 * HealthCheck Function - System health monitoring endpoint
 *
 * Provides comprehensive health status for all system components:
 * - Function runtime status
 * - Cosmos DB connectivity
 * - External API availability (PokeData API)
 * - Redis cache status (if enabled)
 *
 * Returns JSON response with detailed health information for monitoring systems.
 *
 * Endpoint: GET /api/health
 */

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  checks: {
    runtime: ComponentHealth;
    cosmosdb?: ComponentHealth;
    pokedataApi?: ComponentHealth;
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
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  context.log(
    `[HealthCheck] Starting health check - Correlation ID: ${correlationId}`
  );

  try {
    const checks: HealthCheckResult["checks"] = {
      runtime: await checkRuntime(),
    };

    // Check Cosmos DB if connection string is configured
    if (process.env.COSMOS_DB_CONNECTION_STRING) {
      checks.cosmosdb = await checkCosmosDb();
    }

    // Check PokeData API if API key is configured
    if (process.env.POKEDATA_API_KEY) {
      checks.pokedataApi = await checkPokeDataApi();
    }

    // Check Redis if enabled
    if (process.env.ENABLE_REDIS_CACHE === "true") {
      checks.redis = await checkRedis();
    } else {
      checks.redis = {
        status: "disabled",
        message: "Redis caching is disabled",
      };
    }

    // Determine overall health status
    const overallStatus = determineOverallStatus(checks);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      version: monitoring.getVersion(),
      environment: monitoring.getEnvironment(),
    };

    const duration = Date.now() - startTime;

    // Track health check metrics
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
      `[HealthCheck] Completed in ${duration}ms - Status: ${overallStatus}`
    );

    // Return appropriate HTTP status code based on health
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

    context.error(`[HealthCheck] Error during health check:`, error);

    return {
      status: 503,
      headers: {
        "Content-Type": "application/json",
      },
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

/**
 * Check Azure Functions runtime health
 */
async function checkRuntime(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    // Runtime is healthy if we can execute this code
    const responseTime = Date.now() - startTime;

    return {
      status: "healthy",
      responseTime,
      message: "Function runtime operational",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: `Runtime check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Cosmos DB connectivity
 */
async function checkCosmosDb(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    // Import CosmosDbService dynamically to avoid initialization issues
    const { CosmosDbService } = await import("../../services/CosmosDbService");
    const connectionString = process.env.COSMOS_DB_CONNECTION_STRING || "";
    const cosmosService = new CosmosDbService(connectionString);

    // Attempt a simple query to verify connectivity
    // This will throw if connection fails
    await cosmosService.getSet("base1");

    const responseTime = Date.now() - startTime;

    return {
      status: "healthy",
      responseTime,
      message: "Cosmos DB connection successful",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: "unhealthy",
      responseTime,
      message: `Cosmos DB check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check PokeData API availability
 */
async function checkPokeDataApi(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const apiKey = process.env.POKEDATA_API_KEY;
    const baseUrl =
      process.env.POKEDATA_API_BASE_URL || "https://www.pokedata.io/v0";

    // Make a simple API call to check availability
    const response = await fetch(`${baseUrl}/sets?limit=1`, {
      headers: {
        Authorization: `Bearer ${apiKey ?? ""}`,
        "Content-Type": "application/json",
      },
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: "healthy",
        responseTime,
        message: "PokeData API accessible",
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: "degraded",
        responseTime,
        message: `PokeData API returned status ${response.status}`,
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: "unhealthy",
      responseTime,
      message: `PokeData API check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check Redis cache connectivity
 */
async function checkRedis(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    // Import RedisCacheService dynamically
    const { RedisCacheService } = await import(
      "../../services/RedisCacheService"
    );
    const redisConnectionString =
      process.env.REDIS_CONNECTION_STRING || "redis://localhost:6379";
    const redisService = new RedisCacheService(redisConnectionString, true);

    // Attempt to get a test key
    await redisService.get("health-check-test");

    const responseTime = Date.now() - startTime;

    return {
      status: "healthy",
      responseTime,
      message: "Redis cache connection successful",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: "degraded",
      responseTime,
      message: `Redis check failed: ${(error as Error).message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Determine overall system health status based on component checks
 */
function determineOverallStatus(
  checks: HealthCheckResult["checks"]
): "healthy" | "degraded" | "unhealthy" {
  const statuses = Object.values(checks)
    .filter((check) => check.status !== "disabled")
    .map((check) => check.status);

  // If any component is unhealthy, system is unhealthy
  if (statuses.includes("unhealthy")) {
    return "unhealthy";
  }

  // If any component is degraded, system is degraded
  if (statuses.includes("degraded")) {
    return "degraded";
  }

  // All components are healthy
  return "healthy";
}
