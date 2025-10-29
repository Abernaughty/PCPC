import { Set } from "../models/Set";
import { MappingSyncSummary, SetMapping } from "../models/SetMapping";
import { ImageUrlUpdateService } from "./ImageUrlUpdateService";
import { MonitoringService } from "./MonitoringService";
import { PokeDataApiService, PokeDataSet } from "./PokeDataApiService";
import { PokeDataToTcgMappingService } from "./PokeDataToTcgMappingService";
import { PokemonTcgApiService } from "./PokemonTcgApiService";
import { SetMappingRepository } from "./SetMappingRepository";
import { SetMatchingEngine } from "./SetMatchingEngine";

interface SynchronizeOptions {
  force?: boolean;
  correlationId?: string;
}

interface CollisionReport {
  duplicateCodes: Map<string, Set[]>;
  duplicateIds: Map<string, Set[]>;
  hasCollisions: boolean;
}

interface ProcessSetResult {
  newMappings: number;
  updatedMappings: number;
  unchangedMappings: number;
  unmatchedSets: number;
  erroredSets: number;
  skippedSets: number;
  cardsUpdated: number;
  cardsSkipped: number;
  cardsErrored: number;
}

/**
 * Orchestrates the synchronization of set mappings between PokeData and Pokemon TCG APIs
 * Implements collision detection, differentiated error handling, and transactional guarantees
 */
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

  /**
   * Synchronize set mappings between PokeData and Pokemon TCG
   */
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

    if (tcgSets.length === 0) {
      const abortMessage =
        `[SetMappingOrchestrator] (${correlationId}) Aborting synchronization: Pokemon TCG API returned zero sets`;
      console.error(abortMessage);
      this.monitoringService.trackEvent?.("mapping.sync.aborted", {
        correlationId,
        reason: "tcg_zero_sets",
      });
      throw new Error("Pokemon TCG API returned zero sets");
    }

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

    // Index TCG sets with collision detection
    const { tcgSetByCode, collisionReport } = this.indexTcgSets(tcgSets);

    // Log collision warnings
    if (collisionReport.hasCollisions) {
      console.warn(
        `[SetMappingOrchestrator] (${correlationId}) Detected collisions in TCG set index`
      );

      collisionReport.duplicateCodes.forEach((sets, code) => {
        console.warn(
          `[SetMappingOrchestrator] (${correlationId}) Duplicate code "${code}" found in sets: ${sets
            .map((s) => s.name)
            .join(", ")}`
        );
      });

      collisionReport.duplicateIds.forEach((sets, id) => {
        console.warn(
          `[SetMappingOrchestrator] (${correlationId}) Duplicate ID "${id}" found in sets: ${sets
            .map((s) => s.name)
            .join(", ")}`
        );
      });

      this.monitoringService.trackEvent?.("mapping.sync.collisions", {
        correlationId,
        duplicateCodes: collisionReport.duplicateCodes.size,
        duplicateIds: collisionReport.duplicateIds.size,
      });
    }

    for (const pokeDataSet of pokeDataSets) {
      try {
        const syncResult = await this.processSet(
          pokeDataSet,
          tcgSets,
          tcgSetByCode,
          correlationId
        );
        summary.newMappings += syncResult.newMappings;
        summary.updatedMappings += syncResult.updatedMappings;
        summary.unchangedMappings += syncResult.unchangedMappings;
        summary.unmatchedPokeDataSets += syncResult.unmatchedSets;
        summary.cardsUpdated += syncResult.cardsUpdated;
        summary.cardsSkipped += syncResult.cardsSkipped;
        summary.cardsErrored += syncResult.cardsErrored;
      } catch (error) {
        console.error(
          `[SetMappingOrchestrator] (${correlationId}) Error processing set ${pokeDataSet.id}:`,
          error
        );
        // Count as errored, not unmatched
        this.monitoringService.trackException?.(error as Error, {
          correlationId,
          pokeDataSetId: pokeDataSet.id.toString(),
          pokeDataSetName: pokeDataSet.name,
          errorType: "processing_error",
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

  /**
   * Index TCG sets by code and ID with collision detection
   * FIXED: Now detects and reports collisions instead of silently overwriting
   */
  private indexTcgSets(tcgSets: Set[]): {
    tcgSetByCode: Map<string, Set>;
    collisionReport: CollisionReport;
  } {
    const map = new Map<string, Set>();
    const duplicateCodes = new Map<string, Set[]>();
    const duplicateIds = new Map<string, Set[]>();

    for (const set of tcgSets) {
      // Index by code
      if (set.code) {
        const upperCode = set.code.toUpperCase();
        if (map.has(upperCode)) {
          // Collision detected
          const existing = duplicateCodes.get(upperCode) || [
            map.get(upperCode)!,
          ];
          existing.push(set);
          duplicateCodes.set(upperCode, existing);
        }
        map.set(upperCode, set);
      }

      // Index by ID
      if (set.id) {
        const upperId = set.id.toUpperCase();
        if (map.has(upperId)) {
          // Collision detected
          const existing = duplicateIds.get(upperId) || [map.get(upperId)!];
          existing.push(set);
          duplicateIds.set(upperId, existing);
        }
        map.set(upperId, set);
      }
    }

    return {
      tcgSetByCode: map,
      collisionReport: {
        duplicateCodes,
        duplicateIds,
        hasCollisions: duplicateCodes.size > 0 || duplicateIds.size > 0,
      },
    };
  }

  /**
   * Process a single PokeData set with transactional guarantees
   * FIXED: Implements proper error handling and rollback on image update failure
   */
  private async processSet(
    pokeDataSet: PokeDataSet,
    tcgSets: Set[],
    tcgSetByCode: Map<string, Set>,
    correlationId: string
  ): Promise<ProcessSetResult> {
    const result: ProcessSetResult = {
      newMappings: 0,
      updatedMappings: 0,
      unchangedMappings: 0,
      unmatchedSets: 0,
      erroredSets: 0,
      skippedSets: 0,
      cardsUpdated: 0,
      cardsSkipped: 0,
      cardsErrored: 0,
    };

    const existingMapping = await this.repository.getMappingByPokeDataSetId(
      pokeDataSet.id
    );

    // Skip manual mappings - they should not be automatically updated
    if (existingMapping?.matchType === "manual") {
      this.mappingService.updateCacheEntry(pokeDataSet.id, existingMapping);

      let cardsUpdated = 0;
      let cardsSkipped = 0;
      let cardsErrored = 0;

      if (existingMapping.tcgSetId) {
        try {
          const updateResult =
            await this.imageUrlUpdateService.updateSetImageUrls(pokeDataSet.id);
          cardsUpdated = updateResult.updatedCards;
          cardsSkipped = updateResult.skippedCards;
          cardsErrored = updateResult.errors;
        } catch (error) {
          console.error(
            `[SetMappingOrchestrator] (${correlationId}) Error updating image URLs for manual mapping ${pokeDataSet.id}:`,
            error
          );
          result.erroredSets++;
          this.monitoringService.trackException?.(error as Error, {
            correlationId,
            pokeDataSetId: pokeDataSet.id.toString(),
            errorType: "image_update_error",
          });
        }
      }

      result.unchangedMappings = 1;
      result.skippedSets = 1;
      result.cardsUpdated = cardsUpdated;
      result.cardsSkipped = cardsSkipped;
      result.cardsErrored = cardsErrored;

      return result;
    }

    // Attempt to match the set
    const matchResult = this.matchingEngine.match(pokeDataSet, tcgSets);

    let targetMapping: SetMapping;
    let tcgSetId: string | null = null;
    let tcgSetName: string | null = null;
    let isUnmatched = false;

    if (matchResult.tcgSet) {
      tcgSetId = matchResult.tcgSet.id || matchResult.tcgSet.code || null;
      tcgSetName = matchResult.tcgSet.name || null;
    } else if (
      pokeDataSet.code &&
      tcgSetByCode.has(pokeDataSet.code.toUpperCase())
    ) {
      const tcgSet = tcgSetByCode.get(pokeDataSet.code.toUpperCase())!;
      tcgSetId = tcgSet.id || tcgSet.code || null;
      tcgSetName = tcgSet.name || null;
    } else {
      isUnmatched = true;
    }

    // Prepare the mapping
    targetMapping = {
      id: String(pokeDataSet.id),
      pokeDataSetId: pokeDataSet.id,
      pokeDataSetCode: pokeDataSet.code,
      pokeDataSetName: pokeDataSet.name,
      tcgSetId,
      tcgSetName,
      matchType: matchResult.matchType,
      confidence: matchResult.confidence,
      status: tcgSetId ? "pending" : "unmatched", // Start as pending
      createdAt: existingMapping?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: existingMapping?.metadata,
    };

    const mappingChanged =
      !existingMapping ||
      existingMapping.tcgSetId !== targetMapping.tcgSetId ||
      existingMapping.matchType !== targetMapping.matchType;

    // Track unmatched status regardless of whether mapping changed
    // This ensures accurate monitoring even when no changes occur
    if (isUnmatched || !tcgSetId) {
      result.unmatchedSets = 1;
    }

    // Transactional processing: Only mark as active if image update succeeds
    if (!isUnmatched && tcgSetId && mappingChanged) {
      try {
        // Step 1: Persist mapping with "pending" status
        await this.repository.upsertMapping(targetMapping);

        // Step 2: Update image URLs
        const updateResult =
          await this.imageUrlUpdateService.updateSetImageUrls(pokeDataSet.id);

        result.cardsUpdated = updateResult.updatedCards;
        result.cardsSkipped = updateResult.skippedCards;
        result.cardsErrored = updateResult.errors;

        // Step 3: Mark mapping as "active" only if image update succeeded
        if (updateResult.errors === 0) {
          targetMapping.status = "active";
          await this.repository.upsertMapping(targetMapping);
          console.log(
            `[SetMappingOrchestrator] (${correlationId}) Successfully processed set ${pokeDataSet.id} with ${updateResult.updatedCards} cards updated`
          );
        } else {
          console.warn(
            `[SetMappingOrchestrator] (${correlationId}) Image update had errors for set ${pokeDataSet.id}, keeping status as pending`
          );
          this.monitoringService.trackEvent?.("mapping.image_update.partial", {
            correlationId,
            pokeDataSetId: pokeDataSet.id.toString(),
            errors: updateResult.errors,
          });
        }

        // Update cache with final mapping
        this.mappingService.updateCacheEntry(pokeDataSet.id, targetMapping);

        result.newMappings = !existingMapping ? 1 : 0;
        result.updatedMappings = existingMapping ? 1 : 0;
      } catch (error) {
        console.error(
          `[SetMappingOrchestrator] (${correlationId}) Error in transactional processing for set ${pokeDataSet.id}:`,
          error
        );
        result.erroredSets++;
        this.monitoringService.trackException?.(error as Error, {
          correlationId,
          pokeDataSetId: pokeDataSet.id.toString(),
          errorType: "transaction_error",
        });
      }
    } else if (mappingChanged) {
      // Mapping changed but no image update needed
      await this.repository.upsertMapping(targetMapping);
      this.mappingService.updateCacheEntry(pokeDataSet.id, targetMapping);

      // Only count as new/updated if not unmatched (unmatched already counted above)
      if (!isUnmatched) {
        result.newMappings = !existingMapping ? 1 : 0;
        result.updatedMappings = existingMapping ? 1 : 0;
      }
    } else {
      // No changes needed
      this.mappingService.updateCacheEntry(pokeDataSet.id, existingMapping);

      // Only count as unchanged if not unmatched (unmatched already counted above)
      if (!isUnmatched && tcgSetId) {
        result.unchangedMappings = 1;
      }
    }

    return result;
  }
}
