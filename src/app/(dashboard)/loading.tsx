import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Loading page…</span>

      {/* Page header placeholder */}
      <div className="az-page-header mb-8">
        <Skeleton className="h-7 w-56 bg-white/25" />
        <Skeleton className="mt-2 h-4 w-80 bg-white/20" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Content table */}
      <div className="az-card p-6">
        <Skeleton className="mb-5 h-5 w-40" />
        <TableSkeleton rows={6} cols={4} />
      </div>
    </div>
  );
}
