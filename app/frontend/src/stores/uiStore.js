import { writable } from 'svelte/store';
import { hybridDataService } from '../services/hybridDataService';
import { dbService } from '../services/storage/db';
import { uiLogger } from '../services/loggerService';

// Create stores for state
export const error = writable(null);
export const isOnline = writable(navigator.onLine);

// Background tasks state
let syncInterval;
let cleanupInterval;
let configUpdateInterval;

// Check if the browser is online
export function initNetworkListeners() {
    const updateOnlineStatus = () => {
        const status = navigator.onLine;
        isOnline.set(status);
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    return () => {
        window.removeEventListener('online', updateOnlineStatus);
        window.removeEventListener('offline', updateOnlineStatus);
    };
}

// Background tasks
export function startBackgroundTasks() {
    startBackgroundSync();
    startCleanupInterval();
    startConfigUpdateInterval();
    
    return () => {
        if (syncInterval) clearInterval(syncInterval);
        if (cleanupInterval) clearInterval(cleanupInterval);
        if (configUpdateInterval) clearInterval(configUpdateInterval);
    };
}

function startBackgroundSync() {
    if (syncInterval) clearInterval(syncInterval);
    
    syncInterval = setInterval(async () => {
        if (navigator.onLine) {
            try {
                await hybridDataService.preloadCurrentSets();
            } catch (error) {
                uiLogger.error('Background sync failed', { error });
            }
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    if (navigator.onLine) {
        setTimeout(async () => {
            try {
                await hybridDataService.preloadCurrentSets();
            } catch (error) {
                uiLogger.error('Initial background sync failed', { error });
            }
        }, 5000);
    }
}

function startCleanupInterval() {
    if (cleanupInterval) clearInterval(cleanupInterval);
    
    cleanupInterval = setInterval(async () => {
        try {
            await dbService.cleanupExpiredPricingData();
        } catch (error) {
            uiLogger.error('Background cleanup failed', { error });
        }
    }, 12 * 60 * 60 * 1000); // 12 hours
    
    setTimeout(async () => {
        try {
            await dbService.cleanupExpiredPricingData();
        } catch (error) {
            uiLogger.error('Initial cleanup failed', { error });
        }
    }, 10000);
}

function startConfigUpdateInterval() {
    if (configUpdateInterval) clearInterval(configUpdateInterval);
    
    configUpdateInterval = setInterval(async () => {
        if (navigator.onLine) {
            try {
                await hybridDataService.updateCurrentSetsConfiguration();
            } catch (error) {
                uiLogger.error('Background config update failed', { error });
            }
        }
    }, 7 * 24 * 60 * 60 * 1000); // 7 days
    
    if (navigator.onLine) {
        setTimeout(async () => {
            try {
                await hybridDataService.updateCurrentSetsConfiguration();
            } catch (error) {
                uiLogger.error('Initial config update failed', { error });
            }
        }, 15000);
    }
}
