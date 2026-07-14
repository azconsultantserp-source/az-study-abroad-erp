"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  MessageSquare,
  GraduationCap,
  Globe,
  CheckCircle,
  FileCheck,
  User,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getNavItemsForRole, ROLE_LABELS } from "@/lib/rbac";
import { Role } from "@prisma/client";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutToLogin } from "@/lib/logout";
import { useState } from "react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  Settings,
  FileCheck,
  User,
  KeyRound,
  MessageSquare,
  GraduationCap,
  Globe,
  CheckCircle,
};

interface SidebarProps {
  user: { name: string; email: string; role: Role };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studentsOpen, setStudentsOpen] = useState(pathname.startsWith("/students"));
  const navItems = getNavItemsForRole(user.role);

  const NavContent = () => (
    <>
      <div className="border-b border-az-teal-light/30 px-5 py-5">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="AZ Consultants" width={48} height={48} className="rounded-lg" />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-white">AZ CONSULTANTS</h1>
            <p className="text-[10px] text-az-gold/90">Foreign Education Consultants</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;

          if (item.children) {
            const isActive = pathname.startsWith(item.href);
            return (
              <div key={item.href}>
                <button
                  onClick={() => setStudentsOpen(!studentsOpen)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-az-teal-light text-az-gold" : "text-white/80 hover:bg-az-teal-light/50 hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", studentsOpen && "rotate-180")} />
                </button>
                {studentsOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-az-gold/30 pl-3">
                    {item.children.map((child) => {
                      const ChildIcon = child.stage ? ICON_MAP[child.stage === "QUERY" ? "MessageSquare" : child.stage === "ADMISSION" ? "GraduationCap" : child.stage === "VISA" ? "Globe" : "CheckCircle"] : Users;
                      const childActive = pathname === child.href;
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                            childActive
                              ? "bg-az-gold/20 font-medium text-az-gold"
                              : "text-white/70 hover:bg-az-teal-light/30 hover:text-white"
                          )}
                        >
                          {child.stage && <ChildIcon className="h-4 w-4" />}
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-az-teal-light text-az-gold shadow-sm"
                  : "text-white/80 hover:bg-az-teal-light/50 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-az-teal-light/30 p-4">
        <div className="mb-3 flex items-center justify-between">
          <NotificationBell />
          <ThemeToggle tone="sidebar" />
        </div>
        <div className="mb-3 rounded-lg bg-az-teal-light/30 px-3 py-2">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-az-gold/80">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          onClick={() => logoutToLogin()}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-az-teal-light/50 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        className="fixed left-4 top-4 z-50 rounded-lg bg-az-teal p-2 text-white lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-gradient-to-b from-az-teal/95 via-az-teal to-az-teal-dark/95 shadow-2xl backdrop-blur-xl transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
