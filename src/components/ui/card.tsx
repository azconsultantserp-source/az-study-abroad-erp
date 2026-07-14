import { cn } from "@/lib/utils";
import Link from "next/link";
import { memo } from "react";

// Badge & StatCard render many times inside tables/lists; memo avoids
// re-running cn()/twMerge for unchanged props when a parent re-renders.
export const Badge = memo(function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("az-badge", className)}>{children}</span>;
});

export function Card({
  children,
  className,
  title,
  description,
  action,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("az-card overflow-hidden", className)}>
      {(title || action) && (
        <div className="az-glass-bar flex items-center justify-between gap-3 border-b border-line/40 px-6 py-4">
          <div className="min-w-0">
            {title && <h3 className="truncate text-lg font-bold text-heading">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-content-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}

export const StatCard = memo(function StatCard({
  title,
  value,
  icon,
  accent = "teal",
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: "teal" | "gold" | "blue" | "green";
  href?: string;
}) {
  const accents = {
    teal: "border-az-teal/20",
    gold: "border-az-gold/30",
    blue: "border-blue-200",
    green: "border-emerald-200",
  };
  const iconBg = {
    teal: "bg-az-teal/10 text-az-teal",
    gold: "bg-az-gold/20 text-az-gold-dark",
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-emerald-500/10 text-emerald-500",
  };

  const content = (
    <div className={cn("az-stat-card group", accents[accent])}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content-muted">{title}</p>
          <p className="mt-2 text-4xl font-extrabold tracking-tight text-heading tabular-nums">{value}</p>
        </div>
        <div className={cn("rounded-2xl p-4 transition-transform duration-200 group-hover:scale-105", iconBg[accent])}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        {content}
      </Link>
    );
  }
  return content;
});

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="az-enter flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/70 bg-surface/40 px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-az-teal/10 text-az-teal ring-1 ring-az-teal/15">
          {icon}
        </div>
      )}
      <p className="text-lg font-semibold text-heading">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-content-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="az-page-header az-enter mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-white/80">{description}</p>}
      </div>
      {action && <div className="relative z-10 shrink-0">{action}</div>}
    </div>
  );
}
