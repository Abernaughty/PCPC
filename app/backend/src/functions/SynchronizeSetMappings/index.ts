import { InvocationContext, Timer } from "@azure/functions";
import {
  monitoringService,
  setMappingOrchestrator,
} from "../../index";

export async function synchronizeSetMappings(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  const correlationId =
    monitoringService.createCorrelationId?.() ||
    `sync-${Date.now()}`;

  context.log(
    `${correlationId} Set mapping synchronization triggered. Past due: ${myTimer.isPastDue}`
  );

  monitoringService.trackEvent?.("mapping.sync.triggered", {
    correlationId,
    pastDue: myTimer.isPastDue ? "true" : "false",
  });

  try {
    const summary = await setMappingOrchestrator.synchronize({
      correlationId,
      force: false,
    });

    context.log(
      `${correlationId} Synchronization summary: ${JSON.stringify(summary)}`
    );
  } catch (error: any) {
    context.error(
      `${correlationId} Error during set mapping synchronization: ${error.message}`
    );
    monitoringService.trackException?.(error as Error, {
      correlationId,
    });
    monitoringService.trackEvent?.("mapping.sync.failed", {
      correlationId,
      message: error.message,
    });
    throw error;
  }
}
