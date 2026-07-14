/**
 * In-memory sliding-window rate limiter.
 *
 * Suitable for a single-instance VPS or as a first line of defense on
 * serverless (per-instance). For multi-instance production at scale, swap
 * the store for Redis / Upstash.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Prune stale entries periodically to avoid unbounded memory growth.
const PRUNE_INTERVAL_MS = 5 * 60_000;
let lastPrune = Date.now();

function prune(now: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }

  existing.count++;
  return { ok: true };
}
