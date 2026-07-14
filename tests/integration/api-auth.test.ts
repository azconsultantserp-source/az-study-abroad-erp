import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  session: null as { user: { id: string; name: string; email: string; role: string } } | null,
}));

// Avoid loading NextAuth / Prisma singletons when importing api-auth.
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }));
vi.mock("@/lib/db", () => ({ default: { auditLog: { create: vi.fn() } } }));

// React.cache dedupes per-request; identity wrapper is fine outside a render.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import prisma from "@/lib/db";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import {
  documentScopeWhere,
  canAccessCase,
  handleApiError,
  requireAuth,
  requirePermission,
  requireRole,
  guardMutation,
  logAudit,
  AuthError,
  AppError,
} from "@/lib/api-auth";
import { SecurityError } from "@/lib/security";

const auditCreate = prisma.auditLog.create as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.session = null;
  auditCreate.mockReset();
});

describe("documentScopeWhere", () => {
  it("scopes students to their own case documents", () => {
    expect(documentScopeWhere({ id: "u1", role: Role.STUDENT })).toEqual({
      stageRecord: { studentCase: { userId: "u1" } },
    });
  });

  it("returns an empty (unrestricted) filter for staff", () => {
    expect(documentScopeWhere({ id: "a1", role: Role.ADMIN })).toEqual({});
    expect(documentScopeWhere({ id: "c1", role: Role.COUNSELOR })).toEqual({});
  });
});

describe("canAccessCase", () => {
  it("lets staff access any case", () => {
    const kase = { counselorId: "c9", userId: "someone" };
    expect(canAccessCase({ id: "a1", role: Role.ADMIN }, kase)).toBe(true);
    expect(canAccessCase({ id: "c1", role: Role.COUNSELOR }, kase)).toBe(true);
  });

  it("lets a student access only their own case", () => {
    expect(
      canAccessCase({ id: "s1", role: Role.STUDENT }, { counselorId: "c1", userId: "s1" })
    ).toBe(true);
    expect(
      canAccessCase({ id: "s1", role: Role.STUDENT }, { counselorId: "c1", userId: "s2" })
    ).toBe(false);
  });
});

describe("requireAuth / requirePermission / requireRole", () => {
  const staff = { id: "a1", name: "A", email: "a@x.com", role: "ADMIN" };

  it("requireAuth throws 401 when no session", async () => {
    h.session = null;
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 });
  });

  it("requireAuth returns the user when authenticated", async () => {
    h.session = { user: staff };
    await expect(requireAuth()).resolves.toMatchObject({ id: "a1" });
  });

  it("requirePermission allows a permitted role", async () => {
    h.session = { user: staff };
    await expect(requirePermission("users:delete")).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("requirePermission throws 403 for a missing permission", async () => {
    h.session = { user: { ...staff, role: "COUNSELOR" } };
    await expect(requirePermission("users:delete")).rejects.toMatchObject({ status: 403 });
  });

  it("requireRole allows a listed role", async () => {
    h.session = { user: staff };
    await expect(requireRole(Role.ADMIN)).resolves.toMatchObject({ role: "ADMIN" });
  });

  it("requireRole throws 403 for an unlisted role", async () => {
    h.session = { user: { ...staff, role: "STUDENT" } };
    await expect(requireRole(Role.ADMIN)).rejects.toMatchObject({ status: 403 });
  });
});

describe("guardMutation", () => {
  function req(headers: Record<string, string>) {
    return new NextRequest("http://localhost:3000/api/x", { method: "POST", headers });
  }

  it("passes for a same-origin request under the limit", () => {
    expect(() =>
      guardMutation(req({ origin: "http://localhost:3000", "x-forwarded-for": "2.0.0.1" }), "u1", "act-a")
    ).not.toThrow();
  });

  it("throws for a cross-site origin", () => {
    expect(() =>
      guardMutation(req({ origin: "https://evil.com" }), "u1", "act-b")
    ).toThrow(SecurityError);
  });

  it("throws once the rate limit is exceeded", () => {
    const r = req({ origin: "http://localhost:3000", "x-forwarded-for": "2.0.0.2" });
    guardMutation(r, "u2", "act-c", 1, 60_000);
    expect(() => guardMutation(r, "u2", "act-c", 1, 60_000)).toThrow(SecurityError);
  });
});

describe("logAudit", () => {
  it("writes an audit log row", async () => {
    await logAudit("u1", "CREATE", "Student", "s1", "created");
    expect(auditCreate).toHaveBeenCalledWith({
      data: { userId: "u1", action: "CREATE", entity: "Student", entityId: "s1", details: "created" },
    });
  });
});

describe("handleApiError", () => {
  it("surfaces AuthError with its status", async () => {
    const res = handleApiError(new AuthError("Unauthorized", 401));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("surfaces AppError", async () => {
    expect(handleApiError(new AppError("Bad input", 400)).status).toBe(400);
  });

  it("surfaces SecurityError", async () => {
    expect(handleApiError(new SecurityError("Forbidden", 403)).status).toBe(403);
  });

  it("maps ZodError to 422 with field details", async () => {
    const parsed = z.object({ name: z.string().min(2) }).safeParse({ name: "" });
    const res = handleApiError(parsed.success ? new Error() : parsed.error);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toHaveProperty("name");
  });

  it("maps Prisma P2002 to 409", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("dup", {
      code: "P2002",
      clientVersion: "6.0.0",
    });
    expect(handleApiError(err).status).toBe(409);
  });

  it("maps Prisma P2025 to 404", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("missing", {
      code: "P2025",
      clientVersion: "6.0.0",
    });
    expect(handleApiError(err).status).toBe(404);
  });

  it("maps other Prisma errors to 400", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("boom", {
      code: "P2003",
      clientVersion: "6.0.0",
    });
    expect(handleApiError(err).status).toBe(400);
  });

  it("maps unknown errors to 500", async () => {
    const res = handleApiError(new Error("kaboom"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });

  it("maps non-Error values to 500", async () => {
    const res = handleApiError("unexpected string failure");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
