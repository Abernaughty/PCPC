import axios from 'axios';
import { Card } from '../models/Card';
import { Set } from '../models/Set';
import { PriceData } from '../models/Card';

export interface IPokemonTcgApiService {
    getAllSets(): Promise<Set[]>;
    getSet(setCode: string): Promise<Set | null>;
    getCardsBySet(setCode: string): Promise<Card[]>;
    getCard(cardId: string): Promise<Card | null>;
    getCardPricing(cardId: string): Promise<PriceData | null>;
}

export class PokemonTcgApiService implements IPokemonTcgApiService {
    private apiKey: string;
    private baseUrl: string;
    
    constructor(apiKey: string, baseUrl: string = 'https://api.pokemontcg.io/v2') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    
    private getHeaders() {
        return {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }
    
    async getAllSets(): Promise<Set[]> {
        console.log(`[PokemonTcgApiService] Getting all sets`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/sets`, { headers: this.getHeaders() });
            return response.data.data.map((apiSet: any) => this.mapApiSetToSet(apiSet));
        } catch (error: any) {
            console.error(`[PokemonTcgApiService] Error getting sets: ${error.message}`);
            return [];
        }
    }
    
    async getSet(setCode: string): Promise<Set | null> {
        console.log(`[PokemonTcgApiService] Getting set: ${setCode}`);
        
        try {
            // The API doesn't support direct lookup by set code, so we need to get all sets and filter
            const sets = await this.getAllSets();
            return sets.find(set => set.code === setCode) || null;
        } catch (error: any) {
            console.error(`[PokemonTcgApiService] Error getting set ${setCode}: ${error.message}`);
            return null;
        }
    }
    
async getCardsBySet(setCode: string): Promise<Card[]> {
        console.log(`[PokemonTcgApiService] Getting cards for set: ${setCode}`);
        
        try {
            // Implementation with proper pagination to handle sets with more than 250 cards
            let allCards: any[] = [];
            let page = 1;
            let hasMorePages = true;
            const pageSize = 250; // Maximum page size supported by the API
            
            console.log(`[PokemonTcgApiService] Fetching cards with pagination (pageSize: ${pageSize})`);
            
            // Keep fetching pages until no more data is returned
            while (hasMorePages) {
                console.log(`[PokemonTcgApiService] Fetching page ${page} for set ${setCode}`);
                
                const response = await axios.get(`${this.baseUrl}/cards`, { 
                    headers: this.getHeaders(),
                    params: {
                        q: `set.ptcgoCode:${setCode}`,
                        orderBy: 'number',
                        page: page,
                        pageSize: pageSize
                    }
                });
                
                const pageData = response.data.data || [];
                
                // Add cards from this page to our collection
                allCards = [...allCards, ...pageData];
                
                // Check if we need to fetch more pages
                // If we got fewer results than pageSize, we've reached the end
                if (pageData.length < pageSize) {
                    hasMorePages = false;
                    console.log(`[PokemonTcgApiService] Reached the end of pages for set ${setCode} (received ${pageData.length} cards)`);
                } else {
                    // If we got a full page, there might be more
                    page++;
                    console.log(`[PokemonTcgApiService] Retrieved ${pageData.length} cards, proceeding to page ${page}`);
                }
            }
            
            console.log(`[PokemonTcgApiService] Retrieved a total of ${allCards.length} cards for set ${setCode}`);
            
            // Map API response to our Card model
            return allCards.map((apiCard: any) => this.mapApiCardToCard(apiCard));
        } catch (error: any) {
            console.error(`[PokemonTcgApiService] Error getting cards for set ${setCode}: ${error.message}`);
            return [];
        }
    }
    
    async getCard(cardId: string): Promise<Card | null> {
        console.log(`[PokemonTcgApiService] Getting card: ${cardId}`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/cards/${cardId}`, { headers: this.getHeaders() });
            return this.mapApiCardToCard(response.data.data);
        } catch (error: any) {
            console.error(`[PokemonTcgApiService] Error getting card ${cardId}: ${error.message}`);
            return null;
        }
    }
    
    async getCardPricing(cardId: string): Promise<PriceData | null> {
        console.log(`[PokemonTcgApiService] Getting pricing for card: ${cardId}`);
        
        try {
            const response = await axios.get(`${this.baseUrl}/cards/${cardId}`, { headers: this.getHeaders() });
            return this.mapApiPricingToPriceData(response.data.data.tcgplayer?.prices?.holofoil);
        } catch (error: any) {
            console.error(`[PokemonTcgApiService] Error getting pricing for card ${cardId}: ${error.message}`);
            return null;
        }
    }
    
    // Helper methods for mapping API responses to our models
    private mapApiSetToSet(apiSet: any): Set {
        return {
            id: apiSet.id,
            code: apiSet.ptcgoCode || apiSet.id.toUpperCase(),
            name: apiSet.name,
            series: apiSet.series,
            releaseDate: apiSet.releaseDate,
            cardCount: apiSet.total,
            isCurrent: this.isCurrentSet(apiSet.releaseDate)
        };
    }
    
    private mapApiCardToCard(apiCard: any): Card {
        return {
            id: apiCard.id,
            setCode: apiCard.set.ptcgoCode || apiCard.set.id.toUpperCase(),
            setId: apiCard.set.id,
            setName: apiCard.set.name,
            cardId: apiCard.id,
            cardName: apiCard.name,
            cardNumber: apiCard.number,
            rarity: apiCard.rarity,
            imageUrl: apiCard.images.small,
            imageUrlHiRes: apiCard.images.large,
            tcgPlayerPrice: this.mapApiPricingToPriceData(apiCard.tcgplayer?.prices?.holofoil) || undefined
        };
    }
    
    private mapApiPricingToPriceData(apiPricing: any): PriceData | null {
        if (!apiPricing) return null;
        
        return {
            market: apiPricing.market || 0,
            low: apiPricing.low || 0,
            mid: apiPricing.mid || 0,
            high: apiPricing.high || 0
        };
    }
    
    private isCurrentSet(releaseDate: string): boolean {
        // If no release date is provided, consider it not current
        if (!releaseDate) {
            return false;
        }
        
        try {
            const releaseTimestamp = new Date(releaseDate).getTime();
            const now = Date.now();
            const oneYearAgo = now - 365 * 24 * 60 * 60 * 1000;
            
            // For testing purposes, consider the two most recent sets as current
            // This ensures we have some current sets to import cards for
            const isRecent = releaseTimestamp > oneYearAgo;
            
            console.log(`Set with release date ${releaseDate} is ${isRecent ? 'current' : 'not current'}`);
            
            return isRecent;
        } catch (error) {
            console.error(`Error determining if set is current (release date: ${releaseDate}):`, error);
            return false;
        }
    }
}
