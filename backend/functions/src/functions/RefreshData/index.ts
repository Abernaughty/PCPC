import { InvocationContext, Timer } from "@azure/functions";
import {
  cosmosDbService,
  monitoringService,
  redisCacheService,
  scrydexApiService,
} from "../../index";
import { mapScrydexExpansionToSet } from "../../utils/scrydexToCosmos";

/**
 * Smart Incremental RefreshData — Scrydex edition.
 *
 * 1. Fetch all Scrydex expansions (one credit per page)
 * 2. Compare count with Cosmos
 * 3. If counts match, exit without writing
 * 4. If counts differ, batch-upsert canonical PokemonSet docs
 *
 * Card-level pricing is fetched on-demand by GetCardInfo / GetCardsBySet, not here.
 */
export async function refreshData(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const timestamp = new Date().toISOString();
  const correlationId = monitoringService.createCorrelationId();
  const startTime = Date.now();

  context.log(
    `${correlationId} RefreshData function executed at ${timestamp}`
  );

  monitoringService.trackEvent("timer.triggered", {
    functionName: "RefreshData",
    schedule: "0 0 */12 * * *",
    correlationId,
  });

  try {
    context.log(
      `${correlationId} Step 1: Fetching expansions from Scrydex API...`
    );
    const apiStartTime = Date.now();

    const expansions = await scrydexApiService.getAllExpansions("en");
    const apiSetCount = expansions.length;
    const apiTime = Date.now() - apiStartTime;

    context.log(
      `${correlationId} Scrydex returned ${apiSetCount} expansions (${apiTime}ms)`
    );

    monitoringService.trackEvent("api.set_count.checked", {
      setCount: apiSetCount,
      correlationId,
    });
    monitoringService.trackMetric("api.set_count.duration", apiTime);
    monitoringService.trackMetric("api.set_count", apiSetCount);
    monitoringService.trackDependency(
      "Scrydex API",
      "HTTP",
      "getAllExpansions()",
      apiTime,
      true
    );

    context.log(
      `${correlationId} Step 2: Checking Cosmos DB for current set count...`
    );
    const dbStartTime = Date.now();
    const dbSets = await cosmosDbService.getAllSets();
    const dbSetCount = dbSets.length;
    const dbTime = Date.now() - dbStartTime;

    context.log(
      `${correlationId} Cosmos contains ${dbSetCount} sets (${dbTime}ms)`
    );

    monitoringService.trackMetric("db.set_count.duration", dbTime);
    monitoringService.trackMetric("db.set_count", dbSetCount);
    monitoringService.trackDependency(
      "Cosmos DB",
      "Query",
      "getAllSets()",
      dbTime,
      true
    );

    if (apiSetCount === dbSetCount) {
      const totalTime = Date.now() - startTime;
      context.log(
        `${correlationId} ✅ Set counts match (API: ${apiSetCount}, DB: ${dbSetCount}) — no refresh needed (${totalTime}ms)`
      );

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
        correlationId,
      });
      monitoringService.trackMetric("function.duration", totalTime);
      return;
    }

    context.log(
      `${correlationId} 🔄 Set count mismatch (API: ${apiSetCount}, DB: ${dbSetCount}) — refreshing metadata`
    );

    monitoringService.trackEvent("refresh.started", {
      apiCount: apiSetCount,
      dbCount: dbSetCount,
      difference: apiSetCount - dbSetCount,
      correlationId,
    });

    const refreshStartTime = Date.now();
    const transformedSets = expansions.map((expansion) =>
      mapScrydexExpansionToSet(expansion, timestamp)
    );

    await cosmosDbService.saveSets(transformedSets);
    const refreshTime = Date.now() - refreshStartTime;

    context.log(
      `${correlationId} ✅ Refreshed ${transformedSets.length} set records in ${refreshTime}ms`
    );

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

    // Integrity check
    const verifyStartTime = Date.now();
    const dbSetsAfter = await cosmosDbService.getAllSets();
    const dbSetCountAfter = dbSetsAfter.length;
    const verifyTime = Date.now() - verifyStartTime;

    monitoringService.trackMetric("db.set_count.after", dbSetCountAfter);

    if (apiSetCount !== dbSetCountAfter) {
      context.log(
        `${correlationId} ⚠️ Set count mismatch after refresh (API: ${apiSetCount}, DB: ${dbSetCountAfter})`
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
        `${correlationId} ✅ Data integrity verified (${verifyTime}ms) — set counts match`
      );
    }

    const uniqueSetIds = new Set(dbSetsAfter.map((s) => s.id));
    if (uniqueSetIds.size !== dbSetsAfter.length) {
      const duplicateCount = dbSetsAfter.length - uniqueSetIds.size;
      context.log(
        `${correlationId} ⚠️ ${duplicateCount} duplicate set IDs detected`
      );
      monitoringService.trackEvent("refresh.duplicate_detected", {
        totalSets: dbSetsAfter.length,
        uniqueSets: uniqueSetIds.size,
        duplicates: duplicateCount,
        correlationId,
      });
    }

    if (process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheStartTime = Date.now();
      await redisCacheService.delete("sets:list-scrydex-en");
      await redisCacheService.delete("sets:list-scrydex-ja");
      const cacheTime = Date.now() - cacheStartTime;
      context.log(
        `${correlationId} ✅ Invalidated sets cache (${cacheTime}ms)`
      );
      monitoringService.trackEvent("cache.invalidated", {
        correlationId,
      });
    }

    const totalTime = Date.now() - startTime;
    context.log(
      `${correlationId} ✅ RefreshData complete in ${totalTime}ms — sets updated: ${transformedSets.length}`
    );

    monitoringService.trackEvent("function.success", {
      functionName: "RefreshData",
      action: "refreshed",
      setsUpdated: transformedSets.length,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    context.error(
      `${correlationId} ERROR in RefreshData after ${totalTime}ms: ${errorMessage}`
    );

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
