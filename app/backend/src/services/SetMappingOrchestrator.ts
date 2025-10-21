import { PokeDataApiService, PokeDataSet } from "./PokeDataApiService";
import { PokemonTcgApiService } from "./PokemonTcgApiService";
import { SetMatchingEngine } from "./SetMatchingEngine";
import { SetMappingRepository } from "./SetMappingRepository";
import { PokeDataToTcgMappingService } from "./PokeDataToTcgMappingService";
import { ImageUrlUpdateService } from "./ImageUrlUpdateService";
import { MonitoringService } from "./MonitoringService";
import { SetMapping, MappingSyncSummary } from "../models/SetMapping";
import { Set } from "../models/Set";

interface SynchronizeOptions {
  force?: boolean;
  correlationId?: string;
}

export class SetMappingOrchestrator {
  private readonly pokeDataApi: PokeDataApiService;
  private readonly pokemonTcgApi: PokemonTcgApiService;
  private readonly repository: SetMappingRepository;
  private readonly matchingEngine: SetMatchingEngine;
  private readonly mappingService: PokeDataToTcgMappingService;
  private readonly imageUrlUpdateService: ImageUrlUpdateService;
  private readonly monitoringService: MonitoringService;

  constructor(
    pokeDataApi: PokeDataApiService,
    pokemonTcgApi: PokemonTcgApiService,
    repository: SetMappingRepository,
    matchingEngine: SetMatchingEngine,
    mappingService: PokeDataToTcgMappingService,
    mappingServiceForImages: ImageUrlUpdateService,
    monitoringService: MonitoringService
  ) {
    this.pokeDataApi = pokeDataApi;
    this.pokemonTcgApi = pokemonTcgApi;
    this.repository = repository;
    this.matchingEngine = matchingEngine;
    this.mappingService = mappingService;
    this.imageUrlUpdateService = mappingServiceForImages;
    this.monitoringService = monitoringService;
  }

  async synchronize(
    options: SynchronizeOptions = {}
  ): Promise<MappingSyncSummary> {
    const startTime = Date.now();
    const correlationId =
      options.correlationId ||
      this.monitoringService.createCorrelationId?.() ||
      `mapping-${Date.now()}`;

    console.log(
      `[SetMappingOrchestrator] (${correlationId}) Starting synchronization`
    );

    const metadata = await this.repository.getMetadata();
    const pokeDataSets = await this.pokeDataApi.getAllSets();
    const tcgSets = await this.pokemonTcgApi.getAllSets();

    const currentPokeDataCount = pokeDataSets.length;
    const currentTcgCount = tcgSets.length;

    const countsChanged =
      !metadata ||
      metadata.lastPokeDataSetCount !== currentPokeDataCount ||
      metadata.lastTcgSetCount !== currentTcgCount;

    if (!countsChanged && !options.force) {
      console.log(
        `[SetMappingOrchestrator] (${correlationId}) Set counts unchanged (PokeData: ${currentPokeDataCount}, TCG: ${currentTcgCount}) – skipping`
      );
      await this.repository.upsertMetadata({
        lastRunAt: new Date().toISOString(),
        lastPokeDataSetCount: currentPokeDataCount,
        lastTcgSetCount: currentTcgCount,
      });

      const summary: MappingSyncSummary = {
        fetchedPokeDataSets: currentPokeDataCount,
        fetchedTcgSets: currentTcgCount,
        newMappings: 0,
        updatedMappings: 0,
        unchangedMappings: currentPokeDataCount,
        unmatchedPokeDataSets: 0,
        cardsUpdated: 0,
        cardsSkipped: 0,
        cardsErrored: 0,
        durationMs: Date.now() - startTime,
      };

      this.monitoringService.trackEvent?.("mapping.sync.skipped", {
        correlationId,
        pokeDataSetCount: currentPokeDataCount,
        tcgSetCount: currentTcgCount,
      });

      return summary;
    }

    console.log(
      `[SetMappingOrchestrator] (${correlationId}) Set counts changed or force requested. Running full synchronization.`
    );

    const summary: MappingSyncSummary = {
      fetchedPokeDataSets: currentPokeDataCount,
      fetchedTcgSets: currentTcgCount,
      newMappings: 0,
      updatedMappings: 0,
      unchangedMappings: 0,
      unmatchedPokeDataSets: 0,
      cardsUpdated: 0,
      cardsSkipped: 0,
      cardsErrored: 0,
      durationMs: 0,
    };

    const tcgSetByCode = this.indexTcgSets(tcgSets);

    for (const pokeDataSet of pokeDataSets) {
      try {
        const syncResult = await this.processSet(
          pokeDataSet,
          tcgSets,
          tcgSetByCode
        );
        summary.newMappings += syncResult.newMappings;
        summary.updatedMappings += syncResult.updatedMappings;
        summary.unchangedMappings += syncResult.unchangedMappings;
        summary.unmatchedPokeDataSets += syncResult.unmatched ? 1 : 0;
        summary.cardsUpdated += syncResult.cardsUpdated;
        summary.cardsSkipped += syncResult.cardsSkipped;
        summary.cardsErrored += syncResult.cardsErrored;
      } catch (error) {
        console.error(
          `[SetMappingOrchestrator] (${correlationId}) Error processing set ${pokeDataSet.id}:`,
          error
        );
        summary.unmatchedPokeDataSets += 1;
        this.monitoringService.trackException?.(error as Error, {
          correlationId,
          pokeDataSetId: pokeDataSet.id.toString(),
          pokeDataSetName: pokeDataSet.name,
        });
      }
    }

    summary.durationMs = Date.now() - startTime;

    await this.repository.upsertMetadata({
      lastRunAt: new Date().toISOString(),
      lastPokeDataSetCount: currentPokeDataCount,
      lastTcgSetCount: currentTcgCount,
      lastDiffDetectedAt: countsChanged
        ? new Date().toISOString()
        : metadata?.lastDiffDetectedAt || null,
    });

    this.monitoringService.trackEvent?.("mapping.sync.completed", {
      correlationId,
      durationMs: summary.durationMs,
      newMappings: summary.newMappings,
      updatedMappings: summary.updatedMappings,
      unmatched: summary.unmatchedPokeDataSets,
      cardsUpdated: summary.cardsUpdated,
    });

    this.monitoringService.trackMetric?.(
      "mapping.sync.duration",
      summary.durationMs
    );
    this.monitoringService.trackMetric?.(
      "mapping.sync.cardsUpdated",
      summary.cardsUpdated
    );

    console.log(
      `[SetMappingOrchestrator] (${correlationId}) Synchronization complete in ${summary.durationMs}ms`
    );

    return summary;
  }

  private indexTcgSets(tcgSets: Set[]): Map<string, Set> {
    const map = new Map<string, Set>();
    for (const set of tcgSets) {
      if (set.code) {
        map.set(set.code.toUpperCase(), set);
      }
      if (set.id) {
        map.set(set.id.toUpperCase(), set);
      }
    }
    return map;
  }

  private async processSet(
    pokeDataSet: PokeDataSet,
    tcgSets: Set[],
    tcgSetByCode: Map<string, Set>
  ): Promise<{
    newMappings: number;
    updatedMappings: number;
    unchangedMappings: number;
    unmatched: boolean;
    cardsUpdated: number;
    cardsSkipped: number;
    cardsErrored: number;
  }> {
    const existingMapping = await this.repository.getMappingByPokeDataSetId(
      pokeDataSet.id
    );

    if (existingMapping?.matchType === "manual") {
      this.mappingService.updateCacheEntry(
        pokeDataSet.id,
        existingMapping
      );

      let cardsUpdated = 0;
      let cardsSkipped = 0;
      let cardsErrored = 0;

      if (existingMapping.tcgSetId) {
        const updateResult =
          await this.imageUrlUpdateService.updateSetImageUrls(
            pokeDataSet.id
          );
        cardsUpdated = updateResult.updatedCards;
        cardsSkipped = updateResult.skippedCards;
        cardsErrored = updateResult.errors;
      }

      return {
        newMappings: 0,
        updatedMappings: 0,
        unchangedMappings: 1,
        unmatched: false,
        cardsUpdated,
        cardsSkipped,
        cardsErrored,
      };
    }

    const matchResult = this.matchingEngine.match(
      pokeDataSet,
      tcgSets
    );

    let targetMapping: SetMapping;
    let tcgSetId: string | null = null;
    let tcgSetName: string | null = null;
    let isUnmatched = false;

    if (matchResult.tcgSet) {
      tcgSetId = matchResult.tcgSet.code || matchResult.tcgSet.id || null;
      tcgSetName = matchResult.tcgSet.name || null;
    } else if (
      pokeDataSet.code &&
      tcgSetByCode.has(pokeDataSet.code.toUpperCase())
    ) {
      const tcgSet = tcgSetByCode.get(pokeDataSet.code.toUpperCase())!;
      tcgSetId = tcgSet.code || tcgSet.id || null;
      tcgSetName = tcgSet.name || null;
    } else {
      isUnmatched = true;
    }

    targetMapping = {
      id: String(pokeDataSet.id),
      pokeDataSetId: pokeDataSet.id,
      pokeDataSetCode: pokeDataSet.code,
      pokeDataSetName: pokeDataSet.name,
      tcgSetId,
      tcgSetName,
      matchType: matchResult.matchType,
      confidence: matchResult.confidence,
      status: tcgSetId ? "active" : "unmatched",
      createdAt: existingMapping?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: existingMapping?.metadata,
    };

    const mappingChanged =
      !existingMapping ||
      existingMapping.tcgSetId !== targetMapping.tcgSetId ||
      existingMapping.matchType !== targetMapping.matchType;

    if (mappingChanged) {
      await this.repository.upsertMapping(targetMapping);
    }

    this.mappingService.updateCacheEntry(
      pokeDataSet.id,
      targetMapping
    );

    let cardsUpdated = 0;
    let cardsSkipped = 0;
    let cardsErrored = 0;

    if (!isUnmatched && tcgSetId && mappingChanged) {
      const updateResult =
        await this.imageUrlUpdateService.updateSetImageUrls(
          pokeDataSet.id
        );
      cardsUpdated = updateResult.updatedCards;
      cardsSkipped = updateResult.skippedCards;
      cardsErrored = updateResult.errors;
    }

    return {
      newMappings: !existingMapping && !isUnmatched ? 1 : 0,
      updatedMappings: existingMapping && mappingChanged ? 1 : 0,
      unchangedMappings:
        existingMapping && !mappingChanged && !isUnmatched ? 1 : 0,
      unmatched: isUnmatched,
      cardsUpdated,
      cardsSkipped,
      cardsErrored,
    };
  }
}
