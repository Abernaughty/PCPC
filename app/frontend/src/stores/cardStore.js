import { writable, derived } from 'svelte/store';
import { hybridDataService } from '../services/hybridDataService';
import { selectedSet } from './setStore';
import { error } from './uiStore';
import { uiLogger } from '../services/loggerService';

// Create stores for state
export const cardsInSet = writable([]);
export const selectedCard = writable(null);
export const isLoadingCards = writable(false);

// Derived store
export const cardName = derived(
    selectedCard,
    $selectedCard => $selectedCard ? $selectedCard.name : ''
);

// Actions
export function selectCard(card) {
    uiLogger.logInteraction('cardStore', 'cardSelected', { cardName: card?.name, cardId: card?.id });
    selectedCard.set(card);
    error.set(null); // Clear any errors when a new card is selected
}

export async function loadCardsForSet(set) {
    if (!set) return;
    if (!set.id) {
        uiLogger.error('Set ID is required but not available', { set });
        error.set("Selected set is missing required data.");
        return;
    }
    
    try {
        // Reset card-related state
        selectedCard.set(null);
        cardsInSet.set([]);
        
        // Show loading state
        isLoadingCards.set(true);
        error.set(null);
        
        uiLogger.info('Loading cards for set', { setName: set.name, setCode: set.code });
        
        // Get cards for the selected set using the hybridDataService
        let cards = await hybridDataService.getCardsForSet(set.code, set.id);
        
        if (!cards || cards.length === 0) {
            uiLogger.warn('No cards returned for set', { setName: set.name });
            error.set(`No cards found for set "${set.name}". Please try another set or check your connection.`);
            return;
        }
        
        // Transform the cards into a format suitable for the SearchableSelect component
        const transformedCards = cards.map(card => ({
            id: card.id || `fallback-${card.num || Math.random()}`,
            name: card.name || 'Unknown Card',
            num: card.num || '',
            rarity: card.rarity || '',
            variant: card.variant || '',
            image_url: card.image_url || ''
        }));
        
        // Sort cards by card number
        transformedCards.sort((a, b) => {
            // Extract numeric part from card numbers (e.g. "001" → 1)
            const numA = a.num ? parseInt(a.num.replace(/\D/g, '')) : 0;
            const numB = b.num ? parseInt(b.num.replace(/\D/g, '')) : 0;
            return numA - numB;
        });
        
        cardsInSet.set(transformedCards);
        uiLogger.success('Cards loaded and processed', { cardCount: transformedCards.length, setName: set.name });
        
        // Check if any cards lack name property
        const invalidCards = cards.filter(card => !card.name);
        if (invalidCards.length > 0) {
            uiLogger.warn('Found cards without names', { invalidCardCount: invalidCards.length });
        }
    } catch (err) {
        uiLogger.error('Error loading cards for set', { setName: set.name, error: err });
        error.set(`Failed to load cards: ${err.message}`);
        cardsInSet.set([]); // Reset to empty array in case of error
    } finally {
        isLoadingCards.set(false);
    }
}

// Handle set selection changes
selectedSet.subscribe(set => {
    if (!set) {
        // User cleared the selection - this is valid, just clear card-related state
        uiLogger.debug('Set selection cleared, resetting card state');
        selectedCard.set(null);
        cardsInSet.set([]);
    } else if (set.id) {
        // Valid set with ID - load cards
        loadCardsForSet(set);
    } else {
        // Set selected but missing ID - show error
        uiLogger.error('Selected set does not have an ID property', { set });
        error.set('Invalid set data. Please select a different set.');
    }
});
