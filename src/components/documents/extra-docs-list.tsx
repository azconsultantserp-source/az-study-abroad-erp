"use client";

import { FileText, Download } from "lucide-react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatFileSize } from "@/lib/utils";
import { DOCUMENT_STATUS_COLORS, DOCUMENT_STATUS_LABELS } from "@/lib/constants";
import { DocumentStatus } from "@prisma/client";

export type ExtraDocView = {
  id: string;
  fileName: string;
  fileSize: number;
  status: DocumentStatus;
  uploadedAt: string;
  reviewNote?: string | null;
};

interface ExtraDocsListProps {
  documents: ExtraDocView[];
  title?: string;
  showRejectionReason?: boolean;
}

export function ExtraDocsList({
  documents,
  title = "Other uploads",
  showRejectionReason = false,
}: ExtraDocsListProps) {
  if (!documents.length) return null;

  return (
    <div className="mt-6 border-t border-line/30 pt-4">
      <h4 className="mb-3 text-sm font-semibold text-heading">{title}</h4>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div key={doc.id} className="az-doc-row">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-az-teal" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-content">{doc.fileName}</p>
                <p className="text-xs text-content-faint">
                  {formatFileSize(doc.fileSize)} · {formatDate(doc.uploadedAt)}
                </p>
                {showRejectionReason && doc.reviewNote && doc.status === "REJECTED" && (
                  <p className="text-xs text-red-600 dark:text-red-400">Reason: {doc.reviewNote}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={DOCUMENT_STATUS_COLORS[doc.status]}>
                {DOCUMENT_STATUS_LABELS[doc.status]}
              </Badge>
              <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost" aria-label={`Download ${doc.fileName}`}>
                  <Download className="h-4 w-4" aria-hidden="true" />
                </Button>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
