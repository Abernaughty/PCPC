export interface Card {
    id: string;
    setCode: string;
    setId: number;
    setName: string;
    cardId: string;
    cardName: string;
    cardNumber: string;
    rarity: string;
    imageUrl?: string;
    imageUrlHiRes?: string;
    originalImageUrl?: string;
    tcgPlayerPrice?: PriceData;
    enhancedPricing?: EnhancedPriceData;
    lastUpdated?: string;
    pokeDataId?: number;           // PokeData's unique numeric ID
    pricing?: any;                 // Raw pricing data from PokeData API
    pricingLastUpdated?: string;   // Timestamp of last pricing update
    images?: {
        small: string;
        large: string;
        original: string;
        variants?: Record<string, string>;
    };
}

export interface PriceData {
    market: number;
    low: number;
    mid: number;
    high: number;
}

export interface EnhancedPriceData {
    psaGrades?: Record<string, GradedPrice>;
    cgcGrades?: Record<string, GradedPrice>;
    ebayRaw?: SimplePrice;
}

export interface GradedPrice {
    value: number;
}

export interface SimplePrice {
    value: number;
}
