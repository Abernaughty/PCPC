import { Container, CosmosClient, Database } from "@azure/cosmos";
import type { Card, PokemonSet } from "@pcpc/shared";
import { logger } from "../utils/logger";

export interface ICosmosDbService {
  // Card operations
  getCard(cardId: string, setId: string): Promise<Card | null>;
  getCardsBySetId(setId: string): Promise<Card[]>;
  saveCard(card: Card): Promise<void>;
  saveCards(cards: Card[]): Promise<void>;
  updateCard(card: Card): Promise<void>;

  // Set operations
  getAllSets(): Promise<PokemonSet[]>;
  getSet(setCode: string): Promise<PokemonSet | null>;
  saveSets(sets: PokemonSet[]): Promise<void>;
  getCurrentSets(): Promise<PokemonSet[]>;
}

export class CosmosDbService implements ICosmosDbService {
  private client: CosmosClient;
  private database: Database;
  private cardContainer: Container;
  private setContainer: Container;

  private readonly DATABASE_NAME =
    process.env.COSMOS_DB_DATABASE_NAME || "PokemonCards";
  private readonly CARDS_CONTAINER_NAME =
    process.env.COSMOS_DB_CARDS_CONTAINER_NAME || "Cards";
  private readonly SETS_CONTAINER_NAME =
    process.env.COSMOS_DB_SETS_CONTAINER_NAME || "Sets";

  constructor(connectionString: string) {
    logger.info(
      `[CosmosDbService] Initializing (database: ${this.DATABASE_NAME}, cards: ${this.CARDS_CONTAINER_NAME}, sets: ${this.SETS_CONTAINER_NAME})`
    );

    // SSL bypass for Cosmos emulator in local development only.
    if (process.env.NODE_ENV === "development") {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
      logger.warn(
        "[CosmosDbService] SSL verification disabled for local development"
      );
    }

    this.client = new CosmosClient(connectionString);
    this.database = this.client.database(this.DATABASE_NAME);
    this.cardContainer = this.database.container(this.CARDS_CONTAINER_NAME);
    this.setContainer = this.database.container(this.SETS_CONTAINER_NAME);
  }

  async getCard(cardId: string, setId: string): Promise<Card | null> {
    try {
      const { resource } = await this.cardContainer.item(cardId, setId).read();
      if (!resource) return null;
      return resource as Card;
    } catch (error: any) {
      if (error.code === 404) {
        logger.debug(`[CosmosDbService] Card ${cardId} not found in set ${setId}`);
        return null;
      }
      logger.error(
        `[CosmosDbService] Error getting card ${cardId} from set ${setId}:`,
        error
      );
      return null;
    }
  }

  async getCardsBySetId(setId: string): Promise<Card[]> {
    try {
      const normalizedSetId = (setId || "").trim();
      if (normalizedSetId.length === 0) {
        logger.warn(`[CosmosDbService] Empty setId provided`);
        return [];
      }

      const querySpec = {
        query: "SELECT * FROM c WHERE c.setId = @setId",
        parameters: [{ name: "@setId", value: normalizedSetId }],
      };

      const { resources } = await this.cardContainer.items
        .query(querySpec)
        .fetchAll();

      logger.debug(
        `[CosmosDbService] Found ${resources.length} cards for setId "${normalizedSetId}"`
      );

      const warningThreshold = parseInt(
        process.env.CARD_COUNT_WARNING_THRESHOLD || "10",
        10
      );

      if (
        warningThreshold > 0 &&
        resources.length > 0 &&
        resources.length < warningThreshold
      ) {
        logger.warn(
          `[CosmosDbService] Low card count (${resources.length}) for setId "${normalizedSetId}". May indicate stale data — consider refresh.`
        );
      }

      return resources as Card[];
    } catch (error) {
      logger.error(`[CosmosDbService] Error getting cards for setId ${setId}:`, error);
      return [];
    }
  }

  async saveCard(card: Card): Promise<void> {
    try {
      const result = await this.cardContainer.items.upsert(card);
      logger.debug(
        `[CosmosDbService] Saved card ${card.id} — status ${result.statusCode}, RU ${result.requestCharge}`
      );
    } catch (error) {
      logger.error(`[CosmosDbService] Error saving card ${card.id}:`, error);
      throw error;
    }
  }

  async saveCards(cards: Card[]): Promise<void> {
    try {
      const startTime = Date.now();

      if (cards.length === 0) {
        logger.debug(`[CosmosDbService] No cards to save`);
        return;
      }

      const BATCH_SIZE = 100;
      const batches: Card[][] = [];
      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        batches.push(cards.slice(i, i + BATCH_SIZE));
      }

      logger.debug(
        `[CosmosDbService] Processing ${cards.length} cards in ${batches.length} batches of ${BATCH_SIZE}`
      );

      let totalSaved = 0;
      let totalRU = 0;
      const CONCURRENT_BATCHES = 3;

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

        const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
          const actualBatchIndex = i + batchIndex;
          const batchStartTime = Date.now();
          let batchRU = 0;
          let batchSaved = 0;

          const cardPromises = batch.map(async (card) => {
            try {
              const result = await this.cardContainer.items.upsert(card);
              batchRU += result.requestCharge || 0;
              batchSaved++;
              return { success: true, cardId: card.id };
            } catch (error) {
              logger.error(
                `[CosmosDbService] Failed to save card ${card.id}:`,
                error
              );
              return { success: false, cardId: card.id, error };
            }
          });

          const results = await Promise.all(cardPromises);
          const batchTime = Date.now() - batchStartTime;

          const failures = results.filter((r) => !r.success);
          if (failures.length > 0) {
            logger.warn(
              `[CosmosDbService] Batch ${actualBatchIndex + 1} had ${failures.length} failures out of ${batch.length}`
            );
          }

          logger.debug(
            `[CosmosDbService] Batch ${actualBatchIndex + 1}: ${batchSaved}/${batch.length} cards saved in ${batchTime}ms, RU ${batchRU.toFixed(2)}`
          );

          return { saved: batchSaved, ru: batchRU, failures: failures.length };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((result) => {
          totalSaved += result.saved;
          totalRU += result.ru;
        });

        if (i + CONCURRENT_BATCHES < batches.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const totalTime = Date.now() - startTime;
      logger.info(
        `[CosmosDbService] Batch save complete: ${totalSaved}/${cards.length} cards in ${totalTime}ms, ${totalRU.toFixed(2)} RU total`
      );

      if (totalSaved < cards.length) {
        logger.warn(
          `[CosmosDbService] ${cards.length - totalSaved} cards failed to save`
        );
      }
    } catch (error) {
      logger.error(`[CosmosDbService] Error in batch save:`, error);
      throw error;
    }
  }

  async updateCard(card: Card): Promise<void> {
    try {
      await this.cardContainer.item(card.id, card.setId).replace(card);
    } catch (error) {
      logger.error(`[CosmosDbService] Error updating card ${card.id}:`, error);
      throw error;
    }
  }

  async getAllSets(): Promise<PokemonSet[]> {
    try {
      const { resources } = await this.setContainer.items.readAll().fetchAll();
      logger.debug(`[CosmosDbService] Found ${resources.length} sets`);
      return resources as PokemonSet[];
    } catch (error) {
      logger.error(`[CosmosDbService] Error getting all sets:`, error);
      try {
        const querySpec = { query: "SELECT * FROM c" };
        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        return resources as PokemonSet[];
      } catch (queryError) {
        logger.error(`[CosmosDbService] Error querying sets:`, queryError);
        return [];
      }
    }
  }

  async getSet(setCode: string): Promise<PokemonSet | null> {
    try {
      const querySpec = {
        query: "SELECT * FROM c WHERE c.code = @setCode",
        parameters: [{ name: "@setCode", value: setCode }],
      };
      const { resources } = await this.setContainer.items
        .query(querySpec)
        .fetchAll();
      return resources.length > 0 ? (resources[0] as PokemonSet) : null;
    } catch (error) {
      logger.error(`[CosmosDbService] Error getting set ${setCode}:`, error);
      return null;
    }
  }

  async saveSets(sets: PokemonSet[]): Promise<void> {
    try {
      const now = new Date().toISOString();
      const setsWithTimestamp = sets.map((set) => ({
        ...set,
        lastUpdated: set.lastUpdated ?? now,
      }));

      for (const set of setsWithTimestamp) {
        await this.setContainer.items.upsert(set);
      }

      logger.info(`[CosmosDbService] Saved ${sets.length} sets`);
    } catch (error) {
      logger.error(`[CosmosDbService] Error saving sets:`, error);
      throw error;
    }
  }

  async getCurrentSets(): Promise<PokemonSet[]> {
    try {
      const allSets = await this.getAllSets();
      const currentSets = allSets.filter((set) => set.isCurrent === true);
      logger.debug(
        `[CosmosDbService] Found ${currentSets.length} current sets out of ${allSets.length} total`
      );
      return currentSets;
    } catch (error) {
      logger.error(`[CosmosDbService] Error getting current sets:`, error);
      try {
        const querySpec = { query: "SELECT * FROM c WHERE c.isCurrent = true" };
        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        return resources as PokemonSet[];
      } catch (queryError) {
        logger.error(`[CosmosDbService] Error querying current sets:`, queryError);
        return [];
      }
    }
  }
}
