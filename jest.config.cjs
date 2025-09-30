module.exports = {
  // Use projects for different test environments
  projects: [
    // Frontend tests (jsdom environment)
    {
      displayName: "frontend",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/frontend/**/*.test.{js,ts}"],
      setupFilesAfterEnv: ["<rootDir>/tests/config/test-setup.js"],
      moduleFileExtensions: ["js", "ts", "svelte", "json"],
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
      moduleNameMapper: {
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
        "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
          "<rootDir>/tests/config/__mocks__/fileMock.js",
        "^@/(.*)$": "<rootDir>/app/frontend/src/$1",
        "^@tests/(.*)$": "<rootDir>/tests/$1",
      },
    },
    // Backend tests (node environment)
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
        "^@backend/(.*)$": "<rootDir>/app/backend/src/$1",
        "^@tests/(.*)$": "<rootDir>/tests/$1",
      },
    },
  ],

  // Global configuration
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
