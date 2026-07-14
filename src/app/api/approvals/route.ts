import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import {
  getRequirementsForPairs,
  summarizeRecordDocuments,
} from "@/lib/document-requirements";
import { Country, Degree } from "@prisma/client";

export async function GET() {
  try {
    await requirePermission("documents:approve");

    // Query 1: lean stage records (no nested documents — avoids join fan-out).
    const activeRecords = await prisma.studentStageRecord.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        country: true,
        degree: true,
        stage: true,
        updatedAt: true,
        studentCase: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    if (!activeRecords.length) {
      return NextResponse.json([]);
    }

    const recordIds = activeRecords.map((r) => r.id);

    // Query 2: batch-load all current documents for those records in one pass.
    // Uses Document(stageRecordId) index; one round-trip instead of 200 nested joins.
    const allDocuments = await prisma.document.findMany({
      where: { stageRecordId: { in: recordIds }, isCurrent: true },
      select: {
        stageRecordId: true,
        id: true,
        documentType: true,
        requirementId: true,
        fileName: true,
        fileSize: true,
        status: true,
        version: true,
        isCurrent: true,
        uploadedAt: true,
        reviewNote: true,
      },
    });

    const docsByRecord = new Map<string, typeof allDocuments>();
    for (const doc of allDocuments) {
      const list = docsByRecord.get(doc.stageRecordId) ?? [];
      list.push(doc);
      docsByRecord.set(doc.stageRecordId, list);
    }

    const pairs = activeRecords
      .filter((r): r is typeof r & { country: Country; degree: Degree } => !!r.country && !!r.degree)
      .map((r) => ({ country: r.country, degree: r.degree }));

    // Query 3: batch requirements (already optimized).
    const allRequirements = await getRequirementsForPairs(pairs);

    const cards = activeRecords.map((record) => {
      const documents = (docsByRecord.get(record.id) ?? []).map(
        ({ stageRecordId: _s, ...doc }) => doc
      );
      const summary = summarizeRecordDocuments(
        record.country,
        record.degree,
        documents,
        allRequirements
      );
      const legacyPending = documents.filter(
        (d) => d.documentType === "legacy" && d.status === "PENDING_APPROVAL"
      ).length;

      return {
        recordId: record.id,
        caseId: record.studentCase.id,
        studentName: record.studentCase.fullName,
        email: record.studentCase.email,
        country: record.country,
        degree: record.degree,
        stage: record.stage,
        updatedAt: record.updatedAt,
        pendingCount: summary.pending + legacyPending,
        approvedCount: summary.approved,
        rejectedCount: summary.rejected,
        totalRequired: summary.total,
        percentComplete: summary.percentComplete,
        hasActivity:
          summary.pending + summary.rejected + legacyPending > 0 || documents.length > 0,
      };
    });

    const filtered = cards.filter((c) => c.hasActivity || c.pendingCount > 0);
    filtered.sort(
      (a, b) => b.pendingCount - a.pendingCount || b.updatedAt.getTime() - a.updatedAt.getTime()
    );

    return NextResponse.json(filtered);
  } catch (error) {
    return handleApiError(error);
  }
}
