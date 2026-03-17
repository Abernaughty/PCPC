import type { RequestHandler } from './$types';
import { getCosmosDbService } from '$lib/server/services/cosmosDb';
import { getRedisCacheService } from '$lib/server/services/redisCache';
import { getScrydexApiService } from '$lib/server/services/scrydexApi';
import { monitoring } from '$lib/server/services/monitoring';
import type { HealthCheckResult, ComponentHealth } from '$lib/server/models/types';
import { json } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  const startTime = Date.now();
  const correlationId = monitoring.createCorrelationId();

  console.log(`[HealthCheck] Starting health check - Correlation ID: ${correlationId}`);

  try {
    const checks: Record<string, ComponentHealth> = {
      runtime: await checkRuntime(),
    };

    // Check Cosmos DB
    const cosmosDbConnectionString = process.env.COSMOS_DB_CONNECTION_STRING;
    if (cosmosDbConnectionString) {
      checks.cosmosdb = await checkCosmosDb();
    }

    // Check Scrydex API
    const scrydexApiKey = process.env.SCRYDEX_API_KEY;
    if (scrydexApiKey) {
      checks.scrydexApi = await checkScrydexApi();
    }

    // Check Redis
    if (process.env.ENABLE_REDIS_CACHE === 'true') {
      checks.redis = await checkRedis();
    } else {
      checks.redis = {
        status: 'disabled',
        message: 'Redis caching is disabled',
      };
    }

    const overallStatus = determineOverallStatus(checks);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: checks,
    };

    const duration = Date.now() - startTime;

    monitoring.trackMetric('healthcheck.duration', duration, {
      correlationId,
      status: overallStatus,
    });

    monitoring.trackEvent('healthcheck.completed', {
      correlationId,
      status: overallStatus,
      duration,
      checksPerformed: Object.keys(checks).length,
    });

    console.log(`[HealthCheck] Completed in ${duration}ms - Status: ${overallStatus}`);

    const statusCode =
      overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;

    return json(result, { status: statusCode });
  } catch (error) {
    const duration = Date.now() - startTime;

    monitoring.trackException(error as Error, {
      correlationId,
      functionName: 'HealthCheck',
      duration,
    });

    console.error(`[HealthCheck] Error during health check:`, error);

    const result: HealthCheckResult = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      components: {
        error: {
          status: 'unhealthy',
          message: (error as Error).message,
        },
      },
    };

    return json(result, { status: 503 });
  }
};

async function checkRuntime(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      latency: responseTime,
      message: 'Function runtime operational',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Runtime check failed: ${(error as Error).message}`,
    };
  }
}

async function checkCosmosDb(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const cosmosService = getCosmosDbService();
    await cosmosService.getSet('base1');

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      latency: responseTime,
      message: 'Cosmos DB connection successful',
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: 'unhealthy',
      latency: responseTime,
      message: `Cosmos DB check failed: ${(error as Error).message}`,
    };
  }
}

async function checkScrydexApi(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const apiKey = process.env.SCRYDEX_API_KEY;
    const teamId = process.env.SCRYDEX_TEAM_ID;
    const baseUrl =
      process.env.SCRYDEX_API_BASE_URL || 'https://api.scrydex.com/pokemon/v1';

    const response = await fetch(`${baseUrl}/en/expansions?page_size=1&select=id`, {
      headers: {
        'X-Api-Key': apiKey ?? '',
        'X-Team-ID': teamId ?? '',
        'Content-Type': 'application/json',
      },
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: 'healthy',
        latency: responseTime,
        message: 'Scrydex API accessible',
      };
    } else {
      return {
        status: 'unhealthy',
        latency: responseTime,
        message: `Scrydex API returned status ${response.status}`,
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: 'unhealthy',
      latency: responseTime,
      message: `Scrydex API check failed: ${(error as Error).message}`,
    };
  }
}

async function checkRedis(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const redisService = getRedisCacheService();

    if (!redisService.isEnabled()) {
      return {
        status: 'unhealthy',
        message: 'Redis is not connected',
      };
    }

    await redisService.exists('health-check-test');

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      latency: responseTime,
      message: 'Redis cache connection successful',
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      status: 'unhealthy',
      latency: responseTime,
      message: `Redis check failed: ${(error as Error).message}`,
    };
  }
}

function determineOverallStatus(
  checks: Record<string, ComponentHealth>
): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(checks)
    .filter((check) => check.status !== 'disabled')
    .map((check) => check.status);

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  }

  if (statuses.some((s) => s === 'unhealthy')) {
    return 'degraded';
  }

  return 'healthy';
}
