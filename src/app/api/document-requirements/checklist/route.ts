import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, canAccessCase } from "@/lib/api-auth";
import { getDocumentChecklist } from "@/lib/document-requirements";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("documents:read");
    const stageRecordId = new URL(request.url).searchParams.get("stageRecordId");

    if (!stageRecordId) {
      return NextResponse.json({ error: "stageRecordId is required" }, { status: 400 });
    }

    // Select only what the access check and the checklist need — and reuse this
    // single lookup for both, instead of re-fetching the record inside
    // getDocumentChecklist.
    const record = await prisma.studentStageRecord.findUnique({
      where: { id: stageRecordId },
      select: {
        country: true,
        degree: true,
        intake: true,
        university: true,
        studentCase: { select: { counselorId: true, userId: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (!canAccessCase(user, record.studentCase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const checklist = await getDocumentChecklist(stageRecordId, {
      country: record.country,
      degree: record.degree,
      intake: record.intake,
      university: record.university,
    });
    return NextResponse.json(checklist);
  } catch (error) {
    return handleApiError(error);
  }
}
