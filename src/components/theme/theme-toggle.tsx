"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** "sidebar" = light-on-dark (teal sidebar); "bar" = adapts to surface. */
  tone?: "sidebar" | "bar";
}

export function ThemeToggle({ className, tone = "bar" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: render a stable placeholder until mounted.
  useEffect(() => setMounted(true), []);

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2",
        tone === "sidebar"
          ? "text-white/75 hover:bg-white/10 hover:text-white focus-visible:ring-az-gold/50"
          : "text-content-muted hover:bg-surface/70 hover:text-brand focus-visible:ring-brand/40",
        className
      )}
    >
      {mounted && isDark ? (
        <Sun className="h-[18px] w-[18px]" aria-hidden="true" />
      ) : (
        <Moon className="h-[18px] w-[18px]" aria-hidden="true" />
      )}
    </button>
  );
}
