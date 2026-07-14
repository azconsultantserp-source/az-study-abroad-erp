import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, canAccessCase, guardMutation } from "@/lib/api-auth";
import { updateStageRecordSchema } from "@/lib/validators";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("stages:read");
    const { id } = await params;

    const record = await prisma.studentStageRecord.findUnique({
      where: { id },
      include: {
        studentCase: {
          include: {
            counselor: { select: { name: true } },
            user: { select: { email: true } },
          },
        },
        documents: {
          where: { isCurrent: true },
          orderBy: { uploadedAt: "desc" },
          // Only the fields the record page renders — skips filePath, mimeType,
          // version, and the denormalised country/degree columns.
          select: {
            id: true,
            fileName: true,
            fileSize: true,
            status: true,
            uploadedAt: true,
            reviewNote: true,
            uploadedBy: { select: { name: true, role: true } },
            approvedBy: { select: { name: true } },
            requirement: { select: { documentName: true } },
          },
        },
        copiedFrom: { select: { id: true, stage: true, createdAt: true } },
        moveHistory: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // Prevent a counselor from reading another counselor's student record by ID.
    if (!canAccessCase(user, record.studentCase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(record);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("stages:write");
    guardMutation(request, user.id, "stages:update", 40, 60_000);
    const { id } = await params;
    const body = await request.json();
    const data = updateStageRecordSchema.parse(body);

    const record = await prisma.studentStageRecord.findUnique({
      where: { id },
      include: { studentCase: true },
    });

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (!canAccessCase(user, record.studentCase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Passport number lives on the StudentCase; update it alongside the stage
    // record so the record page can edit it. Only touch the case when provided.
    const updated = await prisma.$transaction(async (tx) => {
      if (data.passportNumber !== undefined) {
        await tx.studentCase.update({
          where: { id: record.caseId },
          data: { passportNumber: data.passportNumber || null },
        });
      }

      return tx.studentStageRecord.update({
        where: { id },
        data: {
          country: data.country,
          degree: data.degree,
          program: data.program,
          intake: data.intake,
          university: data.university,
          notes: data.notes,
          consultancyFeeStatus: data.consultancyFeeStatus,
          consultancyFeeNote: data.consultancyFeeNote,
        },
        // The client refetches after save and ignores this body, so keep it lean.
        include: {
          studentCase: { select: { fullName: true } },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
