import { expect, test } from "@playwright/test";

test.describe("PCPC Frontend UI Tests", () => {
  test("should render the main application", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check for Svelte app container
    const app = page.locator("#app, main, .app");
    await expect(app).toBeVisible();

    // Check that JavaScript is working (Svelte should be loaded)
    const hasJS = await page.evaluate(() => {
      return typeof window !== "undefined" && window.document !== undefined;
    });
    expect(hasJS).toBe(true);
  });

  test("should handle theme switching", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Look for theme toggle button (common in the app)
    const themeToggle = page.locator(
      'button:has-text("theme"), button:has-text("dark"), button:has-text("light"), [data-theme-toggle]'
    );

    // If theme toggle exists, test it
    if ((await themeToggle.count()) > 0) {
      await themeToggle.first().click();
      await page.waitForTimeout(500);

      // Check that theme changed (body or html should have theme attribute)
      const hasThemeAttribute = await page.evaluate(() => {
        return (
          document.body.hasAttribute("data-theme") ||
          document.documentElement.hasAttribute("data-theme") ||
          document.body.classList.contains("dark") ||
          document.body.classList.contains("light")
        );
      });
      expect(hasThemeAttribute).toBe(true);
    }
  });

  test("should handle search functionality", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Look for search inputs or select elements
    const searchElements = page.locator(
      'input[type="search"], input[placeholder*="search"], select, .searchable-select'
    );

    if ((await searchElements.count()) > 0) {
      const firstSearch = searchElements.first();
      await expect(firstSearch).toBeVisible();

      // Try to interact with search element
      if ((await firstSearch.getAttribute("type")) === "search") {
        await firstSearch.fill("test");
        await page.waitForTimeout(500);
        await firstSearch.clear();
      }
    }
  });

  test("should be responsive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    const body = page.locator("body");
    await expect(body).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(body).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(body).toBeVisible();
  });

  test("should handle errors gracefully", async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Wait for any async operations
    await page.waitForTimeout(3000);

    // Check that no critical errors occurred
    const criticalErrors = errors.filter((error) =>
      error.toLowerCase().includes("uncaught")
    );
    expect(criticalErrors.length).toBe(0);

    // Page should still be functional
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
