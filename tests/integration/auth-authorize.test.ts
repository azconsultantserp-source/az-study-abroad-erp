import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Capture the config passed to NextAuth so we can exercise the Credentials
// provider's `authorize` in isolation (env-driven rate limit + credential check)
// without booting the real NextAuth/Prisma runtime.
const h = vi.hoisted(() => ({
  config: undefined as { providers: Array<{ authorize: AuthorizeFn }> } | undefined,
  findUnique: vi.fn(),
  rateLimit: vi.fn(() => ({ ok: true }) as { ok: boolean; retryAfter?: number }),
  compare: vi.fn(async () => true),
}));

type AuthorizeFn = (
  credentials: Record<string, unknown> | undefined
) => Promise<{ id: string; role: string } | null>;

vi.mock("next-auth", () => ({
  default: (config: { providers: Array<{ authorize: AuthorizeFn }> }) => {
    h.config = config;
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() };
  },
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: (opts: { authorize: AuthorizeFn }) => ({ ...opts, id: "credentials" }),
}));

vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));

vi.mock("@/lib/db", () => ({ default: { user: { findUnique: h.findUnique } } }));

vi.mock("bcryptjs", () => ({ default: { compare: h.compare } }));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: h.rateLimit }));

import "@/lib/auth";

const ORIG_NODE_ENV = process.env.NODE_ENV;
const ORIG_LIMIT = process.env.LOGIN_RATE_LIMIT;

function authorize(credentials: Record<string, unknown> | undefined) {
  if (!h.config) throw new Error("NextAuth config was not captured");
  return h.config.providers[0].authorize(credentials);
}

const ACTIVE_USER = {
  id: "u1",
  name: "User",
  email: "user@example.com",
  passwordHash: "hash",
  isActive: true,
  role: "ADMIN",
};

beforeEach(() => {
  h.findUnique.mockReset();
  h.rateLimit.mockReset().mockReturnValue({ ok: true });
  h.compare.mockReset().mockResolvedValue(true);
  delete process.env.LOGIN_RATE_LIMIT;
});

afterAll(() => {
  process.env.NODE_ENV = ORIG_NODE_ENV;
  if (ORIG_LIMIT === undefined) delete process.env.LOGIN_RATE_LIMIT;
  else process.env.LOGIN_RATE_LIMIT = ORIG_LIMIT;
});

describe("auth authorize() rate-limit env logic", () => {
  it("skips throttling entirely outside production (no env override)", async () => {
    process.env.NODE_ENV = "test";
    h.findUnique.mockResolvedValue(ACTIVE_USER);

    const user = await authorize({ email: "  User@Example.com ", password: "secret1" });

    // Login still succeeds and the limiter is never consulted in dev/test.
    expect(user).toMatchObject({ id: "u1", role: "ADMIN" });
    expect(h.rateLimit).not.toHaveBeenCalled();
  });

  it("uses the strict limit of 8 in production", async () => {
    process.env.NODE_ENV = "production";
    h.findUnique.mockResolvedValue(ACTIVE_USER);

    await authorize({ email: "user@example.com", password: "secret1" });

    // Email is normalized (lowercased + trimmed) before keying the limiter.
    expect(h.rateLimit).toHaveBeenCalledWith("login:user@example.com", 8, 15 * 60_000);
    process.env.NODE_ENV = "test";
  });

  it("honors an explicit LOGIN_RATE_LIMIT even outside production", async () => {
    process.env.NODE_ENV = "test";
    process.env.LOGIN_RATE_LIMIT = "3";
    h.findUnique.mockResolvedValue(ACTIVE_USER);

    await authorize({ email: "user@example.com", password: "secret1" });

    expect(h.rateLimit).toHaveBeenCalledWith("login:user@example.com", 3, 15 * 60_000);
  });
});

describe("auth authorize() credential checks", () => {
  it("returns null when email or password is missing", async () => {
    expect(await authorize({ email: "", password: "secret1" })).toBeNull();
    expect(await authorize({ email: "user@example.com" })).toBeNull();
    expect(await authorize(undefined)).toBeNull();
    expect(h.rateLimit).not.toHaveBeenCalled();
  });

  it("returns null (and skips the DB) when rate limited", async () => {
    h.rateLimit.mockReturnValue({ ok: false, retryAfter: 60 });

    const user = await authorize({ email: "user@example.com", password: "secret1" });

    expect(user).toBeNull();
    expect(h.findUnique).not.toHaveBeenCalled();
  });

  it("returns null for an unknown user", async () => {
    h.findUnique.mockResolvedValue(null);
    expect(await authorize({ email: "ghost@example.com", password: "secret1" })).toBeNull();
  });

  it("returns null for an inactive user", async () => {
    h.findUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });
    expect(await authorize({ email: "user@example.com", password: "secret1" })).toBeNull();
  });

  it("returns null when the password does not match", async () => {
    h.findUnique.mockResolvedValue(ACTIVE_USER);
    h.compare.mockResolvedValue(false);
    expect(await authorize({ email: "user@example.com", password: "wrong" })).toBeNull();
  });

  it("returns the sanitized user on a valid login", async () => {
    h.findUnique.mockResolvedValue(ACTIVE_USER);
    h.compare.mockResolvedValue(true);

    const user = await authorize({ email: "user@example.com", password: "secret1" });

    expect(user).toEqual({
      id: "u1",
      name: "User",
      email: "user@example.com",
      role: "ADMIN",
    });
  });
});
