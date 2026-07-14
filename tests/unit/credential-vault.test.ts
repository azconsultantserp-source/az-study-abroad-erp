import { describe, it, expect, afterEach } from "vitest";
import { sealCredential, revealCredential } from "@/lib/credential-vault";

describe("credential vault", () => {
  it("round-trips a sealed credential", () => {
    const sealed = sealCredential("SuperSecret123");
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(sealed).not.toContain("SuperSecret123");
    expect(revealCredential(sealed)).toBe("SuperSecret123");
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(sealCredential("same")).not.toBe(sealCredential("same"));
  });

  it("returns null for null/undefined input", () => {
    expect(revealCredential(null)).toBeNull();
    expect(revealCredential(undefined)).toBeNull();
  });

  it("returns legacy plaintext (no prefix) as-is", () => {
    expect(revealCredential("legacyPlainPassword")).toBe("legacyPlainPassword");
  });

  it("returns null for a malformed encrypted payload", () => {
    expect(revealCredential("enc:v1:only-one-part")).toBeNull();
  });

  it("handles unicode content", () => {
    const sealed = sealCredential("pásswörd-🔐");
    expect(revealCredential(sealed)).toBe("pásswörd-🔐");
  });
});

describe("credential vault (production guard)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.AUTH_SECRET = origSecret;
  });

  it("throws in production when AUTH_SECRET is missing or too short", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SECRET = "";
    expect(() => sealCredential("secret")).toThrow(/AUTH_SECRET is required/);
  });
});

describe("credential vault (dev fallback key)", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    process.env.AUTH_SECRET = origSecret;
  });

  it("uses an insecure dev key when AUTH_SECRET is absent outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_SECRET;
    const sealed = sealCredential("dev-only-secret");
    expect(sealed.startsWith("enc:v1:")).toBe(true);
    expect(revealCredential(sealed)).toBe("dev-only-secret");
  });

  it("uses the dev key when AUTH_SECRET is present but shorter than 32 chars", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_SECRET = "too-short";
    expect(revealCredential(sealCredential("value"))).toBe("value");
  });
});
