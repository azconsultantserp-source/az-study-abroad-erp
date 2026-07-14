import { chromium, type FullConfig } from "@playwright/test";

/**
 * Warm critical routes once before the parallel test run.
 * No login here — failed logins spam scary CredentialsSignin errors in the
 * terminal and can never abort the suite.
 */
async function globalSetup(config: FullConfig) {
  const baseURL =
    (config.projects[0]?.use?.baseURL as string | undefined) ??
    process.env.E2E_BASE_URL ??
    "http://localhost:3000";

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page
      .goto(`${baseURL}/api/health`, { waitUntil: "domcontentloaded", timeout: 120_000 })
      .catch(() => {});
    await page
      .goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 })
      .catch(() => {});
  } finally {
    await browser.close();
  }
}

export default globalSetup;
