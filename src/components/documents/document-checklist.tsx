"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, AlertCircle } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { DOCUMENT_STATUS_COLORS, DOCUMENT_STATUS_LABELS } from "@/lib/constants";
import { DocumentStatus } from "@prisma/client";

export type ChecklistItemView = {
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
    uploadedAt: string;
    reviewNote: string | null;
  } | null;
  historyCount: number;
};

export type ChecklistSummaryView = {
  total: number;
  uploaded: number;
  approved: number;
  pending: number;
  rejected: number;
  missing: number;
  percentComplete: number;
};

interface DocumentChecklistProps {
  stageRecordId: string;
  items: ChecklistItemView[];
  summary: ChecklistSummaryView;
  hasRequirements: boolean;
  onUploadComplete?: () => void;
  showUpload?: boolean;
  compact?: boolean;
}

export function DocumentChecklist({
  stageRecordId,
  items,
  summary,
  hasRequirements,
  onUploadComplete,
  showUpload = true,
  compact = false,
}: DocumentChecklistProps) {
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  if (!hasRequirements) {
    return (
      <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
        Select a country and degree on this student record to see the required document checklist.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line/40 bg-surface/60 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-heading">Document progress</span>
          <span className="text-content-muted tabular-nums">
            {summary.approved}/{summary.total} approved
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-line-strong/60"
          role="progressbar"
          aria-valuenow={summary.percentComplete}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Document approval progress"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-az-teal to-emerald-500 transition-all"
            style={{ width: `${summary.percentComplete}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-content-muted">
          <span>{summary.pending} pending</span>
          <span>·</span>
          <span>{summary.rejected} rejected</span>
          <span>·</span>
          <span>{summary.missing} missing</span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <ChecklistRow
            key={item.requirementId}
            item={item}
            stageRecordId={stageRecordId}
            uploading={uploadingType === item.documentType}
            showUpload={showUpload}
            compact={compact}
            onUpload={async (file) => {
              setUploadingType(item.documentType);
              const formData = new FormData();
              formData.append("file", file);
              formData.append("stageRecordId", stageRecordId);
              formData.append("documentType", item.documentType);
              formData.append("requirementId", item.requirementId);
              const res = await fetch("/api/documents", { method: "POST", body: formData });
              setUploadingType(null);
              if (res.ok) onUploadComplete?.();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ChecklistRow({
  item,
  stageRecordId,
  uploading,
  showUpload,
  compact,
  onUpload,
}: {
  item: ChecklistItemView;
  stageRecordId: string;
  uploading: boolean;
  showUpload: boolean;
  compact: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const status = item.status;
  const statusColor =
    status === "missing"
      ? "bg-surface/70 text-content-muted ring-1 ring-line-strong/60"
      : DOCUMENT_STATUS_COLORS[status as DocumentStatus];
  const statusLabel =
    status === "missing" ? "Not uploaded" : DOCUMENT_STATUS_LABELS[status as DocumentStatus];

  return (
    <div
      className={`rounded-xl border border-line/30 bg-surface/50 p-4 transition-colors ${
        status === "REJECTED" ? "ring-1 ring-red-400/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-az-teal/10 text-xs font-semibold text-az-teal">
              {item.sortOrder}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-content">{item.documentName}</p>
              {item.document && !compact && (
                <p className="mt-0.5 truncate text-xs text-content-faint">
                  {item.document.fileName} · v{item.document.version} · {formatFileSize(item.document.fileSize)}
                </p>
              )}
              {status === "REJECTED" && item.document?.reviewNote && (
                <p className="mt-2 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {item.document.reviewNote}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColor}>{statusLabel}</Badge>
          {item.document && (
            <a href={`/api/documents/${item.document.id}/download`} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" aria-label="Download">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          )}
          {showUpload && (status === "missing" || status === "REJECTED") && (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button
                size="sm"
                variant={status === "REJECTED" ? "primary" : "outline"}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : status === "REJECTED" ? "Re-upload" : "Upload"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
