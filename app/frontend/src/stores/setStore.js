import { writable, derived } from 'svelte/store';
import { hybridDataService } from '../services/hybridDataService';
import { expansionMapper } from '../services/expansionMapper';
import { error } from './uiStore';
import { uiLogger } from '../services/loggerService';

// Create stores for state
export const availableSets = writable([]);
export const groupedSetsForDropdown = writable([]);
export const selectedSet = writable(null);
export const isLoadingSets = writable(true);

// Actions
export async function loadSets() {
    isLoadingSets.set(true);
    
    try {
        uiLogger.info('Loading set list');
        const setsData = await hybridDataService.getSetList();
        
        // Handle the case where sets might be returned as a grouped object
        let sets = [];
        
        if (Array.isArray(setsData)) {
            // Direct array of sets
            sets = setsData;
            uiLogger.info('Loaded sets from API', { count: sets.length });
        } else if (typeof setsData === 'object' && Object.keys(setsData).length > 0) {
            // Sets already grouped by expansion
            sets = Object.values(setsData).flat();
            
            // For grouped sets, we can use them directly
            const formattedGroupedSets = expansionMapper.prepareGroupedSetsForDropdown(setsData);
            groupedSetsForDropdown.set(formattedGroupedSets);
            uiLogger.info('Loaded pre-grouped sets from API', { totalSets: sets.length, groups: formattedGroupedSets.length });
            
            // Skip the grouping steps since data is already grouped
            availableSets.set(sets);
            isLoadingSets.set(false);
            return;
        } else {
            uiLogger.warn('Unexpected format for sets data');
            sets = [];
        }
        
        // For array data, proceed with the normal grouping process
        const groupedSets = expansionMapper.groupSetsByExpansion(sets);
        const formattedGroupedSets = expansionMapper.prepareGroupedSetsForDropdown(groupedSets);
        
        groupedSetsForDropdown.set(formattedGroupedSets);
        availableSets.set(sets);
    } catch (err) {
        uiLogger.error('Error loading set list', { error: err });
        error.set('Failed to load set list. ' + err.message);
        
        // Fallback to imported data
        uiLogger.info('Using fallback set list');
        const { setList } = await import('../data/setList.js');
        availableSets.set(setList);
        
        // Also update grouped sets with fallback data
        const groupedSets = expansionMapper.groupSetsByExpansion(setList);
        groupedSetsForDropdown.set(expansionMapper.prepareGroupedSetsForDropdown(groupedSets));
    } finally {
        isLoadingSets.set(false);
        uiLogger.success('Set list loading complete');
    }
}

export function selectSet(set) {
    uiLogger.logInteraction('setStore', 'setSelected', { setName: set?.name, setCode: set?.code });
    selectedSet.set(set);
    
    // Clear error when set changes
    error.set(null);
}
