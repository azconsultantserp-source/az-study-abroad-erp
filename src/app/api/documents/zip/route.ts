import { Readable } from "stream";
import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import prisma from "@/lib/db";
import { requirePermission, handleApiError, documentScopeWhere, logAudit, guardMutation } from "@/lib/api-auth";
import { zipDocumentsSchema } from "@/lib/validators";
import { openStoredFileStream, contentDispositionFilename } from "@/lib/upload";

export async function POST(request: NextRequest) {
  try {
    const user = await requirePermission("documents:read");
    guardMutation(request, user.id, "documents:zip", 15, 60_000);
    const body = await request.json();
    const { documentIds } = zipDocumentsSchema.parse(body);

    const documents = await prisma.document.findMany({
      where: {
        id: { in: documentIds },
        status: "APPROVED",
        isCurrent: true,
        ...documentScopeWhere(user),
      },
      include: {
        stageRecord: {
          include: { studentCase: { select: { fullName: true } } },
        },
      },
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: "No approved documents available to download." },
        { status: 404 }
      );
    }

    const usedNames = new Set<string>();
    const entries: { stream: Readable; name: string }[] = [];
    for (const doc of documents) {
      const stream = await openStoredFileStream(doc.filePath);
      if (!stream) continue;

      let name = doc.fileName;
      if (usedNames.has(name)) {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        let i = 2;
        while (usedNames.has(`${base} (${i})${ext}`)) i++;
        name = `${base} (${i})${ext}`;
      }
      usedNames.add(name);
      entries.push({ stream, name });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "The approved files could not be found in storage." },
        { status: 404 }
      );
    }

    const studentName = documents[0].stageRecord.studentCase.fullName.replace(/[^\w]+/g, "_");

    await logAudit(
      user.id,
      "DOWNLOAD_ZIP",
      "Document",
      documents.map((d) => d.id).join(","),
      `${entries.length} file(s) for ${documents[0].stageRecord.studentCase.fullName}`
    );

    const archive = archiver("zip", { zlib: { level: 1 } });
    archive.on("error", (err) => {
      console.error("ZIP archive error:", err);
    });

    for (const entry of entries) {
      archive.append(entry.stream, { name: entry.name });
    }
    void archive.finalize();

    const webStream = Readable.toWeb(archive) as unknown as ReadableStream;

    return new NextResponse(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; ${contentDispositionFilename(`${studentName}_documents.zip`)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
