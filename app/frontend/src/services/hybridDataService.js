import { cloudDataService } from "./cloudDataService";
import { featureFlagService } from "./featureFlagService";
import { monitoringService } from "./monitoringService";
import { pokeDataService } from "./pokeDataService";

/**
 * Hybrid service that can use either local or cloud implementation
 * based on feature flags
 */
export const hybridDataService = {
  /**
   * Get the list of all Pokémon card sets
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Array>} Array of set objects
   */
  async getSetList(forceRefresh = true) {
    const timer = monitoringService.startTimer();
    const useCloud = featureFlagService.useCloudApi();

    // Track routing decision
    monitoringService.trackEvent("hybridDataService.getSetList.started", {
      forceRefresh,
      routedTo: useCloud ? "cloud" : "local",
    });

    try {
      let result;
      if (useCloud) {
        result = await cloudDataService.getSetList(forceRefresh, true);

        // Track cloud delegation success
        monitoringService.trackEvent(
          "hybridDataService.getSetList.cloud.success",
          {
            setCount: result?.length || 0,
            forceRefresh,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getSetList.cloud.duration",
          timer()
        );
      } else {
        result = await pokeDataService.getSetList(forceRefresh);

        // Track local delegation success
        monitoringService.trackEvent(
          "hybridDataService.getSetList.local.success",
          {
            setCount: result?.length || 0,
            forceRefresh,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getSetList.local.duration",
          timer()
        );
      }

      // Track overall success
      monitoringService.trackEvent("hybridDataService.getSetList.success", {
        setCount: result?.length || 0,
        routedTo: useCloud ? "cloud" : "local",
        duration: timer(),
      });

      return result;
    } catch (error) {
      // Track delegation failure
      monitoringService.trackEvent("hybridDataService.getSetList.error", {
        routedTo: useCloud ? "cloud" : "local",
        error: error.message,
        duration: timer(),
      });
      monitoringService.trackException(error, {
        method: "getSetList",
        routedTo: useCloud ? "cloud" : "local",
        forceRefresh,
      });
      throw error;
    }
  },

  /**
   * Get cards for a specific set
   * @param {string} setCode - The set code
   * @param {string} setId - The set ID
   * @returns {Promise<Array>} Array of card objects
   */
  async getCardsForSet(setCode, setId) {
    const timer = monitoringService.startTimer();
    const useCloud = featureFlagService.useCloudApi();

    // Track routing decision
    monitoringService.trackEvent("hybridDataService.getCardsForSet.started", {
      setCode,
      setId,
      routedTo: useCloud ? "cloud" : "local",
    });

    try {
      let result;
      if (useCloud) {
        // Use setId for PokeData-first backend, fallback to setCode if setId not available
        const identifier = setId || setCode;
        const cloudResult = await cloudDataService.getCardsForSet(identifier);
        result = cloudResult.items || [];

        // Track cloud delegation success
        monitoringService.trackEvent(
          "hybridDataService.getCardsForSet.cloud.success",
          {
            identifier,
            cardCount: result.length,
            hasItems: !!cloudResult.items,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getCardsForSet.cloud.duration",
          timer()
        );
      } else {
        result = await pokeDataService.getCardsForSet(setCode, setId);

        // Track local delegation success
        monitoringService.trackEvent(
          "hybridDataService.getCardsForSet.local.success",
          {
            setCode,
            setId,
            cardCount: result?.length || 0,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getCardsForSet.local.duration",
          timer()
        );
      }

      // Track overall success
      monitoringService.trackEvent("hybridDataService.getCardsForSet.success", {
        cardCount: result?.length || 0,
        routedTo: useCloud ? "cloud" : "local",
        duration: timer(),
      });

      return result;
    } catch (error) {
      // Track delegation failure
      monitoringService.trackEvent("hybridDataService.getCardsForSet.error", {
        setCode,
        setId,
        routedTo: useCloud ? "cloud" : "local",
        error: error.message,
        duration: timer(),
      });
      monitoringService.trackException(error, {
        method: "getCardsForSet",
        setCode,
        setId,
        routedTo: useCloud ? "cloud" : "local",
      });
      throw error;
    }
  },

  /**
   * Get pricing data for a specific card
   * @param {string} cardId - The card ID
   * @returns {Promise<Object>} Card pricing data
   */
  async getCardPricing(cardId, setId) {
    const timer = monitoringService.startTimer();
    const useCloud = featureFlagService.useCloudApi();

    // Track routing decision
    monitoringService.trackEvent("hybridDataService.getCardPricing.started", {
      cardId,
      setId,
      routedTo: useCloud ? "cloud" : "local",
    });

    try {
      let result;
      if (useCloud) {
        result = await cloudDataService.getCardPricing(cardId, setId);

        // Track cloud delegation success
        monitoringService.trackEvent(
          "hybridDataService.getCardPricing.cloud.success",
          {
            cardId,
            setId,
            hasPricing: !!result && Object.keys(result).length > 0,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getCardPricing.cloud.duration",
          timer()
        );
      } else {
        result = await pokeDataService.getCardPricing(cardId);

        // Track local delegation success
        monitoringService.trackEvent(
          "hybridDataService.getCardPricing.local.success",
          {
            cardId,
            hasPricing: !!result && Object.keys(result).length > 0,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getCardPricing.local.duration",
          timer()
        );
      }

      // Track overall success
      monitoringService.trackEvent("hybridDataService.getCardPricing.success", {
        cardId,
        routedTo: useCloud ? "cloud" : "local",
        hasPricing: !!result && Object.keys(result).length > 0,
        duration: timer(),
      });

      return result;
    } catch (error) {
      // Track delegation failure
      monitoringService.trackEvent("hybridDataService.getCardPricing.error", {
        cardId,
        setId,
        routedTo: useCloud ? "cloud" : "local",
        error: error.message,
        duration: timer(),
      });
      monitoringService.trackException(error, {
        method: "getCardPricing",
        cardId,
        setId,
        routedTo: useCloud ? "cloud" : "local",
      });
      throw error;
    }
  },

  /**
   * Get pricing data for a specific card with metadata
   * @param {string} cardId - The card ID
   * @param {boolean} forceRefresh - Whether to force a refresh from the API
   * @returns {Promise<Object>} Card pricing data with metadata
   */
  async getCardPricingWithMetadata(cardId, setId, forceRefresh = true) {
    const timer = monitoringService.startTimer();
    const useCloud = featureFlagService.useCloudApi();

    // Track routing decision
    monitoringService.trackEvent(
      "hybridDataService.getCardPricingWithMetadata.started",
      {
        cardId,
        setId,
        forceRefresh,
        routedTo: useCloud ? "cloud" : "local",
      }
    );

    try {
      let result;
      if (useCloud) {
        result = await cloudDataService.getCardPricingWithMetadata(
          cardId,
          setId,
          forceRefresh
        );

        // Track cloud delegation success with metadata
        monitoringService.trackEvent(
          "hybridDataService.getCardPricingWithMetadata.cloud.success",
          {
            cardId,
            setId,
            forceRefresh,
            hasPricing:
              !!result?.pricing && Object.keys(result.pricing).length > 0,
            hasMetadata: !!result?.metadata,
            isStale: result?.metadata?.isStale || false,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getCardPricingWithMetadata.cloud.duration",
          timer()
        );
      } else {
        result = await pokeDataService.getCardPricingWithMetadata(
          cardId,
          forceRefresh
        );

        // Track local delegation success with metadata
        monitoringService.trackEvent(
          "hybridDataService.getCardPricingWithMetadata.local.success",
          {
            cardId,
            forceRefresh,
            hasPricing:
              !!result?.pricing && Object.keys(result.pricing).length > 0,
            hasMetadata: !!result?.metadata,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.getCardPricingWithMetadata.local.duration",
          timer()
        );
      }

      // Track overall success
      monitoringService.trackEvent(
        "hybridDataService.getCardPricingWithMetadata.success",
        {
          cardId,
          routedTo: useCloud ? "cloud" : "local",
          hasPricing:
            !!result?.pricing && Object.keys(result.pricing).length > 0,
          hasMetadata: !!result?.metadata,
          duration: timer(),
        }
      );

      return result;
    } catch (error) {
      // Track delegation failure
      monitoringService.trackEvent(
        "hybridDataService.getCardPricingWithMetadata.error",
        {
          cardId,
          setId,
          forceRefresh,
          routedTo: useCloud ? "cloud" : "local",
          error: error.message,
          duration: timer(),
        }
      );
      monitoringService.trackException(error, {
        method: "getCardPricingWithMetadata",
        cardId,
        setId,
        forceRefresh,
        routedTo: useCloud ? "cloud" : "local",
      });
      throw error;
    }
  },

  /**
   * Preload current sets data
   * @returns {Promise<boolean>} True if successful
   */
  async preloadCurrentSets() {
    const timer = monitoringService.startTimer();
    const useCloud = featureFlagService.useCloudApi();

    // Track routing decision
    monitoringService.trackEvent(
      "hybridDataService.preloadCurrentSets.started",
      {
        routedTo: useCloud ? "cloud" : "local",
      }
    );

    try {
      let result;
      if (useCloud) {
        result = true; // Cloud API does not require preloading

        // Track cloud skip (no preload needed)
        monitoringService.trackEvent(
          "hybridDataService.preloadCurrentSets.cloud.skipped",
          {
            reason: "cloud_api_no_preload_required",
          }
        );
      } else {
        result = await pokeDataService.preloadCurrentSets();

        // Track local preload success
        monitoringService.trackEvent(
          "hybridDataService.preloadCurrentSets.local.success",
          {
            result,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.preloadCurrentSets.local.duration",
          timer()
        );
      }

      // Track overall success
      monitoringService.trackEvent(
        "hybridDataService.preloadCurrentSets.success",
        {
          routedTo: useCloud ? "cloud" : "local",
          result,
          duration: timer(),
        }
      );

      return result;
    } catch (error) {
      // Track preload failure
      monitoringService.trackEvent(
        "hybridDataService.preloadCurrentSets.error",
        {
          routedTo: useCloud ? "cloud" : "local",
          error: error.message,
          duration: timer(),
        }
      );
      monitoringService.trackException(error, {
        method: "preloadCurrentSets",
        routedTo: useCloud ? "cloud" : "local",
      });
      throw error;
    }
  },

  /**
   * Update current sets configuration
   * @returns {Promise<boolean>} True if successful
   */
  async updateCurrentSetsConfiguration() {
    const timer = monitoringService.startTimer();
    const useCloud = featureFlagService.useCloudApi();

    // Track routing decision
    monitoringService.trackEvent(
      "hybridDataService.updateCurrentSetsConfiguration.started",
      {
        routedTo: useCloud ? "cloud" : "local",
      }
    );

    try {
      let result;
      if (useCloud) {
        result = true; // Cloud API does not require updating configuration

        // Track cloud skip (no config update needed)
        monitoringService.trackEvent(
          "hybridDataService.updateCurrentSetsConfiguration.cloud.skipped",
          {
            reason: "cloud_api_no_config_update_required",
          }
        );
      } else {
        result = await pokeDataService.updateCurrentSetsConfiguration();

        // Track local config update success
        monitoringService.trackEvent(
          "hybridDataService.updateCurrentSetsConfiguration.local.success",
          {
            result,
          }
        );
        monitoringService.trackMetric(
          "hybridDataService.updateCurrentSetsConfiguration.local.duration",
          timer()
        );
      }

      // Track overall success
      monitoringService.trackEvent(
        "hybridDataService.updateCurrentSetsConfiguration.success",
        {
          routedTo: useCloud ? "cloud" : "local",
          result,
          duration: timer(),
        }
      );

      return result;
    } catch (error) {
      // Track config update failure
      monitoringService.trackEvent(
        "hybridDataService.updateCurrentSetsConfiguration.error",
        {
          routedTo: useCloud ? "cloud" : "local",
          error: error.message,
          duration: timer(),
        }
      );
      monitoringService.trackException(error, {
        method: "updateCurrentSetsConfiguration",
        routedTo: useCloud ? "cloud" : "local",
      });
      throw error;
    }
  },
};
