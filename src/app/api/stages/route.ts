import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { listStageRecords } from "@/lib/data";
import { moveStageSchema } from "@/lib/validators";
import { parsePagination } from "@/lib/pagination";
import { NEXT_STAGE, PREV_STAGE, STAGE_LABELS } from "@/lib/constants";
import { StudentStage } from "@prisma/client";

const VALID_STAGES: StudentStage[] = ["QUERY", "ADMISSION", "VISA", "SATISFIED"];

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("stages:read");
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage") as StudentStage | null;
    const pagination = parsePagination(searchParams, 100);

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json({ error: "Valid stage parameter required" }, { status: 400 });
    }

    const result = await listStageRecords(user, stage, pagination);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requirePermission("stages:write");
    guardMutation(request, currentUser.id, "stages:move", 30, 60_000);
    const body = await request.json();
    const { recordId, note, direction } = moveStageSchema.parse(body);

    const sourceRecord = await prisma.studentStageRecord.findUnique({
      where: { id: recordId },
      include: { studentCase: true },
    });

    if (!sourceRecord || sourceRecord.status !== "ACTIVE") {
      return NextResponse.json({ error: "Record not found or already moved" }, { status: 404 });
    }

    const targetStage =
      direction === "backward" ? PREV_STAGE[sourceRecord.stage] : NEXT_STAGE[sourceRecord.stage];
    if (!targetStage) {
      return NextResponse.json(
        {
          error:
            direction === "backward"
              ? "Cannot move back from this stage"
              : "Cannot move forward from this stage",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.studentStageRecord.update({
        where: { id: recordId },
        data: { status: "MOVED", movedById: currentUser.id, movedAt: new Date() },
      });

      const newRecord = await tx.studentStageRecord.create({
        data: {
          caseId: sourceRecord.caseId,
          stage: targetStage,
          country: sourceRecord.country,
          degree: sourceRecord.degree,
          program: sourceRecord.program,
          intake: sourceRecord.intake,
          university: sourceRecord.university,
          notes: sourceRecord.notes,
          consultancyFeeStatus: sourceRecord.consultancyFeeStatus,
          consultancyFeeNote: sourceRecord.consultancyFeeNote,
          copiedFromId: sourceRecord.id,
        },
        include: {
          studentCase: { select: { fullName: true, email: true, phone: true } },
        },
      });

      // Carry the student's documents to the new active record so they always
      // travel with the case — this makes a backward move a true undo and
      // avoids orphaning files on the now-MOVED record.
      await tx.document.updateMany({
        where: { stageRecordId: recordId },
        data: { stageRecordId: newRecord.id },
      });

      await tx.stageMoveHistory.create({
        data: {
          fromRecordId: recordId,
          toRecordId: newRecord.id,
          movedById: currentUser.id,
          fromStage: sourceRecord.stage,
          toStage: targetStage,
          note,
        },
      });

      return newRecord;
    });

    await logAudit(
      currentUser.id,
      "MOVE",
      "StudentStageRecord",
      result.id,
      `${STAGE_LABELS[sourceRecord.stage]} → ${STAGE_LABELS[targetStage]}`
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
