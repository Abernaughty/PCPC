import { Container, CosmosClient, Database } from "@azure/cosmos";
import { Card } from "../models/Card";
import { Set } from "../models/Set";
import { logger } from "../utils/logger";

export interface ICosmosDbService {
  // Card operations
  getCard(cardId: string, setId: number): Promise<Card | null>;
  getCardsBySet(setCode: string): Promise<Card[]>;
  getCardsBySetId(setId: string): Promise<Card[]>;
  saveCard(card: Card): Promise<void>;
  saveCards(cards: Card[]): Promise<void>; // Batch operation for performance
  updateCard(card: Card): Promise<void>;

  // Set operations
  getAllSets(): Promise<Set[]>;
  getSet(setCode: string): Promise<Set | null>;
  saveSets(sets: Set[]): Promise<void>;
  getCurrentSets(): Promise<Set[]>;
}

export class CosmosDbService implements ICosmosDbService {
  private client: CosmosClient;
  private database: Database;
  private cardContainer: Container;
  private setContainer: Container;

  // Constants for database and container names - read from environment variables
  private readonly DATABASE_NAME =
    process.env.COSMOS_DB_DATABASE_NAME || "PokemonCards";
  private readonly CARDS_CONTAINER_NAME =
    process.env.COSMOS_DB_CARDS_CONTAINER_NAME || "Cards";
  private readonly SETS_CONTAINER_NAME =
    process.env.COSMOS_DB_SETS_CONTAINER_NAME || "Sets";

  constructor(connectionString: string) {
    logger.info(
      `CosmosDbService initializing (database: ${this.DATABASE_NAME}, containers: ${this.CARDS_CONTAINER_NAME}/${this.SETS_CONTAINER_NAME})`
    );

    // Add SSL bypass for local development with Cosmos DB emulator
    // Set NODE_TLS_REJECT_UNAUTHORIZED=0 for local development only
    if (process.env.NODE_ENV === "development") {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
      logger.warn(
        "[CosmosDbService] SSL verification disabled for local development"
      );
    }

    this.client = new CosmosClient(connectionString);

    // Get database and containers directly
    this.database = this.client.database(this.DATABASE_NAME);
    this.cardContainer = this.database.container(this.CARDS_CONTAINER_NAME);
    this.setContainer = this.database.container(this.SETS_CONTAINER_NAME);

    logger.info("CosmosDbService initialized");
  }

  async getCard(cardId: string, setId: number): Promise<Card | null> {
    try {
      // Remove any "pokedata-" prefix to get clean numeric ID
      const cleanCardId = cardId.replace(/^pokedata-/, "");

      // Use efficient single-partition query with known setId
      const { resource } = await this.cardContainer
        .item(cleanCardId, setId)
        .read();

      return resource as Card;
    } catch (error: any) {
      if (error.code === 404) {
        logger.debug(
          `[CosmosDbService] Card ${cardId} not found in set ${setId}`
        );
        return null;
      }
      logger.error(
        `[CosmosDbService] Error getting card ${cardId} from set ${setId}:`,
        error
      );
      return null;
    }
  }

  async getCardsBySet(setCode: string): Promise<Card[]> {
    try {
      // Find the setId that corresponds to the setCode
      const setQuerySpec = {
        query: "SELECT * FROM c WHERE c.code = @setCode",
        parameters: [{ name: "@setCode", value: setCode }],
      };

      const { resources: sets } = await this.setContainer.items
        .query(setQuerySpec)
        .fetchAll();

      if (sets.length === 0) {
        logger.debug(`Set with code ${setCode} not found`);
        return [];
      }

      const set = sets[0] as Set;

      // Query cards by setId
      const cardsQuerySpec = {
        query: "SELECT * FROM c WHERE c.setId = @setId",
        parameters: [{ name: "@setId", value: set.id }],
      };

      const { resources } = await this.cardContainer.items
        .query(cardsQuerySpec)
        .fetchAll();
      return resources as Card[];
    } catch (error) {
      logger.error(`Error getting cards for set ${setCode}:`, error);
      return [];
    }
  }

  async getCardsBySetId(setId: string): Promise<Card[]> {
    try {
      const normalizedSetId = (setId || "").trim();
      const setIdNumber = parseInt(normalizedSetId, 10);
      const hasNumericSetId = !isNaN(setIdNumber);
      const queryParts: string[] = [];
      const parameters: { name: string; value: string | number }[] = [];

      if (hasNumericSetId) {
        queryParts.push("c.setId = @setIdNumber");
        parameters.push({ name: "@setIdNumber", value: setIdNumber });
      }

      if (normalizedSetId.length > 0) {
        queryParts.push("c.setId = @setIdString");
        parameters.push({ name: "@setIdString", value: normalizedSetId });

        const prefixedSetId = normalizedSetId.startsWith("pokedata-")
          ? null
          : `pokedata-${normalizedSetId}`;

        if (prefixedSetId) {
          queryParts.push("c.setId = @prefixedSetId");
          parameters.push({ name: "@prefixedSetId", value: prefixedSetId });
        }
      }

      if (queryParts.length === 0) {
        logger.warn(
          `[CosmosDbService] No valid setId filters provided for value "${setId}"`
        );
        return [];
      }

      const queryText = `SELECT * FROM c WHERE ${queryParts.join(" OR ")}`;

      logger.debug(
        `[CosmosDbService] Querying cards for setId variants - raw: "${setId}", numeric: ${
          hasNumericSetId ? setIdNumber : "N/A"
        }, string: "${
          normalizedSetId || "N/A"
        }", prefixed included: ${
          queryParts.some((part) => part.includes("@prefixedSetId")) ? "yes" : "no"
        }`
      );

      const { resources } = await this.cardContainer.items
        .query({
          query: queryText,
          parameters,
        })
        .fetchAll();

      logger.debug(
        `[CosmosDbService] Found ${resources.length} cards for setId "${normalizedSetId ||
          setId}" (numeric match ${hasNumericSetId ? "enabled" : "disabled"})`
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
          `[CosmosDbService] Low card count (${resources.length}) returned for setId "${normalizedSetId ||
            setId}". This may indicate legacy data that needs refresh.`
        );
      }

      return resources as Card[];
    } catch (error) {
      logger.error(`Error getting cards for setId ${setId}:`, error);
      return [];
    }
  }

  async saveCard(card: Card): Promise<void> {
    try {
      const result = await this.cardContainer.items.upsert(card);
      logger.debug(
        `[CosmosDbService] Saved card ${card.id} - Status: ${result.statusCode}, RU: ${result.requestCharge}`
      );
    } catch (error) {
      logger.error(`[CosmosDbService] Error saving card ${card.id}:`, error);
      throw error;
    }
  }

  async saveCards(cards: Card[]): Promise<void> {
    try {
      logger.info(
        `[CosmosDbService] Starting batch save of ${cards.length} cards`
      );
      const startTime = Date.now();

      if (cards.length === 0) {
        logger.debug(`[CosmosDbService] No cards to save`);
        return;
      }

      // Process cards in batches to avoid overwhelming Cosmos DB
      const BATCH_SIZE = 100; // Cosmos DB recommended batch size
      const batches = [];

      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        batches.push(cards.slice(i, i + BATCH_SIZE));
      }


      let totalSaved = 0;
      let totalRU = 0;

      // Process batches in parallel with controlled concurrency
      const CONCURRENT_BATCHES = 3; // Limit concurrent batches to avoid rate limiting

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

        const batchPromises = concurrentBatches.map(
          async (batch, batchIndex) => {
            const actualBatchIndex = i + batchIndex;

            const batchStartTime = Date.now();
            let batchRU = 0;
            let batchSaved = 0;

            // Process each card in the batch
            const cardPromises = batch.map(async (card) => {
              try {
                const result = await this.cardContainer.items.upsert(card);
                batchRU += result.requestCharge || 0;
                batchSaved++;
                return {
                  success: true,
                  cardId: card.id,
                  ru: result.requestCharge || 0,
                };
              } catch (error) {
                logger.error(
                  `[CosmosDbService] Failed to save card ${card.id}:`,
                  error
                );
                return { success: false, cardId: card.id, error: error };
              }
            });

            const results = await Promise.all(cardPromises);
            const batchTime = Date.now() - batchStartTime;

            const failures = results.filter((r) => !r.success);
            if (failures.length > 0) {
              logger.warn(
                `[CosmosDbService] Batch ${actualBatchIndex + 1} had ${
                  failures.length
                } failures out of ${batch.length} cards`
              );
              failures.forEach((failure) => {
                logger.warn(
                  `[CosmosDbService] Failed card: ${failure.cardId}`
                );
              });
            }

            logger.debug(
              `[CosmosDbService] Batch ${
                actualBatchIndex + 1
              } completed: ${batchSaved}/${
                batch.length
              } cards saved in ${batchTime}ms, RU: ${batchRU.toFixed(2)}`
            );

            return {
              saved: batchSaved,
              ru: batchRU,
              failures: failures.length,
            };
          }
        );

        // Wait for all concurrent batches to complete
        const batchResults = await Promise.all(batchPromises);

        // Aggregate results
        batchResults.forEach((result) => {
          totalSaved += result.saved;
          totalRU += result.ru;
        });

        // Add small delay between concurrent batch groups to be gentle on Cosmos DB
        if (i + CONCURRENT_BATCHES < batches.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerCard = totalTime / cards.length;
      const avgRUPerCard = totalRU / cards.length;

      logger.info(
        `[CosmosDbService] Batch save completed: ${totalSaved}/${cards.length} cards saved in ${totalTime}ms (${avgTimePerCard.toFixed(
          1
        )}ms/card, ${avgRUPerCard.toFixed(2)} RU/card)`
      );

      if (totalSaved < cards.length) {
        const failedCount = cards.length - totalSaved;
        logger.warn(
          `[CosmosDbService] ${failedCount} cards failed to save`
        );
        // Don't throw error for partial failures - log and continue
      }
    } catch (error) {
      logger.error(`[CosmosDbService] Error in batch save operation:`, error);
      throw error;
    }
  }

  async updateCard(card: Card): Promise<void> {
    try {
      await this.cardContainer.item(card.id, card.setId).replace(card);
    } catch (error) {
      logger.error(`Error updating card ${card.id}:`, error);
      throw error;
    }
  }

  async getAllSets(): Promise<Set[]> {
    try {
      // Use readAll to get all sets
      const { resources } = await this.setContainer.items.readAll().fetchAll();
      logger.debug(
        `[CosmosDbService] Found ${resources.length} sets in Cosmos DB`
      );

      return resources as Set[];
    } catch (error) {
      logger.error(`Error getting all sets:`, error);

      // Try using a query as a fallback
      try {
        logger.debug("[CosmosDbService] Falling back to query approach...");
        const querySpec = {
          query: "SELECT * FROM c",
        };

        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        logger.debug(
          `[CosmosDbService] Found ${resources.length} sets using query()`
        );

        return resources as Set[];
      } catch (queryError) {
        logger.error(`[CosmosDbService] Error querying sets:`, queryError);
        return [];
      }
    }
  }

  async getSet(setCode: string): Promise<Set | null> {
    try {
      const querySpec = {
        query: "SELECT * FROM c WHERE c.code = @setCode",
        parameters: [{ name: "@setCode", value: setCode }],
      };

      const { resources } = await this.setContainer.items
        .query(querySpec)
        .fetchAll();
      return resources.length > 0 ? (resources[0] as Set) : null;
    } catch (error) {
      logger.error(`Error getting set ${setCode}:`, error);
      return null;
    }
  }

  async saveSets(sets: Set[]): Promise<void> {
    try {
      logger.info(`[CosmosDbService] Saving ${sets.length} sets`);

      // Add lastUpdated timestamp to each set
      const setsWithTimestamp = sets.map((set) => ({
        ...set,
        lastUpdated: new Date().toISOString(),
      }));

      // Use individual upsert operations instead of bulk
      for (const set of setsWithTimestamp) {
        await this.setContainer.items.upsert(set);
      }

      logger.info(`[CosmosDbService] Saved ${sets.length} sets`);
    } catch (error) {
      logger.error(`Error saving sets:`, error);
      throw error;
    }
  }

  async getCurrentSets(): Promise<Set[]> {
    try {
      // Get all sets first
      const allSets = await this.getAllSets();

      // Filter for current sets
      const currentSets = allSets.filter((set) => set.isCurrent === true);
      logger.debug(
        `[CosmosDbService] Found ${currentSets.length} current sets out of ${allSets.length} total sets`
      );

      return currentSets;
    } catch (error) {
      logger.error(`Error getting current sets:`, error);

      // Try using a query as a fallback
      try {
        logger.debug("[CosmosDbService] Falling back to query approach for current sets...");
        const querySpec = {
          query: "SELECT * FROM c WHERE c.isCurrent = true",
        };

        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        logger.debug(
          `[CosmosDbService] Found ${resources.length} current sets using query()`
        );

        return resources as Set[];
      } catch (queryError) {
        logger.error(`Error querying current sets:`, queryError);
        return [];
      }
    }
  }
}
