import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requireAuth, handleApiError, guardMutation } from "@/lib/api-auth";
import { markNotificationsSchema } from "@/lib/validators";

export async function GET() {
  try {
    const user = await requireAuth();
    // Run the list and the unread count concurrently — they are independent.
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.notification.count({
        where: { userId: user.id, read: false },
      }),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    guardMutation(request, user.id, "notifications:patch", 30, 60_000);
    const body = await request.json();
    const { ids, markAllRead } = markNotificationsSchema.parse(body);

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, read: false },
        data: { read: true },
      });
    } else if (ids?.length) {
      await prisma.notification.updateMany({
        where: { userId: user.id, id: { in: ids } },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
