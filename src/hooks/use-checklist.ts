"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChecklistItemView,
  ChecklistSummaryView,
} from "@/components/documents/document-checklist";
import { ExtraDocView } from "@/components/documents/extra-docs-list";

type ChecklistState = {
  items: ChecklistItemView[];
  summary: ChecklistSummaryView | null;
  hasRequirements: boolean;
  extraDocuments: ExtraDocView[];
};

const emptyState: ChecklistState = {
  items: [],
  summary: null,
  hasRequirements: false,
  extraDocuments: [],
};

/**
 * Fetches document checklist data for a stage record.
 * Centralizes the repeated fetch/parse logic used on portal and record pages.
 */
export function useChecklist(stageRecordId: string | null | undefined) {
  const [state, setState] = useState<ChecklistState>(emptyState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!stageRecordId) {
      setState(emptyState);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/document-requirements/checklist?stageRecordId=${stageRecordId}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Could not load document checklist");
      }
      const checklist = await res.json();
      setState({
        items: checklist.items ?? [],
        summary: checklist.summary ?? null,
        hasRequirements: checklist.hasRequirements ?? false,
        extraDocuments: checklist.extraDocuments ?? [],
      });
    } catch (e) {
      setState(emptyState);
      setError(e instanceof Error ? e.message : "Could not load document checklist");
    } finally {
      setLoading(false);
    }
  }, [stageRecordId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, loading, error, reload };
}
