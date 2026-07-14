import prisma from "@/lib/db";
import { Country, Prisma, Role, StudentStage } from "@prisma/client";
import { paginated, type PaginatedResult, type PaginationParams } from "@/lib/pagination";

/**
 * Centralized data-access layer.
 *
 * All non-trivial Prisma reads live here so that:
 *  - API routes and server components share one source of truth,
 *  - queries select only the fields the UI needs (smaller payloads),
 *  - role-based row scoping is applied consistently in one place.
 *
 * This module imports Prisma, so it is inherently server-only.
 */

export type Actor = { id: string; role: Role };

function caseScope(actor: Actor): Prisma.StudentCaseWhereInput {
  return actor.role === Role.STUDENT ? { userId: actor.id } : {};
}

function recordScope(actor: Actor): Prisma.StudentStageRecordWhereInput {
  return actor.role === Role.STUDENT
    ? { studentCase: { userId: actor.id } }
    : {};
}

export async function getDashboardData(actor: Actor) {
  const scope = recordScope(actor);

  // Parallel round-trips: groupBy replaces 4× COUNT on stage; pending uses
  // (status, isCurrent) composite index.
  const [stageGroups, totalStudents, pendingApprovals, recentRecords] = await Promise.all([
    prisma.studentStageRecord.groupBy({
      by: ["stage"],
      where: { status: "ACTIVE", ...scope },
      _count: { _all: true },
    }),
    prisma.studentCase.count({ where: caseScope(actor) }),
    actor.role === Role.ADMIN
      ? prisma.document.count({
          where: { status: "PENDING_APPROVAL", isCurrent: true },
        })
      : Promise.resolve(0),
    prisma.studentStageRecord.findMany({
      where: { status: "ACTIVE", ...scope },
      take: 8,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        stage: true,
        country: true,
        updatedAt: true,
        studentCase: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  const countFor = (stage: StudentStage) =>
    stageGroups.find((g) => g.stage === stage)?._count._all ?? 0;

  return {
    stats: {
      queries: countFor("QUERY"),
      admissions: countFor("ADMISSION"),
      visas: countFor("VISA"),
      satisfied: countFor("SATISFIED"),
      totalStudents,
      pendingApprovals,
    },
    recentRecords,
  };
}

type StudentCaseRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  createdAt: Date;
  counselor: { name: string } | null;
};

type ActiveRecordRow = {
  id: string;
  caseId: string;
  stage: StudentStage;
  status: string;
  country: Country | null;
};

/**
 * All student cases — two-query batch pattern.
 *
 * Why faster than nested `stageRecords { where ACTIVE take 1 }`:
 * Postgres runs one index scan on StudentCase(createdAt) and one on
 * StudentStageRecord(caseId, status) instead of a correlated subquery per row.
 */
export async function listStudentCases(
  actor: Actor,
  pagination?: PaginationParams
): Promise<PaginatedResult<StudentCaseRow & { stageRecords: ActiveRecordRow[] }>> {
  const where = caseScope(actor);
  const skip = pagination?.skip ?? 0;
  const take = pagination?.take ?? 2000;

  const [cases, total] = await Promise.all([
    prisma.studentCase.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        nationality: true,
        createdAt: true,
        counselor: { select: { name: true } },
      },
    }),
    pagination ? prisma.studentCase.count({ where }) : Promise.resolve(0),
  ]);

  if (!cases.length) {
    return paginated([], total, pagination?.page ?? 1, pagination?.pageSize ?? take);
  }

  const activeRecords = await prisma.studentStageRecord.findMany({
    where: {
      caseId: { in: cases.map((c) => c.id) },
      status: "ACTIVE",
    },
    select: {
      id: true,
      caseId: true,
      stage: true,
      status: true,
      country: true,
    },
  });

  const activeByCase = new Map(activeRecords.map((r) => [r.caseId, r]));

  const items = cases.map((c) => {
    const active = activeByCase.get(c.id);
    return {
      ...c,
      stageRecords: active ? [active] : [],
    };
  });

  return paginated(items, pagination ? total : items.length, pagination?.page ?? 1, pagination?.pageSize ?? take);
}

/** Full export dataset — admin-only; unbounded but uses _count not document rows. */
export async function listStudentCasesForExport() {
  return prisma.studentCase.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      nationality: true,
      address: true,
      passportNumber: true,
      createdAt: true,
      counselor: { select: { name: true } },
      user: { select: { email: true } },
      stageRecords: {
        orderBy: { createdAt: "asc" },
        select: {
          stage: true,
          status: true,
          country: true,
          degree: true,
          program: true,
          intake: true,
          university: true,
          notes: true,
          consultancyFeeStatus: true,
          consultancyFeeNote: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { documents: true } },
        },
      },
    },
  });
}

/** Active stage records for a folder page — uses (stage, status, updatedAt) index. */
export async function listStageRecords(
  actor: Actor,
  stage: StudentStage,
  pagination?: PaginationParams
) {
  const where: Prisma.StudentStageRecordWhereInput = {
    stage,
    status: "ACTIVE",
    ...recordScope(actor),
  };
  const skip = pagination?.skip ?? 0;
  const take = pagination?.take ?? 1000;

  const [records, total] = await Promise.all([
    prisma.studentStageRecord.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        stage: true,
        country: true,
        degree: true,
        program: true,
        intake: true,
        university: true,
        notes: true,
        consultancyFeeStatus: true,
        updatedAt: true,
        studentCase: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            nationality: true,
            counselor: { select: { name: true } },
          },
        },
        _count: { select: { documents: true } },
      },
    }),
    pagination ? prisma.studentStageRecord.count({ where }) : Promise.resolve(0),
  ]);

  if (!pagination) return records;
  return paginated(records, total, pagination.page, pagination.pageSize);
}
