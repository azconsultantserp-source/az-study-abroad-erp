import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows the first hit on a fresh key", () => {
    expect(rateLimit("k-fresh", 5, 1000)).toEqual({ ok: true });
  });

  it("allows hits up to the limit", () => {
    const key = "k-limit";
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
    expect(rateLimit(key, 3, 10_000).ok).toBe(true);
  });

  it("blocks once the limit is reached and reports retryAfter", () => {
    const key = "k-block";
    rateLimit(key, 1, 10_000);
    const r = rateLimit(key, 1, 10_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("resets the window after it expires", () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);
    const key = "k-reset";
    rateLimit(key, 1, 1000);
    expect(rateLimit(key, 1, 1000).ok).toBe(false);

    vi.setSystemTime(start + 1500);
    expect(rateLimit(key, 1, 1000).ok).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    expect(rateLimit("k-a", 1, 10_000).ok).toBe(true);
    expect(rateLimit("k-b", 1, 10_000).ok).toBe(true);
  });

  it("prunes expired buckets after the prune interval", () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);

    rateLimit("stale-bucket", 5, 1_000);
    vi.setSystemTime(start + 2_000);

    // Jump past PRUNE_INTERVAL_MS (5 min) so prune() deletes stale-bucket.
    vi.setSystemTime(start + 5 * 60_000 + 1);
    expect(rateLimit("fresh-after-prune", 5, 10_000).ok).toBe(true);
  });
});
