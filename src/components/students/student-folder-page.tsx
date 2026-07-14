"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import dynamic from "next/dynamic";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";

const Modal = dynamic(() => import("@/components/ui/modal").then((m) => m.Modal));
import { Plus, ArrowRight, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  STAGE_LABELS,
  STAGE_DESCRIPTIONS,
  STAGE_COLORS,
  COUNTRIES,
  DEGREES,
  FEE_STATUS_LABELS,
  FEE_STATUS_COLORS,
  MOVE_ACTION_LABELS,
  MOVE_BACK_ACTION_LABELS,
  NEXT_STAGE,
  PREV_STAGE,
  getCountryLabel,
} from "@/lib/constants";
import { ConsultancyFeeStatus, Country, Degree, StudentStage } from "@prisma/client";

interface StageRecord {
  id: string;
  stage: StudentStage;
  country: Country | null;
  degree: Degree | null;
  program: string | null;
  intake: string | null;
  notes: string | null;
  consultancyFeeStatus: ConsultancyFeeStatus;
  updatedAt: string;
  studentCase: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    nationality: string | null;
    counselor: { name: string } | null;
  };
  _count: { documents: number };
}

interface StudentFolderPageProps {
  stage: StudentStage;
  showAddButton?: boolean;
}

const emptyForm = {
  fullName: "",
  email: "",
  phone: "",
  nationality: "",
  country: "" as Country | "",
  degree: "" as Degree | "",
  program: "",
  intake: "",
  university: "",
  notes: "",
  consultancyFeeStatus: "NOT_PAID" as ConsultancyFeeStatus,
  consultancyFeeNote: "",
};

export function StudentFolderPage({ stage, showAddButton = false }: StudentFolderPageProps) {
  const [records, setRecords] = useState<StageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);
  const [movingDir, setMovingDir] = useState<"forward" | "backward" | null>(null);

  useEffect(() => {
    fetchRecords();
  }, [stage]);

  async function fetchRecords() {
    const res = await fetch(`/api/stages?stage=${stage}&pageSize=200`);
    if (res.ok) {
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : (data.items ?? []));
    }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        country: form.country || undefined,
        degree: form.degree || undefined,
        university: form.university || undefined,
        email: form.email || undefined,
      }),
    });

    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to add student");
      return;
    }

    setShowAdd(false);
    setForm(emptyForm);
    fetchRecords();
  }

  async function handleMove(recordId: string, direction: "forward" | "backward") {
    if (
      direction === "backward" &&
      !confirm(`Move this student back to ${STAGE_LABELS[PREV_STAGE[stage]!]}?`)
    ) {
      return;
    }
    setMovingId(recordId);
    setMovingDir(direction);
    const res = await fetch("/api/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId, direction }),
    });
    setMovingId(null);
    setMovingDir(null);
    if (res.ok) fetchRecords();
  }

  return (
    <div>
      <PageHeader title={STAGE_LABELS[stage]} description={STAGE_DESCRIPTIONS[stage]} />

      <div className="mb-6 flex justify-end">
        {showAddButton && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add Student to Query
          </Button>
        )}
      </div>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} cols={8} />
        ) : records.length === 0 ? (
          <EmptyState
            title={`No students in ${STAGE_LABELS[stage]}`}
            description={showAddButton ? "Add a new student query to get started" : undefined}
            action={showAddButton ? <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" /> Add Student</Button> : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Fee Status</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <Link href={`/students/record/${record.id}`} className="font-medium text-az-teal hover:text-az-teal-light">
                      {record.studentCase.fullName}
                    </Link>
                    {record.studentCase.phone && (
                      <p className="text-xs text-content-faint">{record.studentCase.phone}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-az-teal/10 text-az-teal">
                      {record.studentCase.counselor?.name || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{getCountryLabel(record.country)}</TableCell>
                  <TableCell>{record.program || "—"}</TableCell>
                  <TableCell>
                    <Badge className={FEE_STATUS_COLORS[record.consultancyFeeStatus]}>
                      {FEE_STATUS_LABELS[record.consultancyFeeStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>{record._count.documents}</TableCell>
                  <TableCell>{formatDate(record.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/students/record/${record.id}`}>
                        <Button size="sm" variant="outline">Open</Button>
                      </Link>
                      {PREV_STAGE[stage] && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMove(record.id, "backward")}
                          disabled={movingId === record.id}
                          title={MOVE_BACK_ACTION_LABELS[stage]}
                        >
                          <ArrowLeft className="h-3 w-3" />
                          {movingId === record.id && movingDir === "backward" ? "Moving..." : "Back"}
                        </Button>
                      )}
                      {NEXT_STAGE[stage] && (
                        <Button
                          size="sm"
                          onClick={() => handleMove(record.id, "forward")}
                          disabled={movingId === record.id}
                          title={MOVE_ACTION_LABELS[stage]}
                        >
                          {movingId === record.id && movingDir === "forward" ? "Moving..." : "Move"}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New Student Query">
        <form onSubmit={handleAdd} className="space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</div>}

          <Input label="Full Name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <Input label="Nationality" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />

          <Select
            label="Preferred Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value as Country })}
            options={[{ value: "", label: "Add later (decide later)" }, ...COUNTRIES]}
          />

          <Select
            label="Degree"
            value={form.degree}
            onChange={(e) => setForm({ ...form, degree: e.target.value as Degree })}
            options={[{ value: "", label: "Add later" }, ...DEGREES]}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Program" value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} placeholder="e.g. MSc Computer Science" />
            <Input label="Intake" value={form.intake} onChange={(e) => setForm({ ...form, intake: e.target.value })} placeholder="e.g. September 2026" />
          </div>

          <Input label="University (optional)" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} placeholder="Target university" />

          <Select
            label="Consultancy Fee Status"
            value={form.consultancyFeeStatus}
            onChange={(e) => setForm({ ...form, consultancyFeeStatus: e.target.value as ConsultancyFeeStatus })}
            options={[
              { value: "NOT_PAID", label: "Not Paid" },
              { value: "HALF_PAID", label: "Half Paid" },
              { value: "PAID", label: "Paid" },
            ]}
          />

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-heading">Fee Note (optional)</label>
            <textarea
              value={form.consultancyFeeNote}
              onChange={(e) => setForm({ ...form, consultancyFeeNote: e.target.value })}
              className="az-input"
              rows={2}
              placeholder="Any notes about consultancy fee payment..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-heading">Counselor Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="az-input"
              rows={3}
              placeholder="Write anything about this student..."
            />
          </div>

          <p className="rounded-lg bg-az-teal/5 px-3 py-2 text-xs text-content-muted">
            Note: Student portal logins are created by the Admin from User Management. Counselors add queries only.
          </p>

          <div className="flex justify-end gap-3 border-t border-line-strong/60 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Adding..." : "Add to Queries"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
