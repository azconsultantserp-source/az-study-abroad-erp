import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, canAccessCase, logAudit } from "@/lib/api-auth";
import { readStoredFile, contentDispositionFilename } from "@/lib/upload";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("documents:read");
    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        filePath: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        stageRecord: {
          select: {
            studentCase: { select: { counselorId: true, userId: true } },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (!canAccessCase(user, document.stageRecord.studentCase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const buffer = await readStoredFile(document.filePath);

    await logAudit(user.id, "DOWNLOAD", "Document", id, document.fileName);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; ${contentDispositionFilename(document.fileName)}`,
        "Content-Length": document.fileSize.toString(),
        "Cache-Control": "private, max-age=3600, must-revalidate",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
