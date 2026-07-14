import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { revalidateTag } from "next/cache";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, logAudit, guardMutation, AppError } from "@/lib/api-auth";
import { parseDocumentRequirementsCsv } from "@/lib/parse-document-requirements";
import { DOCUMENT_REQUIREMENTS_TAG } from "@/lib/document-requirements";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("admin:access");
    guardMutation(request, user.id, "admin:import-requirements", 5, 60_000);
    const contentType = request.headers.get("content-type") ?? "";
    let csvContent: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
      }
      if (file.size > MAX_CSV_BYTES) {
        throw new AppError("CSV file exceeds 2MB limit", 413);
      }
      csvContent = await file.text();
    } else {
      const defaultPath = path.join(process.cwd(), "data", "document-requirements.csv");
      csvContent = await readFile(defaultPath, "utf-8");
    }

    const requirements = parseDocumentRequirementsCsv(csvContent);
    if (requirements.length === 0) {
      return NextResponse.json({ error: "No requirements parsed from file" }, { status: 400 });
    }

    // Atomic replace: if create fails, old requirements remain intact.
    const count = await prisma.$transaction(async (tx) => {
      await tx.documentRequirement.deleteMany();
      const batchSize = 100;
      for (let i = 0; i < requirements.length; i += batchSize) {
        const batch = requirements.slice(i, i + batchSize);
        await tx.documentRequirement.createMany({
          data: batch.map((r) => ({
            country: r.country,
            degree: r.degree,
            documentName: r.documentName,
            sortOrder: r.sortOrder,
            isMandatory: true,
          })),
        });
      }
      return tx.documentRequirement.count();
    });

    await logAudit(user.id, "IMPORT", "DocumentRequirement", undefined, `${count} rows`);
    revalidateTag(DOCUMENT_REQUIREMENTS_TAG);

    return NextResponse.json({ success: true, count });
  } catch (error) {
    return handleApiError(error);
  }
}
