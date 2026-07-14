import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { documentApprovalSchema } from "@/lib/validators";
import { createDocumentNotification } from "@/lib/notifications";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requirePermission("documents:approve");
    guardMutation(request, currentUser.id, "documents:approve", 60, 60_000);
    const { id } = await params;
    const body = await request.json();
    const data = documentApprovalSchema.parse(body);

    const existing = await prisma.document.findUnique({
      where: { id },
      include: {
        requirement: { select: { documentName: true } },
        stageRecord: {
          include: {
            studentCase: {
              select: { fullName: true, userId: true, counselorId: true },
            },
          },
        },
        uploadedBy: { select: { id: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const document = await prisma.document.update({
      where: { id },
      data: {
        status: data.status,
        reviewNote: data.reviewNote,
        approvedById: currentUser.id,
        approvedAt: new Date(),
      },
      include: {
        stageRecord: {
          include: { studentCase: { select: { fullName: true } } },
        },
        requirement: { select: { documentName: true } },
      },
    });

    const docLabel =
      document.requirement?.documentName ?? document.fileName;
    const studentName = existing.stageRecord.studentCase.fullName;

    const notifyUserIds = new Set<string>();
    if (existing.uploadedBy.id !== currentUser.id) {
      notifyUserIds.add(existing.uploadedBy.id);
    }
    const studentUserId = existing.stageRecord.studentCase.userId;
    if (studentUserId) notifyUserIds.add(studentUserId);

    await Promise.all(
      [...notifyUserIds].map((userId) =>
        createDocumentNotification({
          userId,
          type: data.status === "APPROVED" ? "DOCUMENT_APPROVED" : "DOCUMENT_REJECTED",
          documentId: id,
          documentName: docLabel,
          studentName,
          reviewNote: data.reviewNote,
        })
      )
    );

    await logAudit(currentUser.id, data.status, "Document", id);

    return NextResponse.json(document);
  } catch (error) {
    return handleApiError(error);
  }
}
