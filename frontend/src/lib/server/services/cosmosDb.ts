import { Container, CosmosClient, Database } from '@azure/cosmos';
import { createContextLogger } from '$lib/services/logger';
import type { Card, PokemonSet } from '../models/types';
import { getConfig } from '../config';

const log = createContextLogger('CosmosDbService');

export interface ICosmosDbService {
  // Card operations
  getCard(cardId: string, setId: string): Promise<Card | null>;
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

    log.info(
      `Initializing (database: ${this.DATABASE_NAME}, cards: ${this.CARDS_CONTAINER_NAME}, sets: ${this.SETS_CONTAINER_NAME})`
    );

    this.client = new CosmosClient(connectionString);

    this.database = this.client.database(this.DATABASE_NAME);
    this.cardContainer = this.database.container(this.CARDS_CONTAINER_NAME);
    this.setContainer = this.database.container(this.SETS_CONTAINER_NAME);

  }

  async getCard(cardId: string, setId: string): Promise<Card | null> {
    try {
      const { resource } = await this.cardContainer.item(cardId, setId).read();

      return resource as Card;
    } catch (error: any) {
      if (error.code === 404) {
        log.debug(`Card ${cardId} not found in set ${setId}`);
        return null;
      }
      log.error(`Error getting card ${cardId} from set ${setId}:`, error);
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
        log.debug(`Set with code ${setCode} not found`);
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
      log.error(`Error getting cards for set ${setCode}:`, error);
      return [];
    }
  }

  async getCardsBySetId(setId: string): Promise<Card[]> {
    try {
      const { resources } = await this.cardContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.setId = @setId',
          parameters: [{ name: '@setId', value: setId }],
        })
        .fetchAll();

      log.debug(`Found ${resources.length} cards for setId "${setId}"`);

      return resources as Card[];
    } catch (error) {
      log.error(`Error getting cards for setId ${setId}:`, error);
      return [];
    }
  }

  async saveCard(card: Card): Promise<void> {
    try {
      const result = await this.cardContainer.items.upsert(card);
      log.debug(
        `Saved card ${card.id} - Status: ${result.statusCode}, RU: ${result.requestCharge}`
      );
    } catch (error) {
      log.error(`Error saving card ${card.id}:`, error);
      throw error;
    }
  }

  async saveCards(cards: Card[]): Promise<void> {
    try {
      const startTime = Date.now();

      if (cards.length === 0) {
        log.debug('No cards to save');
        return;
      }

      const BATCH_SIZE = 100;
      const batches = [];

      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        batches.push(cards.slice(i, i + BATCH_SIZE));
      }

      log.debug(
        `Processing ${cards.length} cards in ${batches.length} batches of ${BATCH_SIZE}`
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
              return {
                success: true,
                cardId: card.id,
                ru: result.requestCharge || 0,
              };
            } catch (error) {
              log.error(`Failed to save card ${card.id}:`, error);
              return { success: false, cardId: card.id, error };
            }
          });

          const results = await Promise.all(cardPromises);
          const batchTime = Date.now() - batchStartTime;

          const failures = results.filter((r) => !r.success);
          if (failures.length > 0) {
            log.warn(
              `Batch ${actualBatchIndex + 1} had ${failures.length} failures`
            );
          }

          log.debug(
            `Batch ${actualBatchIndex + 1} completed: ${batchSaved}/${
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

      log.info(
        `Batch save completed: ${totalSaved}/${cards.length} cards in ${totalTime}ms (${avgTimePerCard.toFixed(
          1
        )}ms/card), ${totalRU.toFixed(2)} RU total (${avgRUPerCard.toFixed(2)} RU/card)`
      );

      if (totalSaved < cards.length) {
        const failedCount = cards.length - totalSaved;
        log.warn(`${failedCount} cards failed to save`);
      }
    } catch (error) {
      log.error('Error in batch save operation:', error);
      throw error;
    }
  }

  async updateCard(card: Card): Promise<void> {
    try {
      await this.cardContainer.item(card.id, card.setId).replace(card);
    } catch (error) {
      log.error(`Error updating card ${card.id}:`, error);
      throw error;
    }
  }

  async getAllSets(): Promise<PokemonSet[]> {
    try {
      const { resources } = await this.setContainer.items.readAll().fetchAll();
      log.debug(`Found ${resources.length} sets in Cosmos DB`);

      return resources as PokemonSet[];
    } catch (error) {
      log.error('Error getting all sets:', error);

      try {
        log.warn('readAll failed; falling back to query approach');
        const querySpec = {
          query: 'SELECT * FROM c',
        };

        const { resources } = await this.setContainer.items.query(querySpec).fetchAll();
        log.debug(`Found ${resources.length} sets using query()`);

        return resources as PokemonSet[];
      } catch (queryError) {
        log.error('Error querying sets:', queryError);
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
      log.error(`Error getting set ${setCode}:`, error);
      return null;
    }
  }

  async saveSets(sets: PokemonSet[]): Promise<void> {
    try {
      const setsWithTimestamp = sets.map((set) => ({
        ...set,
        lastUpdated: new Date().toISOString(),
      }));

      for (const set of setsWithTimestamp) {
        await this.setContainer.items.upsert(set);
      }

      log.info(`Saved ${sets.length} sets`);
    } catch (error) {
      log.error('Error saving sets:', error);
      throw error;
    }
  }

  async getCurrentSets(): Promise<PokemonSet[]> {
    try {
      const allSets = await this.getAllSets();
      const currentSets = allSets.filter((set) => set.isCurrent === true);
      log.debug(`Found ${currentSets.length} current sets`);

      return currentSets;
    } catch (error) {
      log.error('Error getting current sets:', error);

      try {
        log.warn('Falling back to query approach for current sets');
        const querySpec = {
          query: 'SELECT * FROM c WHERE c.isCurrent = true',
        };

        const { resources } = await this.setContainer.items
          .query(querySpec)
          .fetchAll();
        log.debug(`Found ${resources.length} current sets using query()`);

        return resources as PokemonSet[];
      } catch (queryError) {
        log.error('Error querying current sets:', queryError);
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
