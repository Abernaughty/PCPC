import { FullConfig } from "@playwright/test";

async function globalTeardown(config: FullConfig) {
  console.log("🧹 Starting Playwright global teardown...");

  // Perform any global cleanup here
  // For example, clean up test data, close connections, etc.

  try {
    // Example: Clean up test data
    console.log("🗑️ Cleaning up test data...");

    // Example: Reset test environment
    console.log("🔄 Resetting test environment...");

    // Example: Close any persistent connections
    console.log("🔌 Closing connections...");
  } catch (error) {
    console.log("⚠️ Teardown warning:", (error as Error).message);
  }

  console.log("✅ Playwright global teardown completed");
}

export default globalTeardown;
