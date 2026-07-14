"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Archive, ArrowRight, Trash2,
} from "lucide-react";

const Modal = dynamic(() => import("@/components/ui/modal").then((m) => m.Modal));
import { formatDate } from "@/lib/utils";
import {
  STAGE_LABELS, STAGE_COLORS, COUNTRIES, DEGREES, FEE_STATUS_LABELS, FEE_STATUS_COLORS,
  MOVE_ACTION_LABELS, MOVE_BACK_ACTION_LABELS, NEXT_STAGE, PREV_STAGE,
  getCountryLabel, getDegreeLabel, getStageFolderHref,
} from "@/lib/constants";
import { ConsultancyFeeStatus, Country, Degree, DocumentStatus, StudentStage } from "@prisma/client";
import { DocumentChecklist } from "@/components/documents/document-checklist";
import { ExtraDocsList } from "@/components/documents/extra-docs-list";
import { GeneralUpload } from "@/components/documents/general-upload";
import { useChecklist } from "@/hooks/use-checklist";

interface RecordDetail {
  id: string;
  stage: StudentStage;
  status: string;
  country: Country | null;
  degree: Degree | null;
  program: string | null;
  intake: string | null;
  university: string | null;
  notes: string | null;
  consultancyFeeStatus: ConsultancyFeeStatus;
  consultancyFeeNote: string | null;
  createdAt: string;
  studentCase: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    address: string | null;
    passportNumber: string | null;
    counselor: { name: string } | null;
  };
  documents: {
    id: string;
    fileName: string;
    fileSize: number;
    status: DocumentStatus;
    uploadedAt: string;
    reviewNote: string | null;
    uploadedBy: { name: string; role: string };
  }[];
}

export default function StudentRecordPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const recordId = typeof params.id === "string" ? params.id : params.id?.[0] ?? "";
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const {
    items: checklistItems,
    summary: checklistSummary,
    hasRequirements,
    extraDocuments: extraDocs,
    reload: reloadChecklist,
  } = useChecklist(recordId);
  const [form, setForm] = useState({
    country: "" as Country | "",
    degree: "" as Degree | "",
    program: "",
    intake: "",
    university: "",
    passportNumber: "",
    notes: "",
    consultancyFeeStatus: "NOT_PAID" as ConsultancyFeeStatus,
    consultancyFeeNote: "",
  });
  const [moving, setMoving] = useState<"forward" | "backward" | null>(null);
  const [showZip, setShowZip] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    fetchRecord();
  }, [recordId]);

  async function fetchRecord() {
    const recordRes = await fetch(`/api/stages/${recordId}`);
    if (recordRes.ok) {
      const data = await recordRes.json();
      setRecord(data);
      setForm({
        country: data.country || "",
        degree: data.degree || "",
        program: data.program || "",
        intake: data.intake || "",
        university: data.university || "",
        passportNumber: data.studentCase?.passportNumber || "",
        notes: data.notes || "",
        consultancyFeeStatus: data.consultancyFeeStatus,
        consultancyFeeNote: data.consultancyFeeNote || "",
      });
    }
    setLoading(false);
  }

  async function refreshRecord() {
    await fetchRecord();
    await reloadChecklist();
  }

  async function handleSave() {
    const res = await fetch(`/api/stages/${recordId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        country: form.country || undefined,
        degree: form.degree || undefined,
        university: form.university || undefined,
      }),
    });
    if (res.ok) { setEditing(false); refreshRecord(); }
  }

  async function handleMove(direction: "forward" | "backward") {
    if (!record) return;
    if (
      direction === "backward" &&
      !confirm(`Move this student back to ${STAGE_LABELS[PREV_STAGE[record.stage]!]}?`)
    ) {
      return;
    }
    setMoving(direction);
    const res = await fetch("/api/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: record.id, direction }),
    });
    setMoving(null);
    if (res.ok) {
      const data = await res.json();
      router.push(`/students/record/${data.id}`);
    }
  }

  async function handleZip() {
    if (selectedDocs.length === 0) return;
    setZipping(true);
    try {
      const res = await fetch("/api/documents/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: selectedDocs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Could not create ZIP. Make sure documents are approved and files exist on the server.");
        return;
      }
      const blob = await res.blob();
      if (blob.type === "application/json") {
        alert("ZIP download failed — files may not be available on this server.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${record?.studentCase.fullName.replace(/\s+/g, "_")}_documents.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setShowZip(false);
      setSelectedDocs([]);
    } finally {
      setZipping(false);
    }
  }

  function openZipModal() {
    setSelectedDocs(approvedDocs.map((d) => d.id));
    setShowZip(true);
  }

  async function handleDeleteStudent() {
    if (!record || !confirm("Permanently delete this student? Only admins can do this.")) return;
    const res = await fetch(`/api/students/${record.studentCase.id}`, { method: "DELETE" });
    if (res.ok) router.push("/students/all");
  }

  if (loading) return <p className="py-20 text-center text-content-muted">Loading…</p>;
  if (!record) return <p className="py-20 text-center text-red-500">Record not found</p>;

  const folderHref = record ? getStageFolderHref(record.stage) : "/students/all";

  const approvedDocs = record.documents.filter((d) => d.status === "APPROVED");

  return (
    <div>
      <Link href={folderHref} className="mb-4 inline-flex items-center gap-1 text-sm text-az-teal hover:text-az-teal-light">
        <ArrowLeft className="h-4 w-4" /> Back to {STAGE_LABELS[record.stage]}
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-heading tracking-tight">{record.studentCase.fullName}</h1>
            <Badge className={STAGE_COLORS[record.stage]}>{STAGE_LABELS[record.stage]}</Badge>
          </div>
          <p className="mt-1 text-content-muted">
            {getCountryLabel(record.country)}
            {record.degree && ` · ${getDegreeLabel(record.degree)}`}
            {record.program && ` · ${record.program}`}
            {record.intake && ` · ${record.intake}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          {PREV_STAGE[record.stage] && record.status === "ACTIVE" && (
            <Button variant="outline" onClick={() => handleMove("backward")} disabled={!!moving}>
              <ArrowLeft className="h-4 w-4" />
              {moving === "backward" ? "Moving..." : MOVE_BACK_ACTION_LABELS[record.stage]}
            </Button>
          )}
          {NEXT_STAGE[record.stage] && record.status === "ACTIVE" && (
            <Button onClick={() => handleMove("forward")} disabled={!!moving}>
              {moving === "forward" ? "Moving..." : MOVE_ACTION_LABELS[record.stage]}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {isAdmin && (
            <Button variant="danger" size="sm" onClick={handleDeleteStudent} aria-label="Delete student permanently">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Student Information">
          {editing ? (
            <div className="space-y-4">
              <Select label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value as Country })} options={[{ value: "", label: "Add later (decide later)" }, ...COUNTRIES]} />
              <Select label="Degree" value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value as Degree })} options={[{ value: "", label: "Add later" }, ...DEGREES]} />
              <Input label="Program" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
              <Input label="Intake" value={form.intake} onChange={(e) => setForm({ ...form, intake: e.target.value })} />
              <Input label="University" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
              <Input label="Passport Number" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} placeholder="e.g. AB1234567" />
              <Select label="Consultancy Fee" value={form.consultancyFeeStatus} onChange={(e) => setForm({ ...form, consultancyFeeStatus: e.target.value as ConsultancyFeeStatus })} options={Object.entries(FEE_STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Fee Note</label>
                <textarea value={form.consultancyFeeNote} onChange={(e) => setForm({ ...form, consultancyFeeNote: e.target.value })} className="az-input" rows={2} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-content">Counselor Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="az-input" rows={4} placeholder="Write anything about this student..." />
              </div>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-content-muted">Email</dt><dd className="font-medium">{record.studentCase.email || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Phone</dt><dd className="font-medium">{record.studentCase.phone || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Nationality</dt><dd className="font-medium">{record.studentCase.nationality || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Passport</dt><dd className="font-medium">{record.studentCase.passportNumber || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Country</dt><dd className="font-medium">{getCountryLabel(record.country)}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Degree</dt><dd className="font-medium">{getDegreeLabel(record.degree)}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">University</dt><dd className="font-medium">{record.university || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Consultancy Fee</dt>
                <dd><Badge className={FEE_STATUS_COLORS[record.consultancyFeeStatus]}>{FEE_STATUS_LABELS[record.consultancyFeeStatus]}</Badge></dd>
              </div>
              {record.consultancyFeeNote && (
                <div><dt className="text-content-muted mb-1">Fee Note</dt><dd className="rounded bg-surface/50 p-2 text-content">{record.consultancyFeeNote}</dd></div>
              )}
              {record.notes && (
                <div><dt className="text-content-muted mb-1">Counselor Notes</dt><dd className="rounded bg-amber-500/10 p-3 text-content whitespace-pre-wrap">{record.notes}</dd></div>
              )}
              <div className="flex justify-between"><dt className="text-content-muted">Counselor</dt><dd className="font-medium">{record.studentCase.counselor?.name || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-content-muted">Added</dt><dd className="font-medium">{formatDate(record.createdAt)}</dd></div>
            </dl>
          )}
        </Card>

        <Card
          title="Required Documents"
          description={checklistSummary ? `${checklistSummary.approved}/${checklistSummary.total} approved` : undefined}
          action={
            approvedDocs.length > 0 ? (
              <Button size="sm" variant="outline" onClick={openZipModal}>
                <Archive className="h-4 w-4" /> Download ZIP
              </Button>
            ) : undefined
          }
        >
          {checklistSummary && (
            <DocumentChecklist
              stageRecordId={record.id}
              items={checklistItems}
              summary={checklistSummary}
              hasRequirements={hasRequirements}
              onUploadComplete={refreshRecord}
            />
          )}

          <div className="mt-6 border-t border-line/30 pt-6">
            <GeneralUpload
              stageRecordId={record.id}
              onUploaded={refreshRecord}
              title="Upload another document"
              hint="Name the document, then choose the file. PDF, JPG, PNG, DOC — max 10MB."
            />
          </div>

          <ExtraDocsList documents={extraDocs} />
        </Card>
      </div>

      <Modal isOpen={showZip} onClose={() => { setShowZip(false); setSelectedDocs([]); }} title="Create ZIP Archive">
        <p className="mb-4 text-sm text-content-muted">Select approved documents to include in the ZIP:</p>
        <div className="max-h-60 space-y-2 overflow-y-auto">
          {approvedDocs.map((doc) => (
            <label key={doc.id} className="az-doc-row cursor-pointer gap-3">
              <input
                type="checkbox"
                checked={selectedDocs.includes(doc.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDocs([...selectedDocs, doc.id]);
                  else setSelectedDocs(selectedDocs.filter((id) => id !== doc.id));
                }}
                className="rounded border-slate-300 text-az-teal"
              />
              <span className="text-sm">{doc.fileName}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowZip(false)}>Cancel</Button>
          <Button onClick={handleZip} disabled={selectedDocs.length === 0 || zipping}>
            <Archive className="h-4 w-4" /> {zipping ? "Creating..." : `Download ZIP (${selectedDocs.length})`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
