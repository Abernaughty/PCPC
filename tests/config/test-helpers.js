// Shared testing helper functions
import { jest } from "@jest/globals";

/**
 * Test data factories for creating mock data
 */
export const testDataFactory = {
  // Create mock Pokemon set data
  createMockSet: (overrides = {}) => ({
    id: "base1",
    name: "Base Set",
    series: "Base",
    printedTotal: 102,
    total: 102,
    legalities: {
      unlimited: "Legal",
      expanded: "Legal",
    },
    ptcgoCode: "BS",
    releaseDate: "1999/01/09",
    updatedAt: "2022/10/10 15:12:00",
    images: {
      symbol: "https://images.pokemontcg.io/base1/symbol.png",
      logo: "https://images.pokemontcg.io/base1/logo.png",
    },
    ...overrides,
  }),

  // Create mock Pokemon card data
  createMockCard: (overrides = {}) => ({
    id: "base1-1",
    name: "Alakazam",
    supertype: "Pokémon",
    subtypes: ["Stage 2"],
    hp: "80",
    types: ["Psychic"],
    evolvesFrom: "Kadabra",
    attacks: [
      {
        name: "Confuse Ray",
        cost: ["Psychic", "Psychic", "Psychic"],
        convertedEnergyCost: 3,
        damage: "30",
        text: "Flip a coin. If heads, the Defending Pokémon is now Confused.",
      },
    ],
    weaknesses: [
      {
        type: "Psychic",
        value: "×2",
      },
    ],
    retreatCost: ["Colorless", "Colorless", "Colorless"],
    convertedRetreatCost: 3,
    set: {
      id: "base1",
      name: "Base Set",
      series: "Base",
      printedTotal: 102,
      total: 102,
      legalities: {
        unlimited: "Legal",
      },
      ptcgoCode: "BS",
      releaseDate: "1999/01/09",
      updatedAt: "2022/10/10 15:12:00",
      images: {
        symbol: "https://images.pokemontcg.io/base1/symbol.png",
        logo: "https://images.pokemontcg.io/base1/logo.png",
      },
    },
    number: "1",
    artist: "Ken Sugimori",
    rarity: "Rare Holo",
    flavorText:
      "Its brain can outperform a supercomputer. Its intelligence quotient is said to be 5,000.",
    nationalPokedexNumbers: [65],
    legalities: {
      unlimited: "Legal",
    },
    images: {
      small: "https://images.pokemontcg.io/base1/1.png",
      large: "https://images.pokemontcg.io/base1/1_hires.png",
    },
    tcgplayer: {
      url: "https://prices.pokemontcg.io/tcgplayer/base1-1",
      updatedAt: "2022/10/10",
      prices: {
        holofoil: {
          low: 15.0,
          mid: 25.0,
          high: 50.0,
          market: 22.5,
          directLow: null,
        },
      },
    },
    cardmarket: {
      url: "https://prices.pokemontcg.io/cardmarket/base1-1",
      updatedAt: "2022/10/10",
      prices: {
        averageSellPrice: 20.0,
        lowPrice: 12.0,
        trendPrice: 18.5,
        germanProLow: 0,
        suggestedPrice: 0,
        reverseHoloSell: 0,
        reverseHoloLow: 0,
        reverseHoloTrend: 0,
        lowPriceExPlus: 15.0,
        avg1: 18.0,
        avg7: 19.5,
        avg30: 21.0,
      },
    },
    ...overrides,
  }),

  // Create mock API response
  createMockApiResponse: (data, overrides = {}) => ({
    data: Array.isArray(data) ? data : [data],
    page: 1,
    pageSize: 250,
    count: Array.isArray(data) ? data.length : 1,
    totalCount: Array.isArray(data) ? data.length : 1,
    ...overrides,
  }),

  // Create mock pricing data
  createMockPricing: (overrides = {}) => ({
    cardId: "base1-1",
    prices: {
      tcgplayer: {
        holofoil: {
          low: 15.0,
          mid: 25.0,
          high: 50.0,
          market: 22.5,
        },
      },
      cardmarket: {
        averageSellPrice: 20.0,
        lowPrice: 12.0,
        trendPrice: 18.5,
      },
    },
    lastUpdated: new Date().toISOString(),
    ...overrides,
  }),
};

/**
 * Mock service factories
 */
export const mockServiceFactory = {
  // Create mock fetch responses
  createFetchMock: (responses = []) => {
    const mockFetch = jest.fn();

    responses.forEach((response, index) => {
      if (response instanceof Error) {
        mockFetch.mockRejectedValueOnce(response);
      } else {
        mockFetch.mockResolvedValueOnce({
          ok: response.ok !== false,
          status: response.status || 200,
          statusText: response.statusText || "OK",
          json: () => Promise.resolve(response.data || response),
          text: () =>
            Promise.resolve(JSON.stringify(response.data || response)),
        });
      }
    });

    return mockFetch;
  },

  // Create mock IndexedDB
  createIndexedDBMock: () => {
    const stores = new Map();

    return {
      open: jest.fn().mockImplementation((dbName, version) => {
        return Promise.resolve({
          transaction: jest.fn().mockImplementation((storeNames, mode) => {
            const transaction = {
              objectStore: jest.fn().mockImplementation((storeName) => {
                if (!stores.has(storeName)) {
                  stores.set(storeName, new Map());
                }

                const store = stores.get(storeName);

                return {
                  add: jest.fn().mockImplementation((value, key) => {
                    store.set(key || value.id, value);
                    return Promise.resolve();
                  }),
                  put: jest.fn().mockImplementation((value, key) => {
                    store.set(key || value.id, value);
                    return Promise.resolve();
                  }),
                  get: jest.fn().mockImplementation((key) => {
                    return Promise.resolve(store.get(key));
                  }),
                  getAll: jest.fn().mockImplementation(() => {
                    return Promise.resolve(Array.from(store.values()));
                  }),
                  delete: jest.fn().mockImplementation((key) => {
                    store.delete(key);
                    return Promise.resolve();
                  }),
                  clear: jest.fn().mockImplementation(() => {
                    store.clear();
                    return Promise.resolve();
                  }),
                  count: jest.fn().mockImplementation(() => {
                    return Promise.resolve(store.size);
                  }),
                };
              }),
            };
            return transaction;
          }),
        });
      }),
      deleteDatabase: jest.fn().mockResolvedValue(undefined),
    };
  },

  // Create mock localStorage
  createLocalStorageMock: () => {
    const store = new Map();

    return {
      getItem: jest.fn().mockImplementation((key) => store.get(key) || null),
      setItem: jest
        .fn()
        .mockImplementation((key, value) => store.set(key, value)),
      removeItem: jest.fn().mockImplementation((key) => store.delete(key)),
      clear: jest.fn().mockImplementation(() => store.clear()),
      get length() {
        return store.size;
      },
      key: jest.fn().mockImplementation((index) => {
        const keys = Array.from(store.keys());
        return keys[index] || null;
      }),
    };
  },
};

/**
 * Test assertion helpers
 */
export const testAssertions = {
  // Assert API call was made with correct parameters
  expectApiCall: (mockFetch, expectedUrl, expectedOptions = {}) => {
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(expectedUrl),
      expect.objectContaining(expectedOptions)
    );
  },

  // Assert component rendered with expected props
  expectComponentProps: (component, expectedProps) => {
    Object.entries(expectedProps).forEach(([key, value]) => {
      expect(component.props[key]).toEqual(value);
    });
  },

  // Assert error handling
  expectErrorHandling: async (asyncFunction, expectedError) => {
    await expect(asyncFunction()).rejects.toThrow(expectedError);
  },

  // Assert loading states
  expectLoadingState: (component, isLoading = true) => {
    if (isLoading) {
      expect(component.getByTestId("loading-spinner")).toBeInTheDocument();
    } else {
      expect(
        component.queryByTestId("loading-spinner")
      ).not.toBeInTheDocument();
    }
  },
};

/**
 * Test utilities for async operations
 */
export const asyncTestUtils = {
  // Wait for element to appear
  waitForElement: async (getByTestId, testId, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const element = getByTestId(testId);
        if (element) return element;
      } catch (error) {
        // Element not found yet, continue waiting
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      `Element with testId "${testId}" not found within ${timeout}ms`
    );
  },

  // Wait for condition to be true
  waitForCondition: async (condition, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Flush all promises
  flushPromises: () => new Promise((resolve) => setTimeout(resolve, 0)),
};

/**
 * Performance testing helpers
 */
export const performanceTestUtils = {
  // Measure function execution time
  measureExecutionTime: async (fn) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return {
      result,
      executionTime: end - start,
    };
  },

  // Create performance benchmark
  createBenchmark: (name, fn, iterations = 100) => {
    return async () => {
      const times = [];
      for (let i = 0; i < iterations; i++) {
        const { executionTime } =
          await performanceTestUtils.measureExecutionTime(fn);
        times.push(executionTime);
      }

      const average = times.reduce((sum, time) => sum + time, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);

      return {
        name,
        iterations,
        average,
        min,
        max,
        times,
      };
    };
  },
};

/**
 * Component testing helpers for Svelte
 */
export const svelteTestUtils = {
  // Create component with props
  createComponent: (Component, props = {}) => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const component = new Component({
      target,
      props,
    });

    return {
      component,
      target,
      destroy: () => {
        component.$destroy();
        document.body.removeChild(target);
      },
    };
  },

  // Trigger component event
  triggerEvent: (element, eventType, eventData = {}) => {
    const event = new CustomEvent(eventType, {
      detail: eventData,
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(event);
  },

  // Wait for component update
  waitForUpdate: (component) => {
    return new Promise((resolve) => {
      component.$$.after_update.push(resolve);
    });
  },
};

// Backend-specific test utilities
export const backendTestUtils = {
  // Create mock Azure Functions context
  createMockContext: (overrides = {}) => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    res: {
      status: 200,
      headers: {},
      body: null,
    },
    ...overrides,
  }),

  // Create mock Azure Functions request
  createMockRequest: (overrides = {}) => ({
    method: "GET",
    url: "/api/test",
    headers: {},
    query: {},
    params: {},
    body: null,
    ...overrides,
  }),
};

// Export all utilities
export default {
  testDataFactory,
  mockServiceFactory,
  testAssertions,
  asyncTestUtils,
  performanceTestUtils,
  svelteTestUtils,
  backendTestUtils,
};
