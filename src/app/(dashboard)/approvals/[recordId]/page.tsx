"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, X } from "lucide-react";
import {
  DocumentChecklist,
  ChecklistItemView,
  ChecklistSummaryView,
} from "@/components/documents/document-checklist";
import { getCountryLabel, getDegreeLabel, STAGE_LABELS } from "@/lib/constants";
import { Country, Degree, StudentStage } from "@prisma/client";

type RecordInfo = {
  id: string;
  stage: StudentStage;
  country: Country | null;
  degree: Degree | null;
  studentCase: { fullName: string };
};

export default function ApprovalDetailPage() {
  const params = useParams();
  const recordId = params.recordId as string;
  const [record, setRecord] = useState<RecordInfo | null>(null);
  const [items, setItems] = useState<ChecklistItemView[]>([]);
  const [summary, setSummary] = useState<ChecklistSummaryView | null>(null);
  const [hasRequirements, setHasRequirements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  async function load() {
    const [recordRes, checklistRes] = await Promise.all([
      fetch(`/api/stages/${recordId}`),
      fetch(`/api/document-requirements/checklist?stageRecordId=${recordId}`),
    ]);

    if (recordRes.ok) setRecord(await recordRes.json());
    if (checklistRes.ok) {
      const data = await checklistRes.json();
      setItems(data.items);
      setSummary(data.summary);
      setHasRequirements(data.hasRequirements);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [recordId]);

  async function handleApproval(documentId: string, status: "APPROVED" | "REJECTED", reviewNote?: string) {
    setProcessing(documentId);
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote }),
    });
    setProcessing(null);
    setRejectId(null);
    setRejectNote("");
    if (res.ok) load();
  }

  if (loading) return <p className="py-20 text-center text-content-muted" role="status">Loading…</p>;
  if (!record) return <p className="py-20 text-center text-red-500">Record not found</p>;

  return (
    <div>
      <Link href="/approvals" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-az-teal transition-colors hover:text-az-teal-light">
        <ArrowLeft className="h-4 w-4" /> Back to approvals
      </Link>

      <div className="az-enter mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-heading">{record.studentCase.fullName}</h1>
        <p className="text-content-muted">
          {STAGE_LABELS[record.stage]} · {getCountryLabel(record.country)}
          {record.degree && ` · ${getDegreeLabel(record.degree)}`}
        </p>
      </div>

      <Card title="Required Documents">
        {summary && (
          <DocumentChecklist
            stageRecordId={recordId}
            items={items}
            summary={summary}
            hasRequirements={hasRequirements}
            showUpload={false}
            onUploadComplete={load}
          />
        )}

        <div className="mt-6 space-y-3">
          {items
            .filter((item) => item.document?.status === "PENDING_APPROVAL")
            .map((item) => (
              <div key={item.requirementId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-content">{item.documentName}</p>
                  <p className="truncate text-xs text-content-muted">{item.document?.fileName}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => item.document && handleApproval(item.document.id, "APPROVED")}
                    disabled={processing === item.document?.id}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => item.document && setRejectId(item.document.id)}
                    disabled={processing === item.document?.id}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
        </div>

        {rejectId && (
          <div className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 p-4">
            <label className="mb-2 block text-sm font-semibold text-red-700 dark:text-red-300">Rejection reason</label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              className="az-input mb-3"
              rows={2}
              placeholder="Explain what needs to be fixed..."
            />
            <div className="flex gap-2">
              <Button size="sm" variant="danger" onClick={() => handleApproval(rejectId, "REJECTED", rejectNote)}>
                Confirm Reject
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setRejectId(null); setRejectNote(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
