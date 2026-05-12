import { InvocationContext, Timer } from "@azure/functions";
import { monitoringService, scrydexApiService } from "../../index";

/**
 * MonitorScrydexUsage — Periodic Scrydex API usage check.
 *
 * Hits Scrydex /account/v1/usage (a free endpoint) and emits the current
 * usage state to Application Insights so dashboards/alerts can be wired
 * off the resulting metrics. Replaces the PokeData-era CreditMonitoringService
 * which persisted historical data to Cosmos — App Insights retention covers
 * trending for now; persistence can be added back if needed.
 *
 * Scheduled every 6 hours (4 samples/day).
 */
export async function monitorScrydexUsage(
  _myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const timestamp = new Date().toISOString();
  const correlationId = monitoringService.createCorrelationId();
  const startTime = Date.now();

  context.log(
    `${correlationId} MonitorScrydexUsage executed at ${timestamp}`
  );

  monitoringService.trackEvent("timer.triggered", {
    functionName: "MonitorScrydexUsage",
    schedule: "0 0 */6 * * *",
    correlationId,
  });

  try {
    const fetchStartTime = Date.now();
    const usage = await scrydexApiService.getUsage();
    const fetchTime = Date.now() - fetchStartTime;

    monitoringService.trackMetric("scrydex.usage.fetch.duration", fetchTime);
    monitoringService.trackDependency(
      "Scrydex API",
      "HTTP",
      "GET /account/v1/usage",
      fetchTime,
      usage !== null
    );

    if (!usage) {
      context.error(
        `${correlationId} Scrydex usage endpoint returned null (${fetchTime}ms)`
      );
      monitoringService.trackEvent("scrydex.usage.unavailable", {
        correlationId,
      });
      return;
    }

    const usagePercent =
      usage.totalCredits > 0
        ? (usage.usedCredits / usage.totalCredits) * 100
        : 0;

    context.log(
      `${correlationId} Scrydex usage: ${usage.usedCredits}/${usage.totalCredits} credits used (${usagePercent.toFixed(1)}%), ${usage.remainingCredits} remaining, overage rate $${usage.overageCreditRate}`
    );

    monitoringService.trackEvent("scrydex.usage.sampled", {
      totalCredits: usage.totalCredits,
      remainingCredits: usage.remainingCredits,
      usedCredits: usage.usedCredits,
      usagePercent: Number(usagePercent.toFixed(2)),
      overageCreditRate: usage.overageCreditRate,
      correlationId,
    });
    monitoringService.trackMetric("scrydex.credits.total", usage.totalCredits);
    monitoringService.trackMetric(
      "scrydex.credits.remaining",
      usage.remainingCredits
    );
    monitoringService.trackMetric("scrydex.credits.used", usage.usedCredits);
    monitoringService.trackMetric(
      "scrydex.credits.usage_percent",
      Number(usagePercent.toFixed(2))
    );

    let status: "healthy" | "warning" | "critical" | "exhausted";
    if (usage.remainingCredits <= 0) status = "exhausted";
    else if (usagePercent >= 95) status = "critical";
    else if (usagePercent >= 80) status = "warning";
    else status = "healthy";

    monitoringService.trackEvent("scrydex.usage.status", {
      status,
      correlationId,
    });

    if (status === "critical" || status === "exhausted") {
      context.log(
        `${correlationId} 🚨 Scrydex usage ${status.toUpperCase()} — ${usage.remainingCredits} credits remain`
      );
    } else if (status === "warning") {
      context.log(
        `${correlationId} 🟡 Scrydex usage WARNING — ${usagePercent.toFixed(1)}% consumed`
      );
    } else {
      context.log(
        `${correlationId} ✅ Scrydex usage healthy — ${usagePercent.toFixed(1)}% consumed`
      );
    }

    const totalTime = Date.now() - startTime;
    monitoringService.trackEvent("function.success", {
      functionName: "MonitorScrydexUsage",
      duration: totalTime,
      status,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    context.error(
      `${correlationId} ERROR in MonitorScrydexUsage after ${totalTime}ms: ${errorMessage}`
    );
    monitoringService.trackException(error as Error, {
      functionName: "MonitorScrydexUsage",
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackEvent("function.error", {
      functionName: "MonitorScrydexUsage",
      error: errorMessage,
      duration: totalTime,
      correlationId,
    });
    monitoringService.trackMetric("function.duration", totalTime);
    throw error;
  }
}
