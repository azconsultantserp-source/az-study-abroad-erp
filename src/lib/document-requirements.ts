import { unstable_cache } from "next/cache";
import prisma from "@/lib/db";
import { Country, Degree, DocumentStatus } from "@prisma/client";
import { documentTypeFromName } from "@/lib/parse-document-requirements";

/** Cache tag for the DocumentRequirement table (invalidated on admin import). */
export const DOCUMENT_REQUIREMENTS_TAG = "document-requirements";

export type ChecklistItem = {
  requirementId: string;
  documentName: string;
  documentType: string;
  sortOrder: number;
  isMandatory: boolean;
  status: "missing" | DocumentStatus;
  document: {
    id: string;
    fileName: string;
    fileSize: number;
    status: DocumentStatus;
    version: number;
    uploadedAt: Date;
    reviewNote: string | null;
  } | null;
  historyCount: number;
};

export type ChecklistSummary = {
  total: number;
  uploaded: number;
  approved: number;
  pending: number;
  rejected: number;
  missing: number;
  percentComplete: number;
};

// Requirements change only when an admin re-imports the CSV, so cache each
// (country, degree) list and revalidate the tag on import. This turns the
// most frequent checklist read into a memoized lookup instead of a DB hit.
const getCachedRequirements = unstable_cache(
  async (country: Country, degree: Degree) =>
    prisma.documentRequirement.findMany({
      where: { country, degree },
      orderBy: { sortOrder: "asc" },
    }),
  ["document-requirements-by-pair"],
  { tags: [DOCUMENT_REQUIREMENTS_TAG], revalidate: 3600 }
);

export async function getRequirementsForRecord(country: Country | null, degree: Degree | null) {
  if (!country || !degree) return [];
  return getCachedRequirements(country, degree);
}

export type ChecklistRecord = {
  country: Country | null;
  degree: Degree | null;
  intake: string | null;
  university: string | null;
};

/**
 * @param prefetched Optional stage-record fields. Callers that already loaded
 * the record (e.g. the checklist route, for its access check) pass it here so
 * we don't issue a second identical `findUnique`.
 */
export async function getDocumentChecklist(
  stageRecordId: string,
  prefetched?: ChecklistRecord
) {
  const record =
    prefetched ??
    (await prisma.studentStageRecord.findUnique({
      where: { id: stageRecordId },
      select: { country: true, degree: true, intake: true, university: true },
    }));

  if (!record) return null;

  const [requirements, currentDocs, historyCounts] = await Promise.all([
    getRequirementsForRecord(record.country, record.degree),
    prisma.document.findMany({
      where: { stageRecordId, isCurrent: true },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        documentType: true,
        requirementId: true,
        fileName: true,
        fileSize: true,
        status: true,
        version: true,
        isCurrent: true,
        uploadedAt: true,
        reviewNote: true,
      },
    }),
    loadDocumentHistoryCounts(stageRecordId),
  ]);

  const items = buildChecklistItems(requirements, currentDocs, historyCounts);

  const matchedDocIds = new Set(
    items.map((item) => item.document?.id).filter((id): id is string => !!id)
  );

  const extraDocs = currentDocs.filter((d) => !matchedDocIds.has(d.id));
  const summary = summarizeChecklist(items);

  const mappedExtras = extraDocs.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    fileSize: d.fileSize,
    status: d.status,
    uploadedAt: d.uploadedAt,
    reviewNote: d.reviewNote,
  }));

  return {
    country: record.country,
    degree: record.degree,
    intake: record.intake,
    university: record.university,
    items,
    extraDocuments: mappedExtras,
    // Kept for backward compatibility with existing callers.
    legacyDocuments: mappedExtras,
    summary,
    hasRequirements: requirements.length > 0,
  };
}

export function summarizeChecklist(items: ChecklistItem[]): ChecklistSummary {
  const total = items.length;
  const uploaded = items.filter((i) => i.document).length;
  const approved = items.filter((i) => i.status === "APPROVED").length;
  const pending = items.filter((i) => i.status === "PENDING_APPROVAL").length;
  const rejected = items.filter((i) => i.status === "REJECTED").length;
  const missing = items.filter((i) => i.status === "missing").length;
  const percentComplete = total > 0 ? Math.round((approved / total) * 100) : 0;

  return { total, uploaded, approved, pending, rejected, missing, percentComplete };
}

type DocRow = {
  id: string;
  documentType: string;
  requirementId: string | null;
  fileName: string;
  fileSize: number;
  status: DocumentStatus;
  version: number;
  isCurrent: boolean;
  uploadedAt: Date;
  reviewNote: string | null;
};

type ReqRow = {
  id: string;
  country: Country;
  degree: Degree;
  documentName: string;
  sortOrder: number;
  isMandatory: boolean;
};

/** Build checklist items in-memory (no DB) from pre-fetched requirements + documents. */
export function buildChecklistItems(
  requirements: ReqRow[],
  documents: DocRow[],
  historyCounts?: Map<string, number>
): ChecklistItem[] {
  const counts =
    historyCounts ??
    (() => {
      const m = new Map<string, number>();
      for (const doc of documents) {
        const key = doc.requirementId ?? doc.documentType;
        m.set(key, (m.get(key) ?? 0) + 1);
      }
      return m;
    })();

  const currentByKey = new Map<string, DocRow>();
  for (const doc of documents) {
    if (!doc.isCurrent) continue;
    const key = doc.requirementId ?? doc.documentType;
    if (!currentByKey.has(key)) currentByKey.set(key, doc);
  }

  return requirements.map((req) => {
    const docType = documentTypeFromName(req.documentName);
    const current = currentByKey.get(req.id) ?? currentByKey.get(docType) ?? null;
    const status = current ? current.status : ("missing" as const);

    return {
      requirementId: req.id,
      documentName: req.documentName,
      documentType: docType,
      sortOrder: req.sortOrder,
      isMandatory: req.isMandatory,
      status,
      document: current
        ? {
            id: current.id,
            fileName: current.fileName,
            fileSize: current.fileSize,
            status: current.status,
            version: current.version,
            uploadedAt: current.uploadedAt,
            reviewNote: current.reviewNote,
          }
        : null,
      historyCount: counts.get(req.id) ?? counts.get(docType) ?? 0,
    };
  });
}

/**
 * Batch-load requirements for many country+degree pairs in one query.
 * Used by the approvals list to avoid N+1 round-trips.
 */
export async function getRequirementsForPairs(
  pairs: { country: Country; degree: Degree }[]
): Promise<ReqRow[]> {
  if (!pairs.length) return [];
  const unique = new Map<string, { country: Country; degree: Degree }>();
  for (const p of pairs) unique.set(`${p.country}:${p.degree}`, p);

  return prisma.documentRequirement.findMany({
    where: { OR: [...unique.values()] },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      country: true,
      degree: true,
      documentName: true,
      sortOrder: true,
      isMandatory: true,
    },
  });
}

/** Compute approval summary for one record using batched requirement data. */
export function summarizeRecordDocuments(
  country: Country | null,
  degree: Degree | null,
  documents: DocRow[],
  allRequirements: ReqRow[]
): ChecklistSummary {
  if (!country || !degree) return summarizeChecklist([]);
  const requirements = allRequirements.filter((r) => r.country === country && r.degree === degree);
  const items = buildChecklistItems(requirements, documents);
  return summarizeChecklist(items);
}

/** Aggregate version counts in SQL instead of loading every historical row. */
async function loadDocumentHistoryCounts(stageRecordId: string): Promise<Map<string, number>> {
  const [byRequirement, byType] = await Promise.all([
    prisma.document.groupBy({
      by: ["requirementId"],
      where: { stageRecordId, requirementId: { not: null } },
      _count: { _all: true },
    }),
    prisma.document.groupBy({
      by: ["documentType"],
      where: { stageRecordId },
      _count: { _all: true },
    }),
  ]);

  const counts = new Map<string, number>();
  for (const row of byRequirement) {
    if (row.requirementId) counts.set(row.requirementId, row._count._all);
  }
  for (const row of byType) {
    counts.set(row.documentType, row._count._all);
  }
  return counts;
}
