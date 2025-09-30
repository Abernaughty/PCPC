import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: path.resolve(__dirname, "../e2e"),

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    [
      "html",
      { outputFolder: path.resolve(__dirname, "../reports/playwright-report") },
    ],
    [
      "json",
      {
        outputFile: path.resolve(
          __dirname,
          "../reports/playwright-results.json"
        ),
      },
    ],
    [
      "junit",
      {
        outputFile: path.resolve(__dirname, "../reports/playwright-junit.xml"),
      },
    ],
    ["line"],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || "http://localhost:3000",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Record video on failure
    video: "retain-on-failure",

    // Take screenshot on failure
    screenshot: "only-on-failure",

    // Global test timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Accept downloads
    acceptDownloads: true,

    // Locale
    locale: "en-US",

    // Timezone
    timezoneId: "America/Denver",

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // User agent
    userAgent: "PCPC-E2E-Tests/1.0",
  },

  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },

    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },

    // Test against mobile viewports
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },

    // Test against branded browsers
    {
      name: "Microsoft Edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "Google Chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  // Global setup and teardown (using path.resolve instead of require.resolve)
  globalSetup: path.resolve(__dirname, "./playwright-global-setup.ts"),
  globalTeardown: path.resolve(__dirname, "./playwright-global-teardown.ts"),

  // Run your local dev server before starting the tests
  webServer: [
    {
      command: "npm run dev",
      cwd: path.resolve(__dirname, "../../app/frontend"),
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: "test",
      },
    },
    {
      command: "npm start",
      cwd: path.resolve(__dirname, "../../app/backend"),
      port: 7071,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        NODE_ENV: "test",
        AzureWebJobsStorage: "UseDevelopmentStorage=true",
        COSMOS_DB_CONNECTION_STRING:
          "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==;",
      },
    },
  ],

  // Test timeout
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Output directory
  outputDir: path.resolve(__dirname, "../reports/test-results"),
});
