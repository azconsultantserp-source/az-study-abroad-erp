"use client";

import Image from "next/image";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { logoutToLogin } from "@/lib/logout";
import { LogOut } from "lucide-react";

export function StudentHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-az-teal-dark/90 via-az-teal/90 to-az-teal-light/90 px-6 py-3 shadow-lg backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="AZ Consultants" width={40} height={40} />
          <span className="text-sm font-bold tracking-wide text-white">AZ CONSULTANTS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <ThemeToggle tone="sidebar" />
          <button
            onClick={() => logoutToLogin()}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
