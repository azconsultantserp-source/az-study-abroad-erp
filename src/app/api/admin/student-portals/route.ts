import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireRole, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { createStudentPortalSchema, changePasswordSchema } from "@/lib/validators";
import { sealCredential, revealCredential } from "@/lib/credential-vault";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const cases = await prisma.studentCase.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        userId: true,
        createdAt: true,
        counselor: { select: { name: true } },
        user: { select: { id: true, email: true, isActive: true, plainPassword: true } },
        stageRecords: {
          where: { status: "ACTIVE" },
          select: { stage: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    return NextResponse.json(
      cases.map((c) => ({
        ...c,
        user: c.user
          ? { ...c.user, plainPassword: revealCredential(c.user.plainPassword) }
          : null,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRole(Role.ADMIN);
    guardMutation(request, admin.id, "admin:create-portal", 20, 60_000);
    const body = await request.json();
    const data = createStudentPortalSchema.parse(body);

    const studentCase = await prisma.studentCase.findUnique({
      where: { id: data.caseId },
    });
    if (!studentCase) {
      return NextResponse.json({ error: "Student query not found" }, { status: 404 });
    }
    if (studentCase.userId) {
      return NextResponse.json({ error: "This student already has a portal login" }, { status: 409 });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: await bcrypt.hash(data.password, 12),
          plainPassword: sealCredential(data.password),
          role: Role.STUDENT,
        },
      });

      const updatedCase = await tx.studentCase.update({
        where: { id: data.caseId },
        data: { userId: newUser.id, email: data.email, fullName: data.name },
      });

      return { user: newUser, case: updatedCase };
    });

    await logAudit(admin.id, "CREATE_PORTAL", "User", result.user.id, `Portal for ${data.name}`);

    return NextResponse.json(
      { id: result.user.id, email: result.user.email, name: result.user.name },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRole(Role.ADMIN);
    guardMutation(request, admin.id, "admin:portal-password", 20, 60_000);
    const body = await request.json();
    const data = changePasswordSchema.parse(body);

    const target = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!target || target.role !== Role.STUDENT) {
      return NextResponse.json({ error: "Student account not found" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id: data.userId },
      data: {
        passwordHash: await bcrypt.hash(data.password, 12),
        plainPassword: sealCredential(data.password),
      },
    });

    await logAudit(admin.id, "CHANGE_PASSWORD", "User", data.userId, "Student password reset");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireRole(Role.ADMIN);
    guardMutation(request, admin.id, "admin:delete-portal", 10, 60_000);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target || target.role !== Role.STUDENT) {
      return NextResponse.json({ error: "Student account not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.updateMany({
        where: { uploadedById: userId },
        data: { uploadedById: admin.id },
      });
      await tx.user.delete({ where: { id: userId } });
    });

    await logAudit(admin.id, "DELETE_PORTAL", "User", userId, "Student portal login removed");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
