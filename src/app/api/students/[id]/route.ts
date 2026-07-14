import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, requireRole, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { Role } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission("students:read");
    const { id } = await params;

    const studentCase = await prisma.studentCase.findUnique({
      where: { id },
      include: {
        counselor: { select: { id: true, name: true } },
        user: { select: { id: true, email: true } },
        stageRecords: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            stage: true,
            status: true,
            country: true,
            degree: true,
            program: true,
            intake: true,
            university: true,
            createdAt: true,
            updatedAt: true,
            movedBy: { select: { name: true } },
            copiedFrom: { select: { id: true, stage: true } },
            documents: {
              orderBy: { uploadedAt: "desc" },
              select: {
                id: true,
                fileName: true,
                fileSize: true,
                status: true,
                uploadedAt: true,
                reviewNote: true,
                documentType: true,
                isCurrent: true,
              },
            },
          },
        },
      },
    });

    if (!studentCase) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(studentCase);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(Role.ADMIN);
    guardMutation(request, user.id, "students:delete", 10, 60_000);
    const { id } = await params;

    await prisma.studentCase.delete({ where: { id } });
    await logAudit(user.id, "DELETE", "StudentCase", id, "Permanent delete by admin");

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
