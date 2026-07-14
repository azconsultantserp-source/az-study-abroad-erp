"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton, ListSkeleton } from "@/components/ui/skeleton";
import { FileCheck, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getCountryLabel, getDegreeLabel, STAGE_LABELS } from "@/lib/constants";
import { Country, Degree, StudentStage } from "@prisma/client";

type ApprovalCard = {
  recordId: string;
  caseId: string;
  studentName: string;
  email: string | null;
  country: Country | null;
  degree: Degree | null;
  stage: StudentStage;
  updatedAt: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalRequired: number;
  percentComplete: number;
};

export default function ApprovalsPage() {
  const [cards, setCards] = useState<ApprovalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/approvals")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Could not load approvals");
        }
        return r.json();
      })
      .then(setCards)
      .catch((e) => {
        setCards([]);
        setError(e instanceof Error ? e.message : "Could not load approvals");
      })
      .finally(() => setLoading(false));
  }, []);

  const pendingTotal = cards.reduce((sum, c) => sum + c.pendingCount, 0);

  return (
    <div>
      <div className="az-enter mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-heading">Document Approvals</h1>
        <p className="mt-1 text-content-muted">
          Review student document checklists — {pendingTotal} document(s) awaiting approval
        </p>
      </div>

      {error && (
        <Card className="mb-4 border-red-400/40">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
          <Button
            className="mt-3"
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="az-card p-6">
              <ListSkeleton rows={1} />
              <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
              <Skeleton className="mt-3 h-5 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : !error && cards.length === 0 ? (
        <EmptyState
          icon={<FileCheck className="h-6 w-6" aria-hidden="true" />}
          title="All caught up!"
          description="No student documents to review right now."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.recordId} href={`/approvals/${card.recordId}`} className="group">
              <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:ring-2 hover:ring-az-teal/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-heading">{card.studentName}</h3>
                    <p className="text-xs text-content-muted">
                      {getCountryLabel(card.country)}
                      {card.degree && ` · ${getDegreeLabel(card.degree)}`}
                    </p>
                    <Badge className="mt-2 bg-az-teal/10 text-az-teal">
                      {STAGE_LABELS[card.stage]}
                    </Badge>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-content-faint transition-transform group-hover:translate-x-0.5 group-hover:text-az-teal" aria-hidden="true" />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-content-muted">
                    <span>{card.approvedCount}/{card.totalRequired} approved</span>
                    <span className="font-semibold tabular-nums">{card.percentComplete}%</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-line-strong/60"
                    role="progressbar"
                    aria-valuenow={card.percentComplete}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${card.studentName} document progress`}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-az-teal to-emerald-500 transition-all"
                      style={{ width: `${card.percentComplete}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  {card.pendingCount > 0 && (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300">{card.pendingCount} pending</Badge>
                  )}
                  {card.rejectedCount > 0 && (
                    <Badge className="bg-red-500/15 text-red-700 dark:text-red-300">{card.rejectedCount} rejected</Badge>
                  )}
                  <span className="text-content-faint">Updated {formatDate(card.updatedAt)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
