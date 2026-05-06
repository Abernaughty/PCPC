import { InvocationContext, Timer } from "@azure/functions";
import {
  cosmosDbService,
  monitoringService,
  pokeDataApiService,
  redisCacheService,
} from "../../index";

/**
 * Smart Incremental RefreshData Function
 *
 * This function implements token-efficient refresh strategy:
 * 1. Gets current set count from PokeData API (5 credits)
 * 2. Compares with database count
 * 3. If counts match, exits immediately (no additional token usage)
 * 4. If counts differ, only refreshes set metadata (no individual card pricing)
 * 5. Card pricing is fetched on-demand when users request specific cards
 *
 * Token usage per run:
 * - Normal case (no changes): 5 credits
 * - New sets available: 5 + minimal set updates
 * - NEVER calls individual card pricing during refresh
 */
export async function refreshData(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const timestamp = new Date().toISOString();
  const correlationId = monitoringService.createCorrelationId();
  const startTime = Date.now();

  context.log(
    `${correlationId} Smart incremental RefreshData function executed at ${timestamp}`
  );

  // Track timer trigger
  monitoringService.trackEvent("timer.triggered", {
    functionName: "RefreshData",
    schedule: "0 0 */12 * * *",
    correlationId,
  });

  try {
    // Step 1: Get current set count from PokeData API (5 credits)
    console.log(
      `${correlationId} Step 1: Checking PokeData API for current set count...`
    );
    const apiStartTime = Date.now();

    const pokeDataSets = await pokeDataApiService.getAllSets();
    const apiSetCount = pokeDataSets.length;
    const apiTime = Date.now() - apiStartTime;

    context.log(
      `${correlationId} PokeData API returned ${apiSetCount} sets (${apiTime}ms, 5 credits used)`
    );

    // Track API call
    monitoringService.trackEvent("api.set_count.checked", {
      setCount: apiSetCount,
      correlationId,
    });
    monitoringService.trackMetric("api.set_count.duration", apiTime);
    monitoringService.trackMetric("api.set_count", apiSetCount);
    monitoringService.trackMetric("api.credits.used", 5);
    monitoringService.trackDependency(
      "PokeData API",
      "HTTP",
      "getAllSets()",
      apiTime,
      true
    );

    // Step 2: Get current database set count
    console.log(
      `${correlationId} Step 2: Checking database for current set count...`
    );
    const dbStartTime = Date.now();

    const dbSets = await cosmosDbService.getAllSets();
    const dbSetCount = dbSets.length;
    const dbTime = Date.now() - dbStartTime;

    context.log(
      `${correlationId} Database contains ${dbSetCount} sets (${dbTime}ms)`
    );

    // Track database query
    monitoringService.trackMetric("db.set_count.duration", dbTime);
    monitoringService.trackMetric("db.set_count", dbSetCount);
    monitoringService.trackDependency(
      "Cosmos DB",
      "Query",
      "getAllSets()",
      dbTime,
      true
    );

    // Step 3: Compare counts for smart refresh decision
    if (apiSetCount === dbSetCount) {
      const totalTime = Date.now() - startTime;
      context.log(
        `${correlationId} ✅ Set counts match (API: ${apiSetCount}, DB: ${dbSetCount})`
      );
      context.log(
        `${correlationId} ✅ No refresh needed - exiting after ${totalTime}ms (5 credits total)`
      );
      context.log(
        `${correlationId} ✅ Smart incremental refresh complete - optimal token usage achieved`
      );

      // Track successful skip
      monitoringService.trackEvent("refresh.skipped", {
        reason: "Set counts match",
        apiCount: apiSetCount,
        dbCount: dbSetCount,
        correlationId,
      });
      monitoringService.trackEvent("function.success", {
        functionName: "RefreshData",
        action: "skipped",
        duration: totalTime,
        creditsUsed: 5,
        correlationId,
      });
      monitoringService.trackMetric("function.duration", totalTime);
      monitoringService.trackMetric("refresh.credits.total", 5);

      return;
    }

    // Step 4: Set counts differ - refresh set metadata only
    context.log(
      `${correlationId} 🔄 Set count mismatch detected (API: ${apiSetCount}, DB: ${dbSetCount})`
    );
    context.log(
      `${correlationId} 🔄 Refreshing set metadata only (no individual card pricing)`
    );

    // Track refresh initiation
    monitoringService.trackEvent("refresh.started", {
      apiCount: apiSetCount,
      dbCount: dbSetCount,
      difference: apiSetCount - dbSetCount,
      correlationId,
    });

    const refreshStartTime = Date.now();

    // Transform PokeData sets to our Set model format
    const transformedSets = pokeDataSets.map((pokeDataSet) => ({
      id: String(pokeDataSet.id), // Convert number to string for Set model
      name: pokeDataSet.name,
      code: pokeDataSet.code || `pokedata-${pokeDataSet.id}`,
      series: "PokeData", // PokeData API doesn't have series field, use default
      cardCount: 0, // Will be populated when users request specific sets
      releaseDate: pokeDataSet.release_date || "",
      isCurrent: isCurrentSet(pokeDataSet),
      lastUpdated: timestamp,
    }));

    // Save sets to database using batch operation
    await cosmosDbService.saveSets(transformedSets);
    const refreshTime = Date.now() - refreshStartTime;

    context.log(
      `${correlationId} ✅ Successfully refreshed ${transformedSets.length} set records in ${refreshTime}ms`
    );

    // Track refresh completion
    monitoringService.trackEvent("sets.refreshed", {
      setsUpdated: transformedSets.length,
      correlationId,
    });
    monitoringService.trackMetric("refresh.duration", refreshTime);
    monitoringService.trackMetric(
      "refresh.sets.updated",
      transformedSets.length
    );
    monitoringService.trackDependency(
      "Cosmos DB",
      "Batch Save",
      `saveSets(${transformedSets.length})`,
      refreshTime,
      true
    );

    // Verify data integrity after save
    const verifyStartTime = Date.now();
    const dbSetsAfter = await cosmosDbService.getAllSets();
    const dbSetCountAfter = dbSetsAfter.length;
    const verifyTime = Date.now() - verifyStartTime;

    monitoringService.trackMetric("db.set_count.after", dbSetCountAfter);

    // Check for data integrity issues
    if (apiSetCount !== dbSetCountAfter) {
      context.log(
        `${correlationId} ⚠️ WARNING: Set count mismatch after refresh (API: ${apiSetCount}, DB: ${dbSetCountAfter})`
      );
      monitoringService.trackEvent("refresh.set_count_mismatch", {
        apiCount: apiSetCount,
        dbCountBefore: dbSetCount,
        dbCountAfter: dbSetCountAfter,
        discrepancy: apiSetCount - dbSetCountAfter,
        correlationId,
      });
    } else {
      context.log(
        `${correlationId} ✅ Data integrity verified - set counts match`
      );
      monitoringService.trackEvent("data.integrity.verified", {
        setCount: dbSetCountAfter,
        correlationId,
      });
    }

    // Check for duplicates
    const uniqueSetIds = new Set(dbSetsAfter.map((s) => s.id));
    if (uniqueSetIds.size !== dbSetsAfter.length) {
      const duplicateCount = dbSetsAfter.length - uniqueSetIds.size;
      context.log(
        `${correlationId} ⚠️ WARNING: ${duplicateCount} duplicate set IDs detected`
      );
      monitoringService.trackEvent("refresh.duplicate_detected", {
        totalSets: dbSetsAfter.length,
        uniqueSets: uniqueSetIds.size,
        duplicates: duplicateCount,
        correlationId,
      });
    }

    // Step 5: Invalidate sets cache to ensure fresh data
    if (process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheStartTime = Date.now();
      await redisCacheService.delete("sets:pokedata:all");
      await redisCacheService.delete("sets:pokedata:current");
      const cacheTime = Date.now() - cacheStartTime;
      context.log(
        `${correlationId} ✅ Invalidated sets cache (${cacheTime}ms)`
      );

      monitoringService.trackEvent("cache.invalidated", {
        keys: ["sets:pokedata:all", "sets:pokedata:current"],
        correlationId,
      });
      monitoringService.trackMetric("cache.invalidation.duration", cacheTime);
    }

    const totalTime = Date.now() - startTime;
    context.log(
      `${correlationId} ✅ Smart incremental refresh completed in ${totalTime}ms`
    );
    context.log(`${correlationId} ✅ Sets updated: ${transformedSets.length}`);
    context.log(
      `${correlationId} ✅ Token usage: 5 credits (optimal efficiency)`
    );
    context.log(
      `${correlationId} ✅ Card pricing will be fetched on-demand when users request specific cards`
    );

    // Track successful completion
    monitoringService.trackEvent("function.success", {
      functionName: "RefreshData",
      action: "refreshed",
      setsUpdated: transformedSets.length,
      duration: totalTime,
      creditsUsed: 5,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);
    monitoringService.trackMetric("refresh.credits.total", 5);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.error(
      `${correlationId} ERROR in smart incremental refresh after ${totalTime}ms: ${errorMessage}`
    );

    // Track error
    monitoringService.trackException(error as Error, {
      functionName: "RefreshData",
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackEvent("function.error", {
      functionName: "RefreshData",
      error: errorMessage,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);

    throw error;
  }
}

/**
 * Determine if a PokeData set should be considered "current"
 */
function isCurrentSet(pokeDataSet: any): boolean {
  if (!pokeDataSet.release_date) return false;

  const releaseDate = new Date(pokeDataSet.release_date);
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);

  return releaseDate >= twoYearsAgo;
}
