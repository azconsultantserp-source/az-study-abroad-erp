import { auth } from "@/lib/auth";
import { hasPermission, type Permission } from "@/lib/rbac";
import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cache } from "react";
import { logger } from "@/lib/logger";
import { assertSameOrigin, enforceRateLimit, SecurityError } from "@/lib/security";

type SessionUser = { id: string; name: string; email: string; role: Role };

// Wrapped in React.cache so multiple auth checks in the same request/render
// (e.g. requirePermission + requireRole, or layout + page) hit the session
// once instead of decoding the JWT repeatedly.
export const getSessionUser = cache(async () => {
  const session = await auth();
  if (!session?.user) return null;
  return session.user;
});

/**
 * Returns a Prisma `where` filter that limits Documents to those the given
 * user is allowed to see. Admins and counselors share one workspace and can
 * see all documents; students only see documents on their own case.
 * Used to prevent IDOR on document read/download/zip endpoints.
 */
export function documentScopeWhere(
  user: Pick<SessionUser, "id" | "role">
): Prisma.DocumentWhereInput {
  if (user.role === Role.STUDENT) {
    return { stageRecord: { studentCase: { userId: user.id } } };
  }
  return {};
}

/**
 * True if the user may access a given student case. Admins and counselors
 * share a workspace, so any staff member may access any case; students only
 * their own.
 */
export function canAccessCase(
  user: Pick<SessionUser, "id" | "role">,
  studentCase: { counselorId: string; userId: string | null }
): boolean {
  if (user.role === Role.STUDENT) return studentCase.userId === user.id;
  return true;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) throw new AuthError("Unauthorized", 401);
  return user;
}

export async function requirePermission(permission: Permission) {
  const user = await requireAuth();
  if (!hasPermission(user.role, permission)) {
    throw new AuthError("Forbidden", 403);
  }
  return user;
}

export async function requireRole(...roles: Role[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new AuthError("Forbidden", 403);
  }
  return user;
}

/** CSRF + rate-limit guard for state-changing API handlers. */
export function guardMutation(
  request: NextRequest,
  userId: string,
  action: string,
  limit = 60,
  windowMs = 60_000
) {
  assertSameOrigin(request);
  enforceRateLimit(request, userId, action, limit, windowMs);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Error whose message is safe to show to the client (e.g. validation). */
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  // Explicit, safe-to-surface errors.
  if (error instanceof AuthError || error instanceof AppError || error instanceof SecurityError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  // Input validation failures -> 422 with per-field details.
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  // Known database errors -> map to sensible status codes without leaking SQL.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "This record already exists" }, { status: 409 });
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }
    logger.error("Prisma error", { code: error.code, message: error.message });
    return NextResponse.json({ error: "Database request failed" }, { status: 400 });
  }

  logger.error("Unhandled API error", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export async function logAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  details?: string
) {
  const { default: prisma } = await import("@/lib/db");
  await prisma.auditLog.create({
    data: { userId, action, entity, entityId, details },
  });
}
