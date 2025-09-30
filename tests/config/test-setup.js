// Global test setup for Jest
import "@testing-library/jest-dom";

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.VITE_API_BASE_URL = "http://localhost:7071/api";
process.env.VITE_POKEDATA_API_KEY = "test-api-key";
process.env.VITE_POKEMON_TCG_API_KEY = "test-tcg-api-key";

// Mock IndexedDB for browser storage tests
import "fake-indexeddb/auto";

// Mock fetch globally
import { jest } from "@jest/globals";

global.fetch = jest.fn();

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock window.ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to suppress console.log in tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Setup test timeout
jest.setTimeout(10000);

// Clean up after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Clear localStorage
  localStorage.clear();
  sessionStorage.clear();

  // Reset fetch mock
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// Global test utilities
const testUtils = {
  // Wait for async operations
  waitFor: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Create mock API response
  mockApiResponse: (data, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  }),

  // Create mock error response
  mockApiError: (message = "API Error", status = 500) => ({
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.reject(new Error(message)),
    text: () => Promise.reject(new Error(message)),
  }),

  // Mock IndexedDB operations
  mockIndexedDB: {
    clear: () => {
      // Clear all IndexedDB stores
      if (global.indexedDB && global.indexedDB.databases) {
        return global.indexedDB.databases().then((databases) => {
          return Promise.all(
            databases.map((db) => {
              const deleteReq = global.indexedDB.deleteDatabase(db.name);
              return new Promise((resolve, reject) => {
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
              });
            })
          );
        });
      }
      return Promise.resolve();
    },
  },
};

// Make testUtils available globally
global.testUtils = testUtils;

// Export for use in tests
export { testUtils };
