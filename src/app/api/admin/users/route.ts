import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireRole, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { createUserSchema, updateAdminUserSchema } from "@/lib/validators";
import { sealCredential, revealCredential } from "@/lib/credential-vault";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    await requireRole(Role.ADMIN);

    const users = await prisma.user.findMany({
      where: { role: { in: [Role.ADMIN, Role.COUNSELOR] } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        plainPassword: true,
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    return NextResponse.json(
      users.map((u) => ({
        ...u,
        plainPassword: revealCredential(u.plainPassword),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireRole(Role.ADMIN);
    guardMutation(request, currentUser.id, "admin:create-user", 20, 60_000);
    const body = await request.json();
    const data = createUserSchema.parse(body);

    if (data.role === Role.STUDENT) {
      return NextResponse.json({ error: "Use student query form to add students" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: await bcrypt.hash(data.password, 12),
        plainPassword: sealCredential(data.password),
        role: data.role,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAudit(currentUser.id, "CREATE", "User", user.id, `Created ${data.role}`);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireRole(Role.ADMIN);
    guardMutation(request, currentUser.id, "admin:update-user", 30, 60_000);
    const body = await request.json();
    const data = updateAdminUserSchema.parse(body);

    if (data.id === currentUser.id && data.isActive === false) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 400 });
    }

    if (data.password) {
      await prisma.user.update({
        where: { id: data.id },
        data: {
          passwordHash: await bcrypt.hash(data.password, 12),
          plainPassword: sealCredential(data.password),
        },
      });
      await logAudit(currentUser.id, "CHANGE_PASSWORD", "User", data.id, "Staff password reset");
      return NextResponse.json({ success: true });
    }

    const user = await prisma.user.update({
      where: { id: data.id },
      data: { isActive: data.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await logAudit(currentUser.id, "UPDATE", "User", data.id);
    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireRole(Role.ADMIN);
    guardMutation(request, currentUser.id, "admin:delete-user", 10, 60_000);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 });
    if (id === currentUser.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });
    await logAudit(currentUser.id, "DELETE", "User", id, "Permanent delete");

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
