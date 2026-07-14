import prisma from "@/lib/db";

export async function createDocumentNotification(params: {
  userId: string;
  type: "DOCUMENT_APPROVED" | "DOCUMENT_REJECTED";
  documentId: string;
  documentName: string;
  studentName: string;
  reviewNote?: string | null;
}) {
  const approved = params.type === "DOCUMENT_APPROVED";
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      documentId: params.documentId,
      title: approved ? "Document approved" : "Document rejected",
      message: approved
        ? `Your document "${params.documentName}" for ${params.studentName} was approved.`
        : `Your document "${params.documentName}" for ${params.studentName} was rejected.${params.reviewNote ? ` Reason: ${params.reviewNote}` : ""}`,
    },
  });
}
