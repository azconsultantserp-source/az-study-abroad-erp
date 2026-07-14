import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireRole, handleApiError } from "@/lib/api-auth";
import { Role } from "@prisma/client";
import { STAGE_LABELS } from "@/lib/constants";

export async function GET() {
  try {
    const user = await requireRole(Role.STUDENT);

    // Single lookup on StudentCase.userId (@unique) — one index seek.
    const studentCase = await prisma.studentCase.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        fullName: true,
        stageRecords: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            stage: true,
            status: true,
            country: true,
            degree: true,
            program: true,
            createdAt: true,
          },
        },
      },
    });

    if (!studentCase) {
      return NextResponse.json({
        case: null,
        currentStage: null,
        timeline: [],
        message: "Your application is being set up. Please contact your counselor.",
      });
    }

    const activeRecord = studentCase.stageRecords.find((r) => r.status === "ACTIVE");
    const timeline = studentCase.stageRecords.map((r) => ({
      stage: r.stage,
      label: STAGE_LABELS[r.stage],
      status: r.status,
      country: r.country,
      degree: r.degree,
      program: r.program,
      createdAt: r.createdAt,
      isActive: r.status === "ACTIVE",
      documents: [] as never[],
    }));

    return NextResponse.json({
      case: {
        fullName: studentCase.fullName,
        id: studentCase.id,
      },
      currentStage: activeRecord
        ? {
            stage: activeRecord.stage,
            label: STAGE_LABELS[activeRecord.stage],
            recordId: activeRecord.id,
          }
        : null,
      timeline,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
