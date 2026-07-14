"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for debugging without exposing details to users.
    console.error(error);
  }, [error]);

  return (
    <div className="az-enter flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500 ring-1 ring-red-500/20">
        <AlertTriangle className="h-8 w-8" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-bold text-heading">Something went wrong</h2>
      <p className="max-w-md text-sm text-content-muted">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <Button onClick={reset} className="mt-2">
        <RotateCcw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
