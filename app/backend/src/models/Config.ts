export interface CacheOptions {
    setsTtl: number;
    cardsTtl: number;
    pricingTtl: number;
}

export enum ImageSourceStrategy {
    Hybrid = 'hybrid',
    External = 'external',
    Internal = 'internal'
}

export interface ImageOptions {
    cdnEndpoint: string;
    sourceStrategy: ImageSourceStrategy;
    enableCdn: boolean;
}

export interface ApiOptions {
    pokemonTcgApiBaseUrl: string;
    pokemonTcgApiKey: string;
    pokeDataApiBaseUrl: string;
    pokeDataApiKey: string;
}

export interface ImportOptions {
    batchSize: number;
    retryCount: number;
    retryDelay: number;
}
