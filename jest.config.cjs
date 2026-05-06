module.exports = {
  // Use projects for different test environments
  projects: [
    // Backend tests (node environment)
    // Frontend tests removed alongside the legacy app/frontend SPA — the new
    // SvelteKit frontend at frontend/ uses Vitest and is configured there.
    {
      displayName: "backend",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/backend/**/*.test.{js,ts}"],
      setupFilesAfterEnv: ["<rootDir>/tests/config/test-setup-backend.js"],
      moduleFileExtensions: ["js", "ts", "json"],
      transform: {
        "^.+\\.js$": "babel-jest",
        "^.+\\.ts$": "ts-jest",
      },
      moduleNameMapper: {
        "^@backend/(.*)$": "<rootDir>/backend/functions/src/$1",
        "^@tests/(.*)$": "<rootDir>/tests/$1",
      },
      collectCoverageFrom: [
        "backend/functions/src/**/*.{js,ts}",
        "!backend/functions/src/**/*.d.ts",
        "!backend/functions/src/index.ts",
        "!**/__mocks__/**",
        "!**/node_modules/**",
      ],
    },
  ],

  // Global configuration
  collectCoverage: true,
  coverageDirectory: "<rootDir>/tests/coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],

  // Note: Coverage patterns moved to individual projects to avoid cross-contamination

  // Coverage thresholds (relaxed for initial implementation)
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Error on deprecated features
  errorOnDeprecated: true,

  // Globals
  globals: {
    "ts-jest": {
      useESM: true,
      tsconfig: {
        target: "es2022",
        module: "esnext",
        moduleResolution: "node",
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    },
  },

  // ESM support
  extensionsToTreatAsEsm: [".ts"],

  // Watch plugins
  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname",
  ],

  // Reporters
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "<rootDir>/tests/reports",
        outputName: "junit.xml",
        classNameTemplate: "{classname}",
        titleTemplate: "{title}",
        ancestorSeparator: " › ",
        usePathForSuiteName: true,
      },
    ],
  ],

  // Max workers for parallel execution
  maxWorkers: "50%",

  // Cache directory
  cacheDirectory: "<rootDir>/node_modules/.cache/jest",
};
