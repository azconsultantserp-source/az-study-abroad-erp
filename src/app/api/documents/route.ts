import { NextRequest, NextResponse } from "next/server";
import path from "path";
import prisma from "@/lib/db";
import {
  requirePermission,
  handleApiError,
  logAudit,
  documentScopeWhere,
  canAccessCase,
  guardMutation,
} from "@/lib/api-auth";
import { saveUploadedFile } from "@/lib/upload";
import { documentTypeFromName } from "@/lib/parse-document-requirements";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission("documents:read");
    const { searchParams } = new URL(request.url);
    const stageRecordId = searchParams.get("stageRecordId");
    const pendingOnly = searchParams.get("pending") === "true";
    const currentOnly = searchParams.get("currentOnly") !== "false";

    const where: Prisma.DocumentWhereInput = { ...documentScopeWhere(user) };
    if (stageRecordId) where.stageRecordId = stageRecordId;
    if (pendingOnly) where.status = "PENDING_APPROVAL";
    if (currentOnly) where.isCurrent = true;

    const documents = await prisma.document.findMany({
      where,
      take: 500,
      select: {
        id: true,
        stageRecordId: true,
        requirementId: true,
        documentType: true,
        fileName: true,
        fileSize: true,
        status: true,
        version: true,
        isCurrent: true,
        uploadedAt: true,
        reviewNote: true,
        stageRecord: {
          select: { studentCase: { select: { fullName: true } } },
        },
        uploadedBy: { select: { name: true, role: true } },
        approvedBy: { select: { name: true } },
        requirement: { select: { documentName: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(documents);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requirePermission("documents:write");
    guardMutation(request, currentUser.id, "documents:upload", 30, 60_000);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const stageRecordId = formData.get("stageRecordId") as string;
    const documentTypeInput = formData.get("documentType") as string | null;
    const requirementId = formData.get("requirementId") as string | null;
    const customName = (formData.get("customName") as string | null)?.trim() || null;

    if (!file || !stageRecordId) {
      return NextResponse.json({ error: "File and stage record are required" }, { status: 400 });
    }

    const stageRecord = await prisma.studentStageRecord.findUnique({
      where: { id: stageRecordId },
      include: { studentCase: true },
    });

    if (!stageRecord) {
      return NextResponse.json({ error: "Stage record not found" }, { status: 404 });
    }

    if (!canAccessCase(currentUser, stageRecord.studentCase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let documentType = documentTypeInput?.trim() || "legacy";
    let resolvedRequirementId: string | null = requirementId || null;

    if (requirementId) {
      const requirement = await prisma.documentRequirement.findUnique({
        where: { id: requirementId },
      });
      if (requirement) {
        documentType = documentTypeFromName(requirement.documentName);
        resolvedRequirementId = requirement.id;
      }
    }

    const saved = await saveUploadedFile(file);

    let storedFileName = saved.fileName;
    if (customName && !resolvedRequirementId) {
      const ext = path.extname(saved.fileName);
      storedFileName = customName.toLowerCase().endsWith(ext.toLowerCase())
        ? customName
        : `${customName}${ext}`;
      const slug = documentTypeFromName(customName);
      if (slug) documentType = slug;
    }

    const existingWhere: Prisma.DocumentWhereInput = {
      stageRecordId,
      isCurrent: true,
    };
    if (resolvedRequirementId) {
      existingWhere.requirementId = resolvedRequirementId;
    } else if (documentType !== "legacy") {
      existingWhere.documentType = documentType;
    }

    const existingCurrent = await prisma.document.findFirst({
      where: existingWhere,
      orderBy: { version: "desc" },
    });

    const document = await prisma.$transaction(async (tx) => {
      if (existingCurrent && documentType !== "legacy") {
        await tx.document.update({
          where: { id: existingCurrent.id },
          data: { isCurrent: false },
        });
      }

      return tx.document.create({
        data: {
          stageRecordId,
          requirementId: resolvedRequirementId,
          documentType,
          fileName: storedFileName,
          filePath: saved.filePath,
          fileSize: saved.fileSize,
          mimeType: saved.mimeType,
          uploadedById: currentUser.id,
          status: "PENDING_APPROVAL",
          version: existingCurrent ? existingCurrent.version + 1 : 1,
          isCurrent: true,
          parentDocumentId: existingCurrent?.id,
          country: stageRecord.country,
          degree: stageRecord.degree,
          intake: stageRecord.intake,
          university: stageRecord.university,
        },
        include: {
          stageRecord: {
            include: { studentCase: { select: { fullName: true } } },
          },
          requirement: { select: { documentName: true } },
        },
      });
    });

    await logAudit(currentUser.id, "UPLOAD", "Document", document.id, storedFileName);

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
