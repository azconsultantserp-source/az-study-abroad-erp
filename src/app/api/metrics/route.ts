import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireRole, handleApiError } from "@/lib/api-auth";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Operational metrics — two groupBy/count round-trips instead of six
 * independent COUNT(*) scans where possible.
 */
export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const [users, cases, activeRecords, documents, docStats, requirements] = await Promise.all([
      prisma.user.count(),
      prisma.studentCase.count(),
      prisma.studentStageRecord.count({ where: { status: "ACTIVE" } }),
      prisma.document.count(),
      prisma.document.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { isCurrent: true },
      }),
      prisma.documentRequirement.count(),
    ]);

    const pendingDocs =
      docStats.find((r) => r.status === "PENDING_APPROVAL")?._count._all ?? 0;

    const mem = process.memoryUsage();

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        process: {
          rssMB: Math.round(mem.rss / 1024 / 1024),
          heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
          nodeVersion: process.version,
        },
        counts: { users, cases, activeRecords, documents, pendingDocs, requirements },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
