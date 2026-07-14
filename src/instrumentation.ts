/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Validates critical environment variables early so a misconfigured
 * production deploy fails fast instead of at first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnv } = await import("@/lib/env");
    assertEnv();
  }
}
