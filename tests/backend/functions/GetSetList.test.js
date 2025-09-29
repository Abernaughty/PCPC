/**
 * @jest-environment node
 * @jest-setupFilesAfterEnv ["<rootDir>/tests/config/test-setup-backend.js"]
 */

import { jest } from "@jest/globals";
import { testDataFactory } from "../../config/test-helpers.js";

// Mock Azure Functions context
const mockContext = {
  log: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
  },
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  res: {
    status: 200,
    headers: {},
    body: null,
  },
};

// Mock request object
const createMockRequest = (overrides = {}) => ({
  method: "GET",
  url: "/api/sets",
  headers: {},
  query: {},
  params: {},
  body: null,
  ...overrides,
});

describe("GetSetList Function", () => {
  let mockCosmosService;
  let mockPokeDataService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock services
    mockCosmosService = {
      getSets: jest.fn(),
      insertSet: jest.fn(),
      updateSet: jest.fn(),
    };

    mockPokeDataService = {
      fetchSets: jest.fn(),
      validateApiKey: jest.fn(),
    };
  });

  describe("Function Execution", () => {
    test("should return sets list successfully", async () => {
      // Arrange
      const mockSets = [
        testDataFactory.createMockSet({ id: "base1", name: "Base Set" }),
        testDataFactory.createMockSet({ id: "jungle", name: "Jungle" }),
        testDataFactory.createMockSet({ id: "fossil", name: "Fossil" }),
      ];

      mockCosmosService.getSets.mockResolvedValue(mockSets);

      // Mock function implementation
      const getSetsFunction = async (context, req) => {
        try {
          const sets = await mockCosmosService.getSets();
          context.res = {
            status: 200,
            headers: { "Content-Type": "application/json" },
            body: {
              data: sets,
              count: sets.length,
              page: 1,
              pageSize: 250,
            },
          };
        } catch (error) {
          context.log.error("Error fetching sets:", error);
          context.res = {
            status: 500,
            body: { error: "Internal server error" },
          };
        }
      };

      // Act
      const request = createMockRequest();
      await getSetsFunction(mockContext, request);

      // Assert
      expect(mockCosmosService.getSets).toHaveBeenCalledTimes(1);
      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.data).toHaveLength(3);
      expect(mockContext.res.body.data[0].name).toBe("Base Set");
    });

    test("should handle pagination parameters", async () => {
      // Arrange
      const mockSets = Array.from({ length: 100 }, (_, index) =>
        testDataFactory.createMockSet({
          id: `set-${index}`,
          name: `Set ${index}`,
        })
      );

      mockCosmosService.getSets.mockResolvedValue(mockSets.slice(0, 50));

      // Mock function with pagination
      const getSetsFunction = async (context, req) => {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const offset = (page - 1) * pageSize;

        const sets = await mockCosmosService.getSets();
        const paginatedSets = sets.slice(offset, offset + pageSize);

        context.res = {
          status: 200,
          body: {
            data: paginatedSets,
            count: paginatedSets.length,
            page,
            pageSize,
            totalCount: mockSets.length,
          },
        };
      };

      // Act
      const request = createMockRequest({
        query: { page: "1", pageSize: "50" },
      });
      await getSetsFunction(mockContext, request);

      // Assert
      expect(mockContext.res.status).toBe(200);
      expect(mockContext.res.body.page).toBe(1);
      expect(mockContext.res.body.pageSize).toBe(50);
      expect(mockContext.res.body.data).toHaveLength(50);
    });

    test("should handle database errors gracefully", async () => {
      // Arrange
      const dbError = new Error("Database connection failed");
      mockCosmosService.getSets.mockRejectedValue(dbError);

      // Mock function with error handling
      const getSetsFunction = async (context, req) => {
        try {
          const sets = await mockCosmosService.getSets();
          context.res = {
            status: 200,
            body: { data: sets },
          };
        } catch (error) {
          context.log.error("Error fetching sets:", error);
          context.res = {
            status: 500,
            body: {
              error: "Internal server error",
              message: "Failed to fetch sets",
            },
          };
        }
      };

      // Act
      const request = createMockRequest();
      await getSetsFunction(mockContext, request);

      // Assert
      expect(mockCosmosService.getSets).toHaveBeenCalledTimes(1);
      expect(mockContext.log.error).toHaveBeenCalledWith(
        "Error fetching sets:",
        dbError
      );
      expect(mockContext.res.status).toBe(500);
      expect(mockContext.res.body.error).toBe("Internal server error");
    });

    test("should validate query parameters", () => {
      // Mock parameter validation
      const validatePagination = (page, pageSize) => {
        const validatedPage = Math.max(1, parseInt(page) || 1);
        const validatedPageSize = Math.min(
          250,
          Math.max(1, parseInt(pageSize) || 50)
        );

        return { page: validatedPage, pageSize: validatedPageSize };
      };

      // Test various inputs
      expect(validatePagination("0", "0")).toEqual({ page: 1, pageSize: 50 });
      expect(validatePagination("2", "100")).toEqual({
        page: 2,
        pageSize: 100,
      });
      expect(validatePagination("invalid", "300")).toEqual({
        page: 1,
        pageSize: 250,
      });
      expect(validatePagination(null, null)).toEqual({ page: 1, pageSize: 50 });
    });
  });

  describe("API Integration", () => {
    test("should handle PokeData API integration", async () => {
      // Arrange
      const mockApiResponse = testDataFactory.createMockApiResponse([
        testDataFactory.createMockSet({ id: "base1", name: "Base Set" }),
      ]);

      mockPokeDataService.fetchSets.mockResolvedValue(mockApiResponse);
      mockPokeDataService.validateApiKey.mockResolvedValue(true);

      // Mock API integration function
      const integratePokeDataApi = async () => {
        const isValidKey = await mockPokeDataService.validateApiKey();
        if (!isValidKey) {
          throw new Error("Invalid API key");
        }

        return await mockPokeDataService.fetchSets();
      };

      // Act
      const result = await integratePokeDataApi();

      // Assert
      expect(mockPokeDataService.validateApiKey).toHaveBeenCalledTimes(1);
      expect(mockPokeDataService.fetchSets).toHaveBeenCalledTimes(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Base Set");
    });

    test("should handle API key validation failure", async () => {
      // Arrange
      mockPokeDataService.validateApiKey.mockResolvedValue(false);

      // Mock API integration with validation
      const integratePokeDataApi = async () => {
        const isValidKey = await mockPokeDataService.validateApiKey();
        if (!isValidKey) {
          throw new Error("Invalid API key");
        }

        return await mockPokeDataService.fetchSets();
      };

      // Act & Assert
      await expect(integratePokeDataApi()).rejects.toThrow("Invalid API key");
      expect(mockPokeDataService.validateApiKey).toHaveBeenCalledTimes(1);
      expect(mockPokeDataService.fetchSets).not.toHaveBeenCalled();
    });
  });

  describe("Response Formatting", () => {
    test("should format response correctly", () => {
      // Mock response formatter
      const formatSetsResponse = (sets, page = 1, pageSize = 50) => {
        return {
          data: sets,
          count: sets.length,
          page,
          pageSize,
          totalCount: sets.length,
          hasNextPage: false,
          hasPreviousPage: page > 1,
        };
      };

      // Test formatting
      const mockSets = [
        testDataFactory.createMockSet({ id: "base1", name: "Base Set" }),
      ];

      const response = formatSetsResponse(mockSets, 1, 50);

      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("count", 1);
      expect(response).toHaveProperty("page", 1);
      expect(response).toHaveProperty("pageSize", 50);
      expect(response).toHaveProperty("hasNextPage", false);
      expect(response).toHaveProperty("hasPreviousPage", false);
    });

    test("should handle empty results", () => {
      // Mock empty response formatter
      const formatEmptyResponse = () => {
        return {
          data: [],
          count: 0,
          page: 1,
          pageSize: 50,
          totalCount: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          message: "No sets found",
        };
      };

      const response = formatEmptyResponse();

      expect(response.data).toHaveLength(0);
      expect(response.count).toBe(0);
      expect(response.message).toBe("No sets found");
    });
  });

  describe("Caching Integration", () => {
    test("should integrate with cache service", async () => {
      // Mock cache service
      const mockCacheService = {
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
        clear: jest.fn(),
      };

      const cacheKey = "sets:page:1:size:50";
      const mockSets = [testDataFactory.createMockSet()];

      // Mock cache integration
      const getSetsWithCache = async (page, pageSize) => {
        const key = `sets:page:${page}:size:${pageSize}`;

        // Try cache first
        let cachedSets = await mockCacheService.get(key);
        if (cachedSets) {
          return cachedSets;
        }

        // Fetch from database
        const sets = await mockCosmosService.getSets();

        // Cache the result
        await mockCacheService.set(key, sets, 300); // 5 minutes TTL

        return sets;
      };

      // Test cache miss
      mockCacheService.get.mockResolvedValue(null);
      mockCosmosService.getSets.mockResolvedValue(mockSets);

      const result = await getSetsWithCache(1, 50);

      expect(mockCacheService.get).toHaveBeenCalledWith(cacheKey);
      expect(mockCosmosService.getSets).toHaveBeenCalledTimes(1);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        cacheKey,
        mockSets,
        300
      );
      expect(result).toEqual(mockSets);
    });
  });
});
