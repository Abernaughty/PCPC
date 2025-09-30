// Backend-specific test setup for Jest (Node.js environment)
import { jest } from "@jest/globals";

// Mock environment variables for backend
process.env.NODE_ENV = "test";
process.env.AzureWebJobsStorage = "UseDevelopmentStorage=true";
process.env.COSMOS_DB_CONNECTION_STRING =
  "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==;";
process.env.POKEDATA_API_KEY = "test-api-key";
process.env.POKEMON_TCG_API_KEY = "test-tcg-api-key";
process.env.REDIS_CACHE_ENABLED = "false";

// Mock fetch globally for Node.js
global.fetch = jest.fn();

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

  // Reset fetch mock
  if (global.fetch && global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// Backend-specific test utilities
const backendTestUtils = {
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

  // Mock Azure Functions context
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

  // Mock Azure Functions request
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

// Make backendTestUtils available globally
global.backendTestUtils = backendTestUtils;

// Export for use in tests
export { backendTestUtils };
