import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { createStudentQuerySchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requirePermission("students:write");
    guardMutation(request, currentUser.id, "students:create", 30, 60_000);
    const body = await request.json();
    const data = createStudentQuerySchema.parse(body);

    // Counselors (and admins) create a query only. Student portal logins are
    // created separately by the Admin from User Management.
    const result = await prisma.$transaction(async (tx) => {
      const studentCase = await tx.studentCase.create({
        data: {
          counselorId: currentUser.id,
          fullName: data.fullName,
          email: data.email || undefined,
          phone: data.phone,
          nationality: data.nationality,
          address: data.address,
          passportNumber: data.passportNumber,
        },
      });

      const stageRecord = await tx.studentStageRecord.create({
        data: {
          caseId: studentCase.id,
          stage: "QUERY",
          country: data.country,
          degree: data.degree,
          program: data.program,
          intake: data.intake,
          university: data.university,
          notes: data.notes,
          consultancyFeeStatus: data.consultancyFeeStatus || "NOT_PAID",
          consultancyFeeNote: data.consultancyFeeNote,
        },
      });

      return { studentCase, stageRecord };
    });

    await logAudit(currentUser.id, "CREATE", "StudentCase", result.studentCase.id, `Query: ${data.fullName}`);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
