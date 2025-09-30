module.exports = {
  // Test environment
  testEnvironment: "jsdom",

  // Root directories for tests
  roots: [
    "<rootDir>/tests/frontend",
    "<rootDir>/tests/backend",
    "<rootDir>/app/frontend/src",
    "<rootDir>/app/backend/src",
  ],

  // Module file extensions
  moduleFileExtensions: ["js", "ts", "svelte", "json"],

  // Transform files
  transform: {
    "^.+\\.js$": "babel-jest",
    "^.+\\.ts$": "ts-jest",
    "^.+\\.svelte$": [
      "svelte-jester",
      {
        preprocess: true,
      },
    ],
  },

  // Module name mapping
  moduleNameMapper: {
    // Handle CSS imports
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",

    // Handle image imports
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/tests/config/__mocks__/fileMock.js",

    // Handle module aliases
    "^@/(.*)$": "<rootDir>/app/frontend/src/$1",
    "^@backend/(.*)$": "<rootDir>/app/backend/src/$1",
    "^@tests/(.*)$": "<rootDir>/tests/$1",
  },

  // Setup files
  setupFilesAfterEnv: ["<rootDir>/tests/config/test-setup.js"],

  // Test match patterns
  testMatch: [
    "<rootDir>/tests/**/*.test.{js,ts}",
    "<rootDir>/tests/**/*.spec.{js,ts}",
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/tests/e2e/",
    "<rootDir>/tests/performance/",
    "<rootDir>/tests/infrastructure/",
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: "<rootDir>/tests/coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],

  // Coverage collection patterns
  collectCoverageFrom: [
    "app/frontend/src/**/*.{js,ts,svelte}",
    "app/backend/src/**/*.{js,ts}",
    "!app/frontend/src/**/*.d.ts",
    "!app/backend/src/**/*.d.ts",
    "!app/frontend/src/main.js",
    "!app/backend/src/index.ts",
    "!**/__mocks__/**",
    "!**/node_modules/**",
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Specific thresholds for critical components
    "app/frontend/src/services/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "app/backend/src/services/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
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
