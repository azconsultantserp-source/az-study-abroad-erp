import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retry once even locally: the first login on a cold `next dev` + Neon cold
  // start can exceed the timeout; a retry hits warm routes and passes.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./e2e/global-setup.ts",
  // Assertions after login must tolerate first-request route compilation.
  expect: { timeout: 30_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reuse the dev server you already have on :3000; start one if none is running.
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
