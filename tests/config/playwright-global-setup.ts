import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  console.log("🚀 Starting Playwright global setup...");

  // Start browser for authentication if needed
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Perform any global authentication or setup here
  // For example, login to admin panel, set up test data, etc.

  // Example: Set up test environment variables
  process.env.PLAYWRIGHT_TEST_BASE_URL =
    process.env.BASE_URL || "http://localhost:3000";
  process.env.PLAYWRIGHT_API_BASE_URL =
    process.env.API_BASE_URL || "http://localhost:7071/api";

  // Example: Wait for services to be ready
  try {
    console.log("⏳ Waiting for frontend service...");
    await page.goto(process.env.PLAYWRIGHT_TEST_BASE_URL, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    console.log("✅ Frontend service is ready");

    console.log("⏳ Waiting for backend service...");
    const response = await page.request.get(
      `${process.env.PLAYWRIGHT_API_BASE_URL}/sets`
    );
    if (response.status() >= 200 && response.status() < 300) {
      console.log("✅ Backend service is ready");
    } else {
      console.log("⚠️ Backend service may not be ready, continuing anyway...");
    }
  } catch (error) {
    console.log(
      "⚠️ Service readiness check failed, continuing anyway...",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Clean up
  await context.close();
  await browser.close();

  console.log("✅ Playwright global setup completed");
}

export default globalSetup;
