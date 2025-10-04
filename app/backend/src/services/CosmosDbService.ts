import { Container, CosmosClient, Database } from "@azure/cosmos";
import { Card } from "../models/Card";
import { Set } from "../models/Set";

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
    console.log("Initializing CosmosDbService...");
    console.log(`[CosmosDbService] Database: ${this.DATABASE_NAME}`);
    console.log(
      `[CosmosDbService] Cards Container: ${this.CARDS_CONTAINER_NAME}`
    );
    console.log(
      `[CosmosDbService] Sets Container: ${this.SETS_CONTAINER_NAME}`
    );

    // Add SSL bypass for local development with Cosmos DB emulator
    // Set NODE_TLS_REJECT_UNAUTHORIZED=0 for local development only
    if (process.env.NODE_ENV === "development") {
      process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";
      console.log(
        "[CosmosDbService] SSL verification disabled for local development"
      );
    }

    this.client = new CosmosClient(connectionString);

    // Get database and containers directly
    this.database = this.client.database(this.DATABASE_NAME);
    this.cardContainer = this.database.container(this.CARDS_CONTAINER_NAME);
    this.setContainer = this.database.container(this.SETS_CONTAINER_NAME);

    console.log("CosmosDbService initialized");
  }

  async getCard(cardId: string, setId: number): Promise<Card | null> {
    try {
      // Remove any "pokedata-" prefix to get clean numeric ID
      const cleanCardId = cardId.replace(/^pokedata-/, "");

      console.log(
        `[CosmosDbService] Querying card ${cleanCardId} in set ${setId}`
      );

      // Use efficient single-partition query with known setId
      const { resource } = await this.cardContainer
        .item(cleanCardId, setId)
        .read();

      console.log(
        `[CosmosDbService] Successfully retrieved card ${cleanCardId}`
      );
      return resource as Card;
    } catch (error: any) {
      if (error.code === 404) {
        console.log(
          `[CosmosDbService] Card ${cardId} not found in set ${setId}`
        );
        return null;
      }
      console.error(
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
        console.log(`Set with code ${setCode} not found`);
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
      console.error(`Error getting cards for set ${setCode}:`, error);
      return [];
    }
  }

  async getCardsBySetId(setId: string): Promise<Card[]> {
    try {
      // Convert string to number for database query (database stores setId as number)
      const setIdNumber = parseInt(setId);
      console.log(
        `[CosmosDbService] Querying cards for setId: ${setIdNumber} (converted from "${setId}")`
      );

      // Query cards directly by setId (for PokeData-first approach)
      const cardsQuerySpec = {
        query: "SELECT * FROM c WHERE c.setId = @setId",
        parameters: [{ name: "@setId", value: setIdNumber }],
      };

      const { resources } = await this.cardContainer.items
        .query(cardsQuerySpec)
        .fetchAll();
      console.log(
        `[CosmosDbService] Found ${resources.length} cards for setId: ${setIdNumber}`
      );

      return resources as Card[];
    } catch (error) {
      console.error(`Error getting cards for setId ${setId}:`, error);
      return [];
    }
  }

  async saveCard(card: Card): Promise<void> {
    try {
      console.log(
        `[CosmosDbService] Attempting to save card: ${card.id} for setId: ${card.setId}`
      );
      console.log(
        `[CosmosDbService] Card data preview: ${JSON.stringify({
          id: card.id,
          setId: card.setId,
          cardName: card.cardName,
          cardNumber: card.cardNumber,
          source: (card as any).source,
        })}`
      );

      const result = await this.cardContainer.items.upsert(card);
      console.log(
        `[CosmosDbService] Successfully saved card ${card.id} - Status: ${result.statusCode}, RU: ${result.requestCharge}`
      );
    } catch (error) {
      console.error(`[CosmosDbService] ERROR saving card ${card.id}:`, error);
      console.error(
        `[CosmosDbService] Card data that failed:`,
        JSON.stringify(card, null, 2)
      );
      throw error;
    }
  }

  async saveCards(cards: Card[]): Promise<void> {
    try {
      console.log(
        `[CosmosDbService] Starting batch save of ${cards.length} cards`
      );
      const startTime = Date.now();

      if (cards.length === 0) {
        console.log(`[CosmosDbService] No cards to save`);
        return;
      }

      // Process cards in batches to avoid overwhelming Cosmos DB
      const BATCH_SIZE = 100; // Cosmos DB recommended batch size
      const batches = [];

      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        batches.push(cards.slice(i, i + BATCH_SIZE));
      }

      console.log(
        `[CosmosDbService] Processing ${cards.length} cards in ${batches.length} batches of ${BATCH_SIZE}`
      );

      let totalSaved = 0;
      let totalRU = 0;

      // Process batches in parallel with controlled concurrency
      const CONCURRENT_BATCHES = 3; // Limit concurrent batches to avoid rate limiting

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

        const batchPromises = concurrentBatches.map(
          async (batch, batchIndex) => {
            const actualBatchIndex = i + batchIndex;
            console.log(
              `[CosmosDbService] Processing batch ${actualBatchIndex + 1}/${
                batches.length
              } with ${batch.length} cards`
            );

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
                console.error(
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
              console.warn(
                `[CosmosDbService] Batch ${actualBatchIndex + 1} had ${
                  failures.length
                } failures out of ${batch.length} cards`
              );
              failures.forEach((failure) => {
                console.warn(
                  `[CosmosDbService] Failed card: ${failure.cardId}`
                );
              });
            }

            console.log(
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

      console.log(
        `[CosmosDbService] Batch save completed: ${totalSaved}/${cards.length} cards saved`
      );
      console.log(
        `[CosmosDbService] Performance: ${totalTime}ms total (${avgTimePerCard.toFixed(
          1
        )}ms/card), ${totalRU.toFixed(2)} RU total (${avgRUPerCard.toFixed(
          2
        )} RU/card)`
      );

      if (totalSaved < cards.length) {
        const failedCount = cards.length - totalSaved;
        console.warn(
          `[CosmosDbService] WARNING: ${failedCount} cards failed to save`
        );
        // Don't throw error for partial failures - log and continue
      }
    } catch (error) {
      console.error(`[CosmosDbService] ERROR in batch save operation:`, error);
      throw error;
    }
  }

  async updateCard(card: Card): Promise<void> {
    try {
      await this.cardContainer.item(card.id, card.setId).replace(card);
    } catch (error) {
      console.error(`Error updating card ${card.id}:`, error);
      throw error;
    }
  }

  async getAllSets(): Promise<Set[]> {
    try {
      console.log("[CosmosDbService] Getting all sets from Cosmos DB");

      // Use readAll to get all sets
      const { resources } = await this.setContainer.items.readAll().fetchAll();
      console.log(
        `[CosmosDbService] Found ${resources.length} sets in Cosmos DB`
      );

      // Log the first few sets for debugging
      if (resources.length > 0) {
        console.log("Sample sets from Cosmos DB:");
        resources
          .slice(0, Math.min(3, resources.length))
          .forEach((set: any) => {
            console.log(
              `- ${set.name} (${set.code}): ${set.cardCount} cards, Series: ${set.series}, isCurrent: ${set.isCurrent}`
            );
          });
      }

      return resources as Set[];
    } catch (error) {
      console.error(`Error getting all sets:`, error);

      // Try using a query as a fallback
      try {
        console.log("Falling back to query approach...");
        const querySpec = {
          query: "SELECT * FROM c",
        };

        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        console.log(
          `[CosmosDbService] Found ${resources.length} sets using query()`
        );

        return resources as Set[];
      } catch (queryError) {
        console.error(`Error querying sets:`, queryError);
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
      console.error(`Error getting set ${setCode}:`, error);
      return null;
    }
  }

  async saveSets(sets: Set[]): Promise<void> {
    try {
      console.log(`[CosmosDbService] Saving ${sets.length} sets`);

      // Add lastUpdated timestamp to each set
      const setsWithTimestamp = sets.map((set) => ({
        ...set,
        lastUpdated: new Date().toISOString(),
      }));

      // Log the first few sets for debugging
      if (setsWithTimestamp.length > 0) {
        console.log("Sample sets being saved:");
        setsWithTimestamp
          .slice(0, Math.min(3, setsWithTimestamp.length))
          .forEach((set) => {
            console.log(
              `- ${set.name} (${set.code}): ${set.cardCount} cards, Series: ${set.series}, isCurrent: ${set.isCurrent}`
            );
          });
      }

      // Use individual upsert operations instead of bulk
      for (const set of setsWithTimestamp) {
        await this.setContainer.items.upsert(set);
      }

      console.log(`[CosmosDbService] Successfully saved ${sets.length} sets`);
    } catch (error) {
      console.error(`Error saving sets:`, error);
      throw error;
    }
  }

  async getCurrentSets(): Promise<Set[]> {
    try {
      console.log("[CosmosDbService] Getting current sets from Cosmos DB");

      // Get all sets first
      const allSets = await this.getAllSets();

      // Filter for current sets
      const currentSets = allSets.filter((set) => set.isCurrent === true);
      console.log(
        `[CosmosDbService] Found ${currentSets.length} current sets out of ${allSets.length} total sets`
      );

      // Log the current sets for debugging
      if (currentSets.length > 0) {
        console.log("Current sets:");
        currentSets.forEach((set) => {
          console.log(
            `- ${set.name} (${set.code}): isCurrent=${set.isCurrent}, Series: ${set.series}`
          );
        });
      }

      return currentSets;
    } catch (error) {
      console.error(`Error getting current sets:`, error);

      // Try using a query as a fallback
      try {
        console.log("Falling back to query approach for current sets...");
        const querySpec = {
          query: "SELECT * FROM c WHERE c.isCurrent = true",
        };

        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        console.log(
          `[CosmosDbService] Found ${resources.length} current sets using query()`
        );

        return resources as Set[];
      } catch (queryError) {
        console.error(`Error querying current sets:`, queryError);
        return [];
      }
    }
  }
}
