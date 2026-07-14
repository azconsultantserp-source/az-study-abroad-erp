import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export class SecurityError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Allow only same-origin relative redirects after login.
 * Blocks open redirects like /login?callbackUrl=https://evil.com
 */
export function safeCallbackUrl(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("://") || raw.includes("\\")) return fallback;
  if (!/^\/[\w\-./%?=&]*$/.test(raw)) return fallback;
  return raw;
}

/** Allowed origins for state-changing API requests (CSRF defense-in-depth). */
function allowedOrigins(request: NextRequest): Set<string> {
  const host = request.headers.get("host");
  const origins = new Set<string>();
  if (host) {
    origins.add(`https://${host}`);
    origins.add(`http://${host}`);
  }
  const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");
  if (authUrl) origins.add(authUrl);
  return origins;
}

/**
 * Reject cross-site mutation requests. Same-origin browser fetch always sends
 * Origin; server-to-server callers must set a matching Origin or Referer.
 */
export function assertSameOrigin(request: NextRequest): void {
  const allowed = allowedOrigins(request);
  const origin = request.headers.get("origin");
  if (origin) {
    if (!allowed.has(origin)) throw new SecurityError("Forbidden", 403);
    return;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (!allowed.has(new URL(referer).origin)) throw new SecurityError("Forbidden", 403);
    } catch {
      throw new SecurityError("Forbidden", 403);
    }
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new SecurityError("Forbidden", 403);
  }
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Per-user + per-IP sliding window for sensitive mutations. */
export function enforceRateLimit(
  request: NextRequest,
  userId: string,
  action: string,
  limit = 60,
  windowMs = 60_000
): void {
  const key = `${action}:${userId}:${clientIp(request)}`;
  const result = rateLimit(key, limit, windowMs);
  if (!result.ok) {
    throw new SecurityError("Too many requests. Please wait and try again.", 429);
  }
}
