import { Container, CosmosClient, Database } from '@azure/cosmos';
import type { Card, PokemonSet } from '../models/types';
import { getConfig } from '../config';

export interface ICosmosDbService {
  // Card operations
  getCard(cardId: string, setId: number): Promise<Card | null>;
  getCardsBySet(setCode: string): Promise<Card[]>;
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

  private readonly DATABASE_NAME: string;
  private readonly CARDS_CONTAINER_NAME: string;
  private readonly SETS_CONTAINER_NAME: string;

  constructor(connectionString: string) {
    const config = getConfig();
    this.DATABASE_NAME = config.cosmosDbDatabaseName;
    this.CARDS_CONTAINER_NAME = config.cosmosDbCardsContainerName;
    this.SETS_CONTAINER_NAME = config.cosmosDbSetsContainerName;

    console.log('[CosmosDbService] Initializing...');
    console.log(`[CosmosDbService] Database: ${this.DATABASE_NAME}`);
    console.log(`[CosmosDbService] Cards Container: ${this.CARDS_CONTAINER_NAME}`);
    console.log(`[CosmosDbService] Sets Container: ${this.SETS_CONTAINER_NAME}`);

    this.client = new CosmosClient(connectionString);

    this.database = this.client.database(this.DATABASE_NAME);
    this.cardContainer = this.database.container(this.CARDS_CONTAINER_NAME);
    this.setContainer = this.database.container(this.SETS_CONTAINER_NAME);

    console.log('[CosmosDbService] Initialized');
  }

  async getCard(cardId: string, setId: number): Promise<Card | null> {
    try {
      const cleanCardId = cardId.replace(/^pokedata-/, '');

      console.log(`[CosmosDbService] Querying card ${cleanCardId} in set ${setId}`);

      const { resource } = await this.cardContainer.item(cleanCardId, setId).read();

      console.log(`[CosmosDbService] Successfully retrieved card ${cleanCardId}`);
      return resource as Card;
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`[CosmosDbService] Card ${cardId} not found in set ${setId}`);
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
      const setQuerySpec = {
        query: 'SELECT * FROM c WHERE c.code = @setCode',
        parameters: [{ name: '@setCode', value: setCode }],
      };

      const { resources: sets } = await this.setContainer.items
        .query(setQuerySpec)
        .fetchAll();

      if (sets.length === 0) {
        console.log(`Set with code ${setCode} not found`);
        return [];
      }

      const set = sets[0] as PokemonSet;

      const cardsQuerySpec = {
        query: 'SELECT * FROM c WHERE c.setId = @setId',
        parameters: [{ name: '@setId', value: set.id }],
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
      const normalizedSetId = (setId || '').trim();
      const setIdNumber = parseInt(normalizedSetId, 10);
      const hasNumericSetId = !isNaN(setIdNumber);
      const queryParts: string[] = [];
      const parameters: { name: string; value: string | number }[] = [];

      if (hasNumericSetId) {
        queryParts.push('c.setId = @setIdNumber');
        parameters.push({ name: '@setIdNumber', value: setIdNumber });
      }

      if (normalizedSetId.length > 0) {
        queryParts.push('c.setId = @setIdString');
        parameters.push({ name: '@setIdString', value: normalizedSetId });

        const prefixedSetId = normalizedSetId.startsWith('pokedata-')
          ? null
          : `pokedata-${normalizedSetId}`;

        if (prefixedSetId) {
          queryParts.push('c.setId = @prefixedSetId');
          parameters.push({ name: '@prefixedSetId', value: prefixedSetId });
        }
      }

      if (queryParts.length === 0) {
        console.warn(`[CosmosDbService] No valid setId filters provided for value "${setId}"`);
        return [];
      }

      const queryText = `SELECT * FROM c WHERE ${queryParts.join(' OR ')}`;

      console.log(
        `[CosmosDbService] Querying cards for setId variants - raw: "${setId}", numeric: ${
          hasNumericSetId ? setIdNumber : 'N/A'
        }`
      );

      const { resources } = await this.cardContainer.items
        .query({
          query: queryText,
          parameters,
        })
        .fetchAll();

      console.log(
        `[CosmosDbService] Found ${resources.length} cards for setId "${
          normalizedSetId || setId
        }"`
      );

      return resources as Card[];
    } catch (error) {
      console.error(`Error getting cards for setId ${setId}:`, error);
      return [];
    }
  }

  async saveCard(card: Card): Promise<void> {
    try {
      console.log(`[CosmosDbService] Saving card: ${card.id} for setId: ${card.setId}`);

      const result = await this.cardContainer.items.upsert(card);
      console.log(
        `[CosmosDbService] Successfully saved card ${card.id} - Status: ${result.statusCode}, RU: ${result.requestCharge}`
      );
    } catch (error) {
      console.error(`[CosmosDbService] ERROR saving card ${card.id}:`, error);
      throw error;
    }
  }

  async saveCards(cards: Card[]): Promise<void> {
    try {
      console.log(`[CosmosDbService] Starting batch save of ${cards.length} cards`);
      const startTime = Date.now();

      if (cards.length === 0) {
        console.log(`[CosmosDbService] No cards to save`);
        return;
      }

      const BATCH_SIZE = 100;
      const batches = [];

      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        batches.push(cards.slice(i, i + BATCH_SIZE));
      }

      console.log(
        `[CosmosDbService] Processing ${cards.length} cards in ${batches.length} batches of ${BATCH_SIZE}`
      );

      let totalSaved = 0;
      let totalRU = 0;

      const CONCURRENT_BATCHES = 3;

      for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
        const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);

        const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
          const actualBatchIndex = i + batchIndex;
          console.log(
            `[CosmosDbService] Processing batch ${actualBatchIndex + 1}/${
              batches.length
            } with ${batch.length} cards`
          );

          const batchStartTime = Date.now();
          let batchRU = 0;
          let batchSaved = 0;

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
              console.error(`[CosmosDbService] Failed to save card ${card.id}:`, error);
              return { success: false, cardId: card.id, error };
            }
          });

          const results = await Promise.all(cardPromises);
          const batchTime = Date.now() - batchStartTime;

          const failures = results.filter((r) => !r.success);
          if (failures.length > 0) {
            console.warn(
              `[CosmosDbService] Batch ${actualBatchIndex + 1} had ${failures.length} failures`
            );
          }

          console.log(
            `[CosmosDbService] Batch ${actualBatchIndex + 1} completed: ${batchSaved}/${
              batch.length
            } cards in ${batchTime}ms, RU: ${batchRU.toFixed(2)}`
          );

          return {
            saved: batchSaved,
            ru: batchRU,
            failures: failures.length,
          };
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
      const avgTimePerCard = totalTime / cards.length;
      const avgRUPerCard = totalRU / cards.length;

      console.log(
        `[CosmosDbService] Batch save completed: ${totalSaved}/${cards.length} cards`
      );
      console.log(
        `[CosmosDbService] Performance: ${totalTime}ms total (${avgTimePerCard.toFixed(
          1
        )}ms/card), ${totalRU.toFixed(2)} RU total (${avgRUPerCard.toFixed(2)} RU/card)`
      );

      if (totalSaved < cards.length) {
        const failedCount = cards.length - totalSaved;
        console.warn(`[CosmosDbService] WARNING: ${failedCount} cards failed to save`);
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

  async getAllSets(): Promise<PokemonSet[]> {
    try {
      console.log('[CosmosDbService] Getting all sets from Cosmos DB');

      const { resources } = await this.setContainer.items.readAll().fetchAll();
      console.log(`[CosmosDbService] Found ${resources.length} sets in Cosmos DB`);

      if (resources.length > 0) {
        console.log('Sample sets from Cosmos DB:');
        resources.slice(0, Math.min(3, resources.length)).forEach((set: any) => {
          console.log(`- ${set.name} (${set.code}): ${set.cardCount} cards`);
        });
      }

      return resources as PokemonSet[];
    } catch (error) {
      console.error(`Error getting all sets:`, error);

      try {
        console.log('Falling back to query approach...');
        const querySpec = {
          query: 'SELECT * FROM c',
        };

        const { resources } = await this.setContainer.items.query(querySpec).fetchAll();
        console.log(`[CosmosDbService] Found ${resources.length} sets using query()`);

        return resources as PokemonSet[];
      } catch (queryError) {
        console.error(`Error querying sets:`, queryError);
        return [];
      }
    }
  }

  async getSet(setCode: string): Promise<PokemonSet | null> {
    try {
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.code = @setCode',
        parameters: [{ name: '@setCode', value: setCode }],
      };

      const { resources } = await this.setContainer.items
        .query(querySpec)
        .fetchAll();
      return resources.length > 0 ? (resources[0] as PokemonSet) : null;
    } catch (error) {
      console.error(`Error getting set ${setCode}:`, error);
      return null;
    }
  }

  async saveSets(sets: PokemonSet[]): Promise<void> {
    try {
      console.log(`[CosmosDbService] Saving ${sets.length} sets`);

      const setsWithTimestamp = sets.map((set) => ({
        ...set,
        lastUpdated: new Date().toISOString(),
      }));

      if (setsWithTimestamp.length > 0) {
        console.log('Sample sets being saved:');
        setsWithTimestamp.slice(0, Math.min(3, setsWithTimestamp.length)).forEach((set) => {
          console.log(`- ${set.name} (${set.code}): ${set.cardCount} cards`);
        });
      }

      for (const set of setsWithTimestamp) {
        await this.setContainer.items.upsert(set);
      }

      console.log(`[CosmosDbService] Successfully saved ${sets.length} sets`);
    } catch (error) {
      console.error(`Error saving sets:`, error);
      throw error;
    }
  }

  async getCurrentSets(): Promise<PokemonSet[]> {
    try {
      console.log('[CosmosDbService] Getting current sets from Cosmos DB');

      const allSets = await this.getAllSets();
      const currentSets = allSets.filter((set) => set.isCurrent === true);
      console.log(`[CosmosDbService] Found ${currentSets.length} current sets`);

      return currentSets;
    } catch (error) {
      console.error(`Error getting current sets:`, error);

      try {
        console.log('Falling back to query approach for current sets...');
        const querySpec = {
          query: 'SELECT * FROM c WHERE c.isCurrent = true',
        };

        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        console.log(
          `[CosmosDbService] Found ${resources.length} current sets using query()`
        );

        return resources as PokemonSet[];
      } catch (queryError) {
        console.error(`Error querying current sets:`, queryError);
        return [];
      }
    }
  }
}

let cosmosDbServiceInstance: CosmosDbService | null = null;

export function getCosmosDbService(): CosmosDbService {
  if (!cosmosDbServiceInstance) {
    const config = getConfig();
    cosmosDbServiceInstance = new CosmosDbService(config.cosmosDbConnectionString);
  }
  return cosmosDbServiceInstance;
}
