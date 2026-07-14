"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import dynamic from "next/dynamic";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

// Modals are only rendered on user interaction — load their code on demand.
const Modal = dynamic(() => import("@/components/ui/modal").then((m) => m.Modal));
import { Plus, Trash2, Shield, KeyRound, GraduationCap, UserPlus, Eye, EyeOff, FileSpreadsheet } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/rbac";
import { Role } from "@prisma/client";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  plainPassword: string | null;
}

interface StudentCaseRecord {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  userId: string | null;
  createdAt: string;
  counselor: { name: string } | null;
  user: { id: string; email: string; isActive: boolean; plainPassword: string | null } | null;
  stageRecords: { stage: string }[];
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [cases, setCases] = useState<StudentCaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [importingReqs, setImportingReqs] = useState(false);

  const toggleReveal = (id: string) =>
    setRevealed((r) => ({ ...r, [id]: !r[id] }));

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) {
        alert("Could not generate the Excel export. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `AZ_Students_Export_${stamp}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Network error while exporting. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImportRequirements(file?: File) {
    setImportingReqs(true);
    try {
      const res = file
        ? await fetch("/api/admin/document-requirements/import", {
            method: "POST",
            body: (() => {
              const fd = new FormData();
              fd.append("file", file);
              return fd;
            })(),
          })
        : await fetch("/api/admin/document-requirements/import", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Import failed");
        return;
      }
      alert(`Imported ${data.count} document requirements.`);
    } catch {
      alert("Network error during import.");
    } finally {
      setImportingReqs(false);
    }
  }

  // Staff create
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "COUNSELOR" as Role });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Password change (staff or student)
  const [pwTarget, setPwTarget] = useState<{ id: string; name: string; scope: "staff" | "student" } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  // Student portal create
  const [showPortal, setShowPortal] = useState(false);
  const [portalForm, setPortalForm] = useState({ caseId: "", name: "", email: "", password: "" });
  const [portalSaving, setPortalSaving] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [uRes, cRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/student-portals"),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (cRes.ok) setCases(await cRes.json());
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed");
      return;
    }
    setShowCreate(false);
    setForm({ name: "", email: "", password: "", role: "COUNSELOR" });
    fetchAll();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return;
    await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    fetchAll();
  }

  async function toggleActive(id: string, isActive: boolean) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchAll();
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwTarget) return;
    setPwSaving(true);
    setPwError("");
    const url = pwTarget.scope === "student" ? "/api/admin/student-portals" : "/api/admin/users";
    const body =
      pwTarget.scope === "student"
        ? { userId: pwTarget.id, password: newPassword }
        : { id: pwTarget.id, password: newPassword };
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPwSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setPwError(data.error || "Failed to change password");
      return;
    }
    setPwTarget(null);
    setNewPassword("");
  }

  function openCreatePortal(c?: StudentCaseRecord) {
    setPortalError("");
    setPortalForm({
      caseId: c?.id || "",
      name: c?.fullName || "",
      email: c?.email || "",
      password: "",
    });
    setShowPortal(true);
  }

  async function handleCreatePortal(e: React.FormEvent) {
    e.preventDefault();
    setPortalSaving(true);
    setPortalError("");
    const res = await fetch("/api/admin/student-portals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(portalForm),
    });
    setPortalSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setPortalError(data.error || "Failed to create portal");
      return;
    }
    setShowPortal(false);
    setPortalForm({ caseId: "", name: "", email: "", password: "" });
    fetchAll();
  }

  async function deletePortal(userId: string, name: string) {
    if (!confirm(`Delete portal login for ${name}? The student's query data is kept.`)) return;
    await fetch(`/api/admin/student-portals?userId=${userId}`, { method: "DELETE" });
    fetchAll();
  }

  const casesWithoutPortal = useMemo(() => cases.filter((c) => !c.userId), [cases]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-az-teal" />
          <div>
            <h1 className="text-2xl font-bold text-heading tracking-tight">Admin Control Center</h1>
            <p className="text-content-muted">Manage staff, student portals, and passwords</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={importingReqs}
            onClick={() => handleImportRequirements()}
          >
            {importingReqs ? "Importing..." : "Import Doc Requirements (CSV)"}
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportRequirements(file);
                e.target.value = "";
              }}
            />
            <span className="az-btn az-btn-outline inline-flex items-center gap-2 px-4 py-2 text-sm">
              Upload New CSV
            </span>
          </label>
          <Button onClick={handleExport} disabled={exporting}>
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? "Preparing..." : "Download Students Excel"}
          </Button>
        </div>
      </div>

      {/* STAFF ACCOUNTS */}
      <Card
        title="Staff Accounts"
        description="Admins & counselors. Only admins can add, reset passwords, or permanently delete users."
        action={
          <Button size="sm" onClick={() => { setError(""); setShowCreate(true); }}>
            <Plus className="h-4 w-4" /> Add User
          </Button>
        }
      >
        {loading ? (
          <p className="py-12 text-center text-content-muted">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleReveal(user.id)}
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-content hover:text-az-teal"
                      aria-label={revealed[user.id] ? "Hide password" : "Show password"}
                    >
                      {revealed[user.id] ? (user.plainPassword || "—") : "••••••••"}
                      {revealed[user.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </TableCell>
                  <TableCell><Badge className="bg-az-teal/10 text-az-teal">{ROLE_LABELS[user.role]}</Badge></TableCell>
                  <TableCell>
                    <Badge className={user.isActive ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-red-500/15 text-red-700 dark:text-red-300"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setPwError(""); setNewPassword(""); setPwTarget({ id: user.id, name: user.name, scope: "staff" }); }}>
                        <KeyRound className="h-4 w-4" /> Password
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleActive(user.id, user.isActive)}>
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDelete(user.id, user.name)} aria-label={`Delete ${user.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* STUDENT PORTALS */}
      <Card
        title="Student Portal Accounts"
        description="Create a portal login for a student from their query. Counselors cannot create portals."
        action={
          <Button size="sm" onClick={() => openCreatePortal()} disabled={casesWithoutPortal.length === 0}>
            <UserPlus className="h-4 w-4" /> Create Portal
          </Button>
        }
      >
        {loading ? (
          <p className="py-12 text-center text-content-muted">Loading…</p>
        ) : cases.length === 0 ? (
          <p className="py-12 text-center text-content-muted">No student queries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Counselor</TableHead>
                <TableHead>Portal Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.fullName}</TableCell>
                  <TableCell>
                    <Badge className="bg-az-gold/15 text-az-teal-dark">
                      {c.stageRecords[0]?.stage || "QUERY"}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.counselor?.name || "—"}</TableCell>
                  <TableCell>
                    {c.user ? (
                      <div className="space-y-1">
                        <span className="block text-sm text-content">{c.user.email}</span>
                        <button
                          type="button"
                          onClick={() => toggleReveal(c.user!.id)}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-content-muted hover:text-az-teal"
                          aria-label={revealed[c.user.id] ? "Hide password" : "Show password"}
                        >
                          {revealed[c.user.id] ? (c.user.plainPassword || "—") : "••••••••"}
                          {revealed[c.user.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <Badge className="bg-surface/70 text-content-muted">No portal</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.user ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setPwError(""); setNewPassword(""); setPwTarget({ id: c.user!.id, name: c.fullName, scope: "student" }); }}>
                          <KeyRound className="h-4 w-4" /> Password
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => deletePortal(c.user!.id, c.fullName)}>
                          <Trash2 className="h-4 w-4" /> Portal
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => openCreatePortal(c)}>
                        <GraduationCap className="h-4 w-4" /> Create Portal
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add staff modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Staff User">
        <form onSubmit={handleCreate} className="space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
          <Input label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            options={[
              { value: "ADMIN", label: "Administrator" },
              { value: "COUNSELOR", label: "Counselor" },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create User"}</Button>
          </div>
        </form>
      </Modal>

      {/* Change password modal */}
      <Modal isOpen={!!pwTarget} onClose={() => setPwTarget(null)} title={`Change Password — ${pwTarget?.name || ""}`}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwError && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{pwError}</div>}
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setPwTarget(null)}>Cancel</Button>
            <Button type="submit" disabled={pwSaving}>{pwSaving ? "Saving..." : "Update Password"}</Button>
          </div>
        </form>
      </Modal>

      {/* Create student portal modal */}
      <Modal isOpen={showPortal} onClose={() => setShowPortal(false)} title="Create Student Portal">
        <form onSubmit={handleCreatePortal} className="space-y-4">
          {portalError && <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">{portalError}</div>}
          <Select
            label="Choose Student (from queries)"
            value={portalForm.caseId}
            onChange={(e) => {
              const c = cases.find((x) => x.id === e.target.value);
              setPortalForm({
                ...portalForm,
                caseId: e.target.value,
                name: c?.fullName || portalForm.name,
                email: c?.email || portalForm.email,
              });
            }}
            options={[
              { value: "", label: "Select a student..." },
              ...casesWithoutPortal.map((c) => ({
                value: c.id,
                label: `${c.fullName}${c.email ? ` (${c.email})` : ""}`,
              })),
            ]}
          />
          <Input label="Student Name" value={portalForm.name} onChange={(e) => setPortalForm({ ...portalForm, name: e.target.value })} required />
          <Input label="Login Email (Student ID)" type="email" value={portalForm.email} onChange={(e) => setPortalForm({ ...portalForm, email: e.target.value })} required />
          <Input label="Password" type="password" value={portalForm.password} onChange={(e) => setPortalForm({ ...portalForm, password: e.target.value })} placeholder="At least 6 characters" required />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowPortal(false)}>Cancel</Button>
            <Button type="submit" disabled={portalSaving || !portalForm.caseId}>{portalSaving ? "Creating..." : "Create Portal"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
