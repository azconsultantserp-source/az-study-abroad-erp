"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyRound, CheckCircle } from "lucide-react";

export default function AccountPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword: form.oldPassword, newPassword: form.newPassword }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError((data && data.error) || "Could not change password.");
      return;
    }

    setSuccess(true);
    setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="az-enter mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-az-teal/10 text-az-teal ring-1 ring-az-teal/15">
          <KeyRound className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">My Account</h1>
          <p className="text-content-muted">{session?.user?.email}</p>
        </div>
      </div>

      <Card title="Change Password" description="Enter your current password to set a new one.">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">{error}</div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-4 w-4" /> Password changed successfully.
            </div>
          )}

          <Input
            label="Current Password"
            type="password"
            value={form.oldPassword}
            onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
            autoComplete="current-password"
            required
          />
          <Input
            label="New Password"
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            required
          />
          <Input
            label="Confirm New Password"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            autoComplete="new-password"
            required
          />

          <p className="rounded-lg bg-az-teal/5 px-3 py-2 text-xs text-content-muted">
            Note: For account recovery, the administrator can also view and reset your password.
          </p>

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Update Password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
