import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import {
  safeCallbackUrl,
  assertSameOrigin,
  clientIp,
  enforceRateLimit,
  SecurityError,
} from "@/lib/security";

function req(headers: Record<string, string>, url = "http://localhost:3000/api/x") {
  return new NextRequest(url, { headers });
}

describe("safeCallbackUrl", () => {
  it("returns fallback for empty input", () => {
    expect(safeCallbackUrl(null)).toBe("/dashboard");
    expect(safeCallbackUrl(undefined)).toBe("/dashboard");
    expect(safeCallbackUrl("")).toBe("/dashboard");
  });

  it("accepts a same-origin relative path", () => {
    expect(safeCallbackUrl("/students/all")).toBe("/students/all");
    expect(safeCallbackUrl("/a?x=1&y=2")).toBe("/a?x=1&y=2");
  });

  it("blocks protocol-relative and absolute URLs (open redirect)", () => {
    expect(safeCallbackUrl("//evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("https://evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("http://evil.com")).toBe("/dashboard");
  });

  it("blocks backslash and scheme tricks", () => {
    expect(safeCallbackUrl("/\\evil.com")).toBe("/dashboard");
    expect(safeCallbackUrl("/foo://bar")).toBe("/dashboard");
  });

  it("blocks a relative path containing characters outside the safe set", () => {
    // Starts with "/", is not protocol-relative, has no scheme/backslash, but
    // fails the whitelist regex (space, hash) -> falls back.
    expect(safeCallbackUrl("/foo bar")).toBe("/dashboard");
    expect(safeCallbackUrl("/path#section")).toBe("/dashboard");
  });

  it("uses a custom fallback", () => {
    expect(safeCallbackUrl(null, "/home")).toBe("/home");
  });
});

describe("clientIp", () => {
  it("reads the first x-forwarded-for entry", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(req({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it('returns "unknown" when no ip headers present', () => {
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("assertSameOrigin", () => {
  it("allows a matching origin (AUTH_URL)", () => {
    expect(() => assertSameOrigin(req({ origin: "http://localhost:3000" }))).not.toThrow();
  });

  it("rejects a foreign origin", () => {
    expect(() => assertSameOrigin(req({ origin: "https://evil.com" }))).toThrow(SecurityError);
  });

  it("validates the referer origin when no origin header", () => {
    expect(() =>
      assertSameOrigin(req({ referer: "http://localhost:3000/login" }))
    ).not.toThrow();
    expect(() => assertSameOrigin(req({ referer: "https://evil.com/x" }))).toThrow(SecurityError);
  });

  it("rejects a malformed referer", () => {
    expect(() => assertSameOrigin(req({ referer: "notaurl" }))).toThrow(SecurityError);
  });

  it("allows requests with no origin/referer outside production", () => {
    expect(() => assertSameOrigin(req({}))).not.toThrow();
  });

  it("allows origin matching the Host header (http + https variants)", () => {
    expect(() =>
      assertSameOrigin(
        req({ origin: "https://localhost:3000", host: "localhost:3000" })
      )
    ).not.toThrow();
  });

  it("falls back to the Host header when AUTH_URL is unset", () => {
    const prev = process.env.AUTH_URL;
    delete process.env.AUTH_URL;
    try {
      expect(() =>
        assertSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))
      ).not.toThrow();
      expect(() =>
        assertSameOrigin(req({ origin: "https://evil.com", host: "localhost:3000" }))
      ).toThrow(SecurityError);
    } finally {
      process.env.AUTH_URL = prev;
    }
  });

  it("rejects requests with no origin/referer in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(() => assertSameOrigin(req({}))).toThrow(SecurityError);
    process.env.NODE_ENV = prev;
  });
});

describe("enforceRateLimit", () => {
  const original = process.env.NODE_ENV;
  beforeEach(() => {
    // fresh unique action keys per test avoid cross-test bucket sharing
  });
  afterAll(() => {
    process.env.NODE_ENV = original;
  });

  it("allows requests under the limit", () => {
    const r = req({ "x-forwarded-for": "10.0.0.1" });
    expect(() => enforceRateLimit(r, "user1", "act-under", 3, 60_000)).not.toThrow();
    expect(() => enforceRateLimit(r, "user1", "act-under", 3, 60_000)).not.toThrow();
  });

  it("throws 429 once the limit is exceeded", () => {
    const r = req({ "x-forwarded-for": "10.0.0.2" });
    const action = "act-over";
    enforceRateLimit(r, "user2", action, 2, 60_000);
    enforceRateLimit(r, "user2", action, 2, 60_000);
    try {
      enforceRateLimit(r, "user2", action, 2, 60_000);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(SecurityError);
      expect((e as SecurityError).status).toBe(429);
    }
  });
});
