/**
 * Set Classifier Service
 * Determines which sets are considered "current" and should be cached
 */
import { currentSetsConfig } from '../data/currentSetsConfig';

class SetClassifier {
  constructor() {
    // Initialize with baseline codes
    this.currentSetCodes = [...currentSetsConfig.baselineCodes];
    this.currentExpansion = currentSetsConfig.currentExpansion;
    this.maxAgeMonths = currentSetsConfig.maxAgeMonths;
    this.lastUpdated = new Date(currentSetsConfig.lastUpdated);
  }
  
  /**
   * Check if a set is current
   * @param {string} setCode - The set code to check
   * @returns {boolean} True if the set is current
   */
  isCurrentSet(setCode) {
    return this.currentSetCodes.includes(setCode);
  }
  
  /**
   * Get all current set codes
   * @returns {Array<string>} Array of current set codes
   */
  getCurrentSetCodes() {
    return [...this.currentSetCodes];
  }
  
  /**
   * Update current sets based on API data
   * @param {Array} allSets - Array of all sets from the API
   * @returns {boolean} True if the update was successful
   */
  updateFromApiData(allSets) {
    if (!allSets || !Array.isArray(allSets) || allSets.length === 0) {
      console.warn('Invalid sets data for updating current sets');
      return false;
    }
    
    try {
      // Filter sets by the current expansion series
      const currentExpansionSets = allSets.filter(set => 
        (set.series && set.series === this.currentExpansion) || 
        (set.name && set.name.includes(this.currentExpansion))
      );
      
      if (currentExpansionSets.length === 0) {
        console.warn(`Could not find any sets matching the current expansion: ${this.currentExpansion}`);
        return false;
      }
      
      // Calculate cutoff date for "current" sets
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - this.maxAgeMonths);
      
      // Filter by release date
      const currentSets = currentExpansionSets.filter(set => {
        if (!set.release_date) return true; // Include if no release date (be inclusive)
        
        const releaseDate = new Date(set.release_date);
        return !isNaN(releaseDate) && releaseDate >= cutoffDate;
      });
      
      if (currentSets.length === 0) {
        console.warn('No current sets found after date filtering');
        return false;
      }
      
      // Extract set codes
      const setCodes = currentSets.map(set => set.code).filter(Boolean);
      
      if (setCodes.length === 0) {
        console.warn('No valid set codes found in current sets');
        return false;
      }
      
      // Update our list
      this.currentSetCodes = setCodes;
      this.lastUpdated = new Date();
      
      console.log(`Updated current sets: ${setCodes.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error updating current sets:', error);
      return false;
    }
  }
  
  /**
   * Save the current configuration to IndexedDB
   * @param {Object} dbService - The database service
   * @returns {Promise<boolean>} True if the save was successful
   */
  async saveToDatabase(dbService) {
    try {
      if (!dbService) return false;
      
      const config = {
        currentSetCodes: this.currentSetCodes,
        currentExpansion: this.currentExpansion,
        maxAgeMonths: this.maxAgeMonths,
        lastUpdated: this.lastUpdated.toISOString()
      };
      
      await dbService.saveCurrentSetsConfig(config);
      return true;
    } catch (error) {
      console.error('Error saving current sets config:', error);
      return false;
    }
  }
  
  /**
   * Load configuration from IndexedDB
   * @param {Object} dbService - The database service
   * @returns {Promise<boolean>} True if the load was successful
   */
  async loadFromDatabase(dbService) {
    try {
      if (!dbService) return false;
      
      const config = await dbService.getCurrentSetsConfig();
      if (!config) return false;
      
      if (config.currentSetCodes && Array.isArray(config.currentSetCodes)) {
        this.currentSetCodes = config.currentSetCodes;
      }
      
      if (config.currentExpansion) {
        this.currentExpansion = config.currentExpansion;
      }
      
      if (config.maxAgeMonths) {
        this.maxAgeMonths = config.maxAgeMonths;
      }
      
      if (config.lastUpdated) {
        this.lastUpdated = new Date(config.lastUpdated);
      }
      
      console.log(`Loaded current sets config from database: ${this.currentSetCodes.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error loading current sets config:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const setClassifier = new SetClassifier();
