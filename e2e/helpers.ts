import { Page, expect } from "@playwright/test";

/**
 * Seeded staff credentials (see prisma/seed.ts). Override via env for CI.
 */
export const ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL ?? "managingdirector@azconsultants.com",
  password: process.env.E2E_ADMIN_PASSWORD ?? "azc@2026",
};

export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  // Retry the whole flow once: a cold first login can land back on /login before
  // routes are compiled. The second attempt hits warm routes and succeeds.
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /sign in to portal/i }).click();
    try {
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
      return;
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
}
