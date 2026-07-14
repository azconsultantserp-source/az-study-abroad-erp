"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload } from "lucide-react";

interface GeneralUploadProps {
  stageRecordId: string;
  onUploaded?: () => void;
  /** Heading shown above the form. */
  title?: string;
  hint?: string;
}

/**
 * Free-form document upload: the user picks a file and gives it a name.
 * Used on the student portal and the counselor record page for documents that
 * are not part of the country/degree checklist.
 */
export function GeneralUpload({
  stageRecordId,
  onUploaded,
  title = "Upload another document",
  hint = "PDF, JPG, PNG, DOC — max 10MB. Give it a clear name so we know what it is.",
}: GeneralUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please choose a file first.");
      return;
    }
    setUploading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("stageRecordId", stageRecordId);
    if (name.trim()) formData.append("customName", name.trim());

    const res = await fetch("/api/documents", { method: "POST", body: formData });
    setUploading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Upload failed. Please try again.");
      return;
    }

    setName("");
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
    onUploaded?.();
  }

  return (
    <div className="az-upload-zone">
      <label className="mb-2 block text-sm font-semibold text-heading">{title}</label>
      {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <Input
        label="Document name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Bank Statement, Sponsor Letter"
      />

      <div className="mt-3">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          className="az-file-input"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
        />
      </div>
      <p className="mb-3 mt-2 text-xs text-content-faint">{hint}</p>

      <Button type="button" size="sm" disabled={uploading} onClick={handleUpload}>
        <Upload className="h-4 w-4" /> {uploading ? "Uploading..." : "Upload"}
      </Button>
      {fileName && <span className="ml-2 text-xs text-content-muted">{fileName}</span>}
    </div>
  );
}
