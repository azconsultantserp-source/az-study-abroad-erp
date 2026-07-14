import { memo } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="az-table-wrap overflow-x-auto">
      <table className={cn("w-full text-left text-sm", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-az-teal/10 bg-gradient-to-r from-az-teal/5 to-az-teal/10 text-xs font-semibold uppercase tracking-wider text-az-teal-dark">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line-strong/50 bg-surface/40">{children}</tbody>;
}

// Memoized so typing in a sibling form (e.g. admin page) does not re-render
// every row in a 500–2000 row table.
export const TableRow = memo(function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={cn("transition-colors hover:bg-az-teal/[0.06]", className)}>{children}</tr>;
});

export function TableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-5 py-4", className)}>{children}</th>;
}

export const TableCell = memo(function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-5 py-4 text-content", className)}>{children}</td>;
});
