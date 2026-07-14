import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, StatCard, Badge, EmptyState } from "@/components/ui/card";
import {
  MessageSquare,
  GraduationCap,
  Globe,
  CheckCircle,
  Users,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { STAGE_LABELS, STAGE_COLORS, getCountryLabel } from "@/lib/constants";
import { getSessionUser } from "@/lib/api-auth";
import { getDashboardData } from "@/lib/data";

const EMPTY_STATS = {
  queries: 0,
  admissions: 0,
  visas: 0,
  satisfied: 0,
  totalStudents: 0,
  pendingApprovals: 0,
};

type DashboardResult = {
  stats: typeof EMPTY_STATS;
  recentRecords: Awaited<ReturnType<typeof getDashboardData>>["recentRecords"];
  dbWarning?: string;
};

// Server Component: data is fetched on the server during render (no client
// fetch waterfall, no /api/dashboard round-trip, and no client JS for the
// data layer). The (dashboard)/loading.tsx boundary covers the async wait.
export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let result: DashboardResult;
  try {
    const data = await getDashboardData(user);
    result = data;
  } catch (error) {
    // Degrade gracefully if the schema is out of date rather than crashing.
    console.error("Dashboard data error:", error);
    result = {
      stats: EMPTY_STATS,
      recentRecords: [],
      dbWarning:
        "Database schema is out of date. Run: npx prisma db push --force-reset && npm run db:seed",
    };
  }

  const { stats, recentRecords, dbWarning } = result;

  return (
    <div>
      <div className="az-page-header az-enter mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">Dashboard</h1>
        <p className="mt-1 text-sm text-white/80">AZ Consultants — Study Abroad Overview</p>
      </div>

      {dbWarning && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Database needs updating</p>
            <p className="mt-1">{dbWarning}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Queries" value={stats.queries} icon={<MessageSquare className="h-7 w-7 text-az-gold" />} accent="gold" href="/students/query" />
        <StatCard title="Admission Processing" value={stats.admissions} icon={<GraduationCap className="h-7 w-7 text-az-teal" />} accent="teal" href="/students/admission" />
        <StatCard title="Visa Processing" value={stats.visas} icon={<Globe className="h-7 w-7 text-blue-600" />} accent="blue" href="/students/visa" />
        <StatCard title="Satisfied" value={stats.satisfied} icon={<CheckCircle className="h-7 w-7 text-emerald-600" />} accent="green" href="/students/satisfied" />
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <StatCard title="Total Students" value={stats.totalStudents} icon={<Users className="h-7 w-7 text-az-teal" />} accent="teal" href="/students/all" />
        {stats.pendingApprovals > 0 && (
          <StatCard title="Pending Approvals" value={stats.pendingApprovals} icon={<FileCheck className="h-7 w-7 text-az-gold" />} accent="gold" href="/approvals" />
        )}
      </div>

      <Card className="mt-8" title="Recent Activity" description="Latest student updates across all folders">
        {recentRecords.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title="No activity yet"
            description="Add your first student query to get started."
          />
        ) : (
          <div className="space-y-3">
            {recentRecords.map((record) => (
              <Link
                key={record.id}
                href={`/students/record/${record.id}`}
                className="az-activity-row no-underline"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-heading">{record.studentCase.fullName}</p>
                  <p className="truncate text-sm text-content-muted">
                    {getCountryLabel(record.country)}
                    {record.studentCase.email && ` · ${record.studentCase.email}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge className={STAGE_COLORS[record.stage]}>{STAGE_LABELS[record.stage]}</Badge>
                  <p className="mt-1 text-xs text-content-faint">{formatDate(record.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
