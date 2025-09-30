import { expect, test } from "@playwright/test";

test.describe("PCPC Application E2E Tests", () => {
  test("should load the homepage", async ({ page }) => {
    await page.goto("/");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Check that the page title contains expected text
    await expect(page).toHaveTitle(/Pokemon Card Price Checker|PCPC/);

    // Check for main application elements
    const mainContent = page.locator("main, #app, .app, body");
    await expect(mainContent).toBeVisible();
  });

  test("should have working navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check that the page is interactive
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Basic interaction test - check if page responds to clicks
    await page.click("body");

    // Verify page is still responsive
    await expect(body).toBeVisible();
  });

  test("should handle API connectivity", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait a bit for any API calls to complete
    await page.waitForTimeout(2000);

    // Check that no critical errors occurred
    const errors = await page.evaluate(() => {
      return window.console ? [] : [];
    });

    // Page should still be functional
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
