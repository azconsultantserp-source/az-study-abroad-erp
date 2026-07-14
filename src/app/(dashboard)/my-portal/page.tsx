"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Card, Badge } from "@/components/ui/card";
import { CheckCircle, Globe, GraduationCap, MessageSquare } from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  STAGE_LABELS,
  getCountryLabel,
  getDegreeLabel,
} from "@/lib/constants";
import {
  DocumentChecklist,
} from "@/components/documents/document-checklist";
import { ExtraDocsList } from "@/components/documents/extra-docs-list";
import { GeneralUpload } from "@/components/documents/general-upload";
import { useChecklist } from "@/hooks/use-checklist";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";
import { DocumentStatus, StudentStage } from "@prisma/client";

interface PortalData {
  case: { fullName: string; id: string } | null;
  currentStage: { stage: StudentStage; label: string; recordId: string } | null;
  timeline: {
    stage: StudentStage;
    label: string;
    status: string;
    country: string | null;
    degree: string | null;
    program: string | null;
    createdAt: string;
    isActive: boolean;
    documents: { id: string; fileName: string; status: DocumentStatus; uploadedAt: string; reviewNote: string | null }[];
  }[];
  message?: string;
}

const STAGE_ICONS = {
  QUERY: MessageSquare,
  ADMISSION: GraduationCap,
  VISA: Globe,
  SATISFIED: CheckCircle,
};

export default function StudentPortalPage() {
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const recordId = data?.currentStage?.recordId ?? null;
  const {
    items: checklistItems,
    summary: checklistSummary,
    hasRequirements,
    extraDocuments: extraDocs,
    reload: reloadChecklist,
  } = useChecklist(recordId);

  const loadPortal = useCallback(async () => {
    const res = await fetch("/api/my-portal");
    const d = await res.json().catch(() => null);
    if (!res.ok || !d) {
      setData({ case: null, currentStage: null, timeline: [], message: "Could not load your portal." });
      return;
    }
    setData(d);
  }, []);

  const refreshAll = useCallback(async () => {
    await loadPortal();
    await reloadChecklist();
  }, [loadPortal, reloadChecklist]);

  useEffect(() => {
    loadPortal().finally(() => setLoading(false));
  }, [loadPortal]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3.5 w-56" />
          </div>
        </div>
        <div className="az-card p-6"><ListSkeleton rows={1} /></div>
        <div className="az-card p-6"><ListSkeleton rows={4} /></div>
      </div>
    );
  }

  if (!data?.case) {
    return (
      <div className="az-enter flex flex-col items-center justify-center py-20 text-center">
        <Image src="/logo.png" alt="AZ Consultants" width={120} height={120} className="mb-6 rounded-2xl" />
        <h1 className="text-xl font-bold text-heading">Welcome to AZ Consultants</h1>
        <p className="mt-2 text-content-muted">{data?.message || "Your application is being set up."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center gap-4">
        <Image src="/logo.png" alt="AZ Consultants" width={56} height={56} className="rounded-xl" />
        <div>
          <h1 className="text-xl font-bold text-heading">AZ Consultants</h1>
          <p className="text-sm text-content-muted">Student Portal — {data.case.fullName}</p>
        </div>
      </div>

      {data.currentStage && (
        <Card className="mb-6" title="Your Current Status">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-az-teal/10 p-4">
              {(() => {
                const Icon = STAGE_ICONS[data.currentStage!.stage];
                return <Icon className="h-8 w-8 text-az-teal" />;
              })()}
            </div>
            <div>
              <p className="text-lg font-semibold text-heading">{data.currentStage.label}</p>
              <p className="text-sm text-content-muted">Your application is currently in this stage</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6" title="Application Progress">
        <div className="relative">
          {data.timeline.map((step, index) => {
            const Icon = STAGE_ICONS[step.stage];
            const isCompleted = step.status === "MOVED" || (step.isActive && step.stage === "SATISFIED");
            const isCurrent = step.isActive;

            return (
              <div key={index} className="flex gap-4 pb-8 last:pb-0">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      isCurrent
                        ? "bg-az-gold text-az-teal-dark"
                        : isCompleted
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-surface/70 text-content-faint ring-1 ring-line-strong/60"
                    }`}
                  >
                    {isCompleted && !isCurrent ? <CheckCircle className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  {index < data.timeline.length - 1 && (
                    <div className={`mt-1 w-0.5 flex-1 ${isCompleted ? "bg-emerald-400/60" : "bg-line-strong/60"}`} />
                  )}
                </div>
                <div className="flex-1 pb-2">
                  <p
                    className={`font-medium ${
                      isCurrent ? "text-heading" : isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-content-faint"
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.country && (
                    <p className="text-sm text-content-muted">
                      {getCountryLabel(step.country as "GERMANY")}
                      {step.degree && ` · ${getDegreeLabel(step.degree as "BACHELORS")}`}
                      {step.program && ` · ${step.program}`}
                    </p>
                  )}
                  {isCurrent && <Badge className="mt-1 bg-az-gold/20 text-az-teal-dark dark:text-az-gold">In Progress</Badge>}
                  {step.status === "MOVED" && (
                    <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Completed · {formatDate(step.createdAt)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {data.currentStage && (
        <Card
          className="mb-6"
          title="Upload Documents"
          description="Upload your required documents below. You can also add any other document with your own name."
        >
          {checklistSummary && hasRequirements ? (
            <DocumentChecklist
              stageRecordId={data.currentStage.recordId}
              items={checklistItems}
              summary={checklistSummary}
              hasRequirements={hasRequirements}
              onUploadComplete={refreshAll}
            />
          ) : (
            <p className="mb-4 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              Your counselor is setting up your country and degree. You can still upload documents below with a name.
            </p>
          )}

          <div className="mt-6 border-t border-line/30 pt-6">
            <GeneralUpload
              stageRecordId={data.currentStage.recordId}
              onUploaded={refreshAll}
              title="Upload another document"
              hint="Name your file (e.g. Bank Statement) then choose the file. PDF, JPG, PNG, DOC — max 10MB."
            />
          </div>

          <ExtraDocsList
            documents={extraDocs}
            title="Your other uploads"
            showRejectionReason
          />
        </Card>
      )}

      <p className="mt-8 text-center text-xs text-content-faint">AZ Consultants — Foreign Education Consultants</p>
    </div>
  );
}
