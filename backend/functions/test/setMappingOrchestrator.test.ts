import { test } from "node:test";
import assert from "node:assert/strict";
import { SetMappingOrchestrator } from "../src/services/SetMappingOrchestrator";

test("synchronize aborts when Pokemon TCG API returns zero sets", async () => {
  const events: Array<{ name: string; props?: Record<string, unknown> }> = [];

  const pokeDataApi = {
    getAllSets: async () => [
      {
        id: 1,
        code: "SET1",
        language: "ENGLISH" as const,
        name: "Sample Set",
        release_date: "2024-01-01",
      },
    ],
  };

  const pokemonTcgApi = {
    getAllSets: async () => [],
  };

  const repository = {
    getMetadata: async () => null,
    upsertMetadata: async () => {
      throw new Error("upsertMetadata should not be invoked when sync aborts");
    },
    getMappingByPokeDataSetId: async () => null,
    upsertMapping: async () => {
      throw new Error("upsertMapping should not be invoked when sync aborts");
    },
  };

  const matchingEngine = {
    match: () => ({
      tcgSet: null,
      matchType: "automatic",
      confidence: 0,
    }),
  };

  const mappingService = {
    updateCacheEntry: () => undefined,
  };

  const imageUrlUpdateService = {
    updateSetImageUrls: async () => ({
      updatedCards: 0,
      skippedCards: 0,
      errors: 0,
    }),
  };

  const monitoringService = {
    createCorrelationId: () => "test-correlation",
    trackEvent: (name: string, props?: Record<string, unknown>) => {
      events.push({ name, props });
    },
    trackException: () => undefined,
    trackMetric: () => undefined,
  };

  const orchestrator = new SetMappingOrchestrator(
    pokeDataApi as any,
    pokemonTcgApi as any,
    repository as any,
    matchingEngine as any,
    mappingService as any,
    imageUrlUpdateService as any,
    monitoringService as any
  );

  await assert.rejects(
    orchestrator.synchronize.bind(orchestrator),
    /Pokemon TCG API returned zero sets/
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].name, "mapping.sync.aborted");
  assert.deepEqual(events[0].props, {
    correlationId: "test-correlation",
    reason: "tcg_zero_sets",
  });
});
