import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("loads the dashboard shell", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // Sidebar navigation should be present for staff.
    await expect(page.getByRole("link", { name: /dashboard/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /students/i }).first()).toBeVisible();
  });

  test("toggles dark mode", async ({ page }) => {
    const html = page.locator("html");
    const toggle = page.getByRole("button", { name: /switch to (dark|light) mode/i }).first();
    await toggle.click();
    await expect(html).toHaveClass(/dark/);
    await toggle.click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test("navigates to the students list", async ({ page }) => {
    await page.goto("/students/all");
    await expect(page).toHaveURL(/\/students\/all/);
  });
});
