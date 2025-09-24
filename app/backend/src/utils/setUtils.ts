import { Set, GroupedSets, SetOrGroup } from '../models/Set';

/**
 * Group sets by expansion series
 * @param sets The sets to group
 * @returns The grouped sets
 */
export function groupSetsByExpansion(sets: Set[]): SetOrGroup[] {
    // Sort sets by release date (newest first)
    const sortedSets = [...sets].sort((a, b) => {
        return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
    });
    
    // Group sets by series
    const seriesMap = new Map<string, Set[]>();
    
    for (const set of sortedSets) {
        const series = set.series || 'Other';
        
        if (!seriesMap.has(series)) {
            seriesMap.set(series, []);
        }
        
        seriesMap.get(series)!.push(set);
    }
    
    // Convert map to array of groups
    const result: SetOrGroup[] = [];
    
    // Sort series by most recent set in each series
    const sortedSeries = Array.from(seriesMap.entries()).sort((a, b) => {
        const aDate = new Date(a[1][0].releaseDate).getTime();
        const bDate = new Date(b[1][0].releaseDate).getTime();
        return bDate - aDate;
    });
    
    for (const [series, seriesSets] of sortedSeries) {
        // Add group
        result.push({
            type: 'group',
            name: series,
            items: seriesSets
        });
    }
    
    return result;
}

/**
 * Filter sets to only include current sets
 * @param sets The sets to filter
 * @returns The current sets
 */
export function getCurrentSets(sets: Set[]): Set[] {
    return sets.filter(set => set.isCurrent);
}

/**
 * Get the expansion series for a set
 * @param set The set
 * @returns The expansion series
 */
export function getExpansionSeries(set: Set): string {
    return set.series || 'Other';
}

/**
 * Check if a set is a current set
 * @param set The set
 * @param currentDate The current date (defaults to now)
 * @returns Whether the set is current
 */
export function isCurrentSet(set: Set, currentDate: Date = new Date()): boolean {
    const releaseDate = new Date(set.releaseDate);
    const oneYearAgo = new Date(currentDate);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    return releaseDate >= oneYearAgo;
}

/**
 * Format a set name for display
 * @param set The set
 * @returns The formatted set name
 */
export function formatSetName(set: Set): string {
    return `${set.name} (${set.code})`;
}
