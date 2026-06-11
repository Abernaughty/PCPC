import pkg from 'redis';
import { createContextLogger } from '$lib/services/logger';
const { createClient } = pkg;

const log = createContextLogger('RedisCacheService');
type RedisClientType = ReturnType<typeof createClient>;

export interface IRedisCacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  isEnabled(): boolean;
}

export class RedisCacheService implements IRedisCacheService {
  private client: RedisClientType | null = null;
  private enabled: boolean = false;
  private connectionString: string;

  constructor(connectionString: string, enabled: boolean = true) {
    this.connectionString = connectionString;
    this.enabled = enabled;

    if (enabled) {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    try {

      this.client = createClient({
        url: this.connectionString,
      });

      this.client.on('error', (err) => {
        log.error('Redis error:', err);
        this.enabled = false;
      });

      this.client.on('connect', () => {
        log.info('Connected to Redis');
      });

      this.client.on('disconnect', () => {
        log.warn('Disconnected from Redis');
      });

      await this.client.connect();
    } catch (error) {
      log.warn('Failed to initialize Redis:', error);
      this.enabled = false;
      this.client = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      log.warn(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }

      log.debug(`Cached key ${key}${ttlSeconds ? ` (TTL: ${ttlSeconds}s)` : ''}`);
    } catch (error) {
      log.warn(`Error setting key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.del(key);
      log.debug(`Deleted key ${key}`);
    } catch (error) {
      log.warn(`Error deleting key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      log.warn(`Error checking key existence ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    try {
      await this.client.flushDb();
      log.info('Cache cleared');
    } catch (error) {
      log.warn('Error clearing cache:', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled && this.client !== null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.client = null;
      this.enabled = false;
      log.info('Disconnected from Redis');
    }
  }
}

let redisCacheServiceInstance: RedisCacheService | null = null;

export function getRedisCacheService(): RedisCacheService {
  if (!redisCacheServiceInstance) {
    const connectionString = process.env.REDIS_CONNECTION_STRING || 'redis://localhost:6379';
    const enableRedisCache = process.env.ENABLE_REDIS_CACHE === 'true';

    redisCacheServiceInstance = new RedisCacheService(connectionString, enableRedisCache);
  }
  return redisCacheServiceInstance;
}
