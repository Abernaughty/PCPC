import { Timer } from "@azure/functions";
import { cosmosDbService, pokeDataApiService, redisCacheService } from "../../index";

/**
 * Smart Incremental RefreshData Function
 * 
 * This function implements token-efficient refresh strategy:
 * 1. Gets current set count from PokeData API (5 credits)
 * 2. Compares with database count
 * 3. If counts match, exits immediately (no additional token usage)
 * 4. If counts differ, only refreshes set metadata (no individual card pricing)
 * 5. Card pricing is fetched on-demand when users request specific cards
 * 
 * Token usage per run:
 * - Normal case (no changes): 5 credits
 * - New sets available: 5 + minimal set updates
 * - NEVER calls individual card pricing during refresh
 */
export async function refreshData(myTimer: Timer): Promise<void> {
  const timestamp = new Date().toISOString();
  const correlationId = `[smart-refresh-${Date.now()}]`;
  const startTime = Date.now();
  
  console.log(`${correlationId} Smart incremental RefreshData function executed at ${timestamp}`);
  
  try {
    // Step 1: Get current set count from PokeData API (5 credits)
    console.log(`${correlationId} Step 1: Checking PokeData API for current set count...`);
    const apiStartTime = Date.now();
    
    const pokeDataSets = await pokeDataApiService.getAllSets();
    const apiSetCount = pokeDataSets.length;
    const apiTime = Date.now() - apiStartTime;
    
    console.log(`${correlationId} PokeData API returned ${apiSetCount} sets (${apiTime}ms, 5 credits used)`);
    
    // Step 2: Get current database set count
    console.log(`${correlationId} Step 2: Checking database for current set count...`);
    const dbStartTime = Date.now();
    
    const dbSets = await cosmosDbService.getAllSets();
    const dbSetCount = dbSets.length;
    const dbTime = Date.now() - dbStartTime;
    
    console.log(`${correlationId} Database contains ${dbSetCount} sets (${dbTime}ms)`);
    
    // Step 3: Compare counts for smart refresh decision
    if (apiSetCount === dbSetCount) {
      const totalTime = Date.now() - startTime;
      console.log(`${correlationId} ✅ Set counts match (API: ${apiSetCount}, DB: ${dbSetCount})`);
      console.log(`${correlationId} ✅ No refresh needed - exiting after ${totalTime}ms (5 credits total)`);
      console.log(`${correlationId} ✅ Smart incremental refresh complete - optimal token usage achieved`);
      return;
    }
    
    // Step 4: Set counts differ - refresh set metadata only
    console.log(`${correlationId} 🔄 Set count mismatch detected (API: ${apiSetCount}, DB: ${dbSetCount})`);
    console.log(`${correlationId} 🔄 Refreshing set metadata only (no individual card pricing)`);
    
    const refreshStartTime = Date.now();
    
    // Transform PokeData sets to our Set model format
    const transformedSets = pokeDataSets.map(pokeDataSet => ({
      id: String(pokeDataSet.id), // Convert number to string for Set model
      name: pokeDataSet.name,
      code: pokeDataSet.code || `pokedata-${pokeDataSet.id}`,
      series: 'PokeData', // PokeData API doesn't have series field, use default
      cardCount: 0, // Will be populated when users request specific sets
      releaseDate: pokeDataSet.release_date || '',
      isCurrent: isCurrentSet(pokeDataSet),
      lastUpdated: timestamp
    }));
    
    // Save sets to database using batch operation
    await cosmosDbService.saveSets(transformedSets);
    const refreshTime = Date.now() - refreshStartTime;
    
    console.log(`${correlationId} ✅ Successfully refreshed ${transformedSets.length} set records in ${refreshTime}ms`);
    
    // Step 5: Invalidate sets cache to ensure fresh data
    if (process.env.ENABLE_REDIS_CACHE === "true") {
      const cacheStartTime = Date.now();
      await redisCacheService.delete('sets:pokedata:all');
      await redisCacheService.delete('sets:pokedata:current');
      const cacheTime = Date.now() - cacheStartTime;
      console.log(`${correlationId} ✅ Invalidated sets cache (${cacheTime}ms)`);
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`${correlationId} ✅ Smart incremental refresh completed in ${totalTime}ms`);
    console.log(`${correlationId} ✅ Sets updated: ${transformedSets.length}`);
    console.log(`${correlationId} ✅ Token usage: 5 credits (optimal efficiency)`);
    console.log(`${correlationId} ✅ Card pricing will be fetched on-demand when users request specific cards`);
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`${correlationId} ERROR in smart incremental refresh after ${totalTime}ms: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}


/**
 * Determine if a PokeData set should be considered "current"
 */
function isCurrentSet(pokeDataSet: any): boolean {
  if (!pokeDataSet.release_date) return false;
  
  const releaseDate = new Date(pokeDataSet.release_date);
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - (2 * 365 * 24 * 60 * 60 * 1000));
  
  return releaseDate >= twoYearsAgo;
}
