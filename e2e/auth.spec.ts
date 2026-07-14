import { test, expect } from "@playwright/test";
import { login, ADMIN } from "./helpers";

test.describe("Authentication", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("password visibility toggle switches input type", async ({ page }) => {
    await page.goto("/login");
    const password = page.locator("#password");
    await password.fill("secret");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: /hide password/i }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("wrong@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.getByRole("button", { name: /sign in to portal/i }).click();

    // Scope to the form — Next.js also renders a route announcer with role="alert".
    await expect(page.locator("form").getByRole("alert")).toContainText(
      /invalid email or password/i,
      { timeout: 15_000 }
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs in with valid credentials and reaches the dashboard", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("protects the dashboard from anonymous access", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
