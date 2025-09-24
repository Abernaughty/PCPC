import { createClient, RedisClientType } from 'redis';

export interface IRedisCacheService {
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    clear(pattern: string): Promise<number>;
}

export class RedisCacheService implements IRedisCacheService {
    private client: RedisClientType | null = null;
    private enabled: boolean;
    private connectionString: string;
    private connected: boolean = false;
    
    constructor(connectionString: string, enabled: boolean = true) {
        this.connectionString = connectionString;
        this.enabled = enabled && !!connectionString;
        
        if (this.enabled) {
            this.initializeClient().catch(err => {
                console.error('Redis connection error:', err);
                this.enabled = false;
            });
        }
    }
    
    private async initializeClient() {
        try {
            if (!this.client) {
                this.client = createClient({ url: this.connectionString });
                
                this.client.on('error', (err) => {
                    console.error('Redis client error:', err);
                    this.connected = false;
                });
                
                this.client.on('connect', () => {
                    console.log('Connected to Redis');
                    this.connected = true;
                });
                
                await this.client.connect();
            }
        } catch (error) {
            console.error('Failed to initialize Redis client:', error);
            this.enabled = false;
            throw error;
        }
    }
    
    private async ensureConnected() {
        if (!this.enabled) {
            return false;
        }
        
        if (!this.client || !this.connected) {
            try {
                await this.initializeClient();
                return this.connected;
            } catch (error) {
                return false;
            }
        }
        
        return true;
    }
    
    async get<T>(key: string): Promise<T | null> {
        if (!await this.ensureConnected()) {
            console.log(`[RedisCacheService] Cache disabled or not connected, skipping get for key: ${key}`);
            return null;
        }
        
        try {
            const data = await this.client!.get(key);
            return data ? JSON.parse(data) as T : null;
        } catch (error) {
            console.error(`[RedisCacheService] Error getting cache key ${key}:`, error);
            return null;
        }
    }
    
    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
        if (!await this.ensureConnected()) {
            console.log(`[RedisCacheService] Cache disabled or not connected, skipping set for key: ${key}`);
            return;
        }
        
        try {
            await this.client!.set(key, JSON.stringify(value), { EX: ttlSeconds });
        } catch (error) {
            console.error(`[RedisCacheService] Error setting cache key ${key}:`, error);
        }
    }
    
    async delete(key: string): Promise<void> {
        if (!await this.ensureConnected()) {
            console.log(`[RedisCacheService] Cache disabled or not connected, skipping delete for key: ${key}`);
            return;
        }
        
        try {
            await this.client!.del(key);
        } catch (error) {
            console.error(`[RedisCacheService] Error deleting cache key ${key}:`, error);
        }
    }
    
    async exists(key: string): Promise<boolean> {
        if (!await this.ensureConnected()) {
            console.log(`[RedisCacheService] Cache disabled or not connected, skipping exists check for key: ${key}`);
            return false;
        }
        
        try {
            const exists = await this.client!.exists(key);
            return exists === 1;
        } catch (error) {
            console.error(`[RedisCacheService] Error checking if key exists ${key}:`, error);
            return false;
        }
    }
    
    async clear(pattern: string): Promise<number> {
        if (!await this.ensureConnected()) {
            console.log(`[RedisCacheService] Cache disabled or not connected, skipping clear for pattern: ${pattern}`);
            return 0;
        }
        
        try {
            let cursor = 0;
            let deletedCount = 0;
            
            do {
                const scanResult = await this.client!.scan(cursor, { MATCH: pattern, COUNT: 100 });
                cursor = scanResult.cursor;
                
                if (scanResult.keys.length > 0) {
                    await this.client!.del(scanResult.keys);
                    deletedCount += scanResult.keys.length;
                }
            } while (cursor !== 0);
            
            return deletedCount;
        } catch (error) {
            console.error(`[RedisCacheService] Error clearing cache keys matching pattern ${pattern}:`, error);
            return 0;
        }
    }
}
