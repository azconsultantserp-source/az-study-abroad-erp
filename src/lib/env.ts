import { z } from "zod";
import { logger } from "@/lib/logger";

const PLACEHOLDER_SECRET = "change-me-to-a-random-secret-at-least-32-chars";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

let validated = false;

/** Validate critical env vars once at startup. Warns in dev, throws in production. */
export function assertEnv() {
  if (validated) return;
  validated = true;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join("; ");
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Environment validation failed: ${msg}`);
    }
    logger.warn("Environment validation warning", { issues: msg });
    return;
  }

  if (result.data.AUTH_SECRET === PLACEHOLDER_SECRET) {
    const msg = "AUTH_SECRET is still the placeholder — generate one with: openssl rand -base64 32";
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (process.env.NODE_ENV === "production" && !isBuildPhase) {
      throw new Error(msg);
    }
    logger.warn(msg);
  }
}
