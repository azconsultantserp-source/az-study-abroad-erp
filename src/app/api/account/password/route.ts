import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleApiError, logAudit, guardMutation } from "@/lib/api-auth";
import { changeOwnPasswordSchema } from "@/lib/validators";
import { sealCredential } from "@/lib/credential-vault";
import bcrypt from "bcryptjs";

// Self-service password change for the logged-in user (used by counselors/admins).
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    guardMutation(request, currentUser.id, "account:password", 10, 15 * 60_000);
    const body = await request.json();
    const { oldPassword, newPassword } = changeOwnPasswordSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: currentUser.id } });
    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from the current one" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: currentUser.id },
      data: {
        passwordHash: await bcrypt.hash(newPassword, 12),
        plainPassword: sealCredential(newPassword),
      },
    });

    await logAudit(currentUser.id, "CHANGE_OWN_PASSWORD", "User", currentUser.id, "Self password change");
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
