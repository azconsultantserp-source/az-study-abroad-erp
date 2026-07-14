import { cn } from "@/lib/utils";

/** Shimmering placeholder block. Compose these to mirror real content. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("az-skeleton", className)} aria-hidden="true" />;
}

/** Card-shaped skeleton matching the StatCard footprint. */
export function StatCardSkeleton() {
  return (
    <div className="az-card p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-9 w-16" />
        </div>
        <Skeleton className="h-14 w-14 rounded-2xl" />
      </div>
    </div>
  );
}

/** Generic table skeleton with a header bar and N rows. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="az-table-wrap" role="status" aria-live="polite">
      <span className="sr-only">Loading data…</span>
      <div className="flex gap-4 border-b border-line-strong/50 bg-az-teal/[0.04] px-5 py-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-line-strong/40 bg-surface/40">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-4">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn("h-4", c === 0 ? "flex-[1.4]" : "flex-1")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** List of card-like rows (e.g. checklist / activity feeds). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-line/40 bg-surface/40 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
