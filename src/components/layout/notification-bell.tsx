"use client";

import { useEffect, useState, useRef } from "react";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function load() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Position the panel relative to the viewport so it escapes any narrow /
  // overflow-clipped ancestor (e.g. the fixed w-72 sidebar footer) and always
  // opens into visible space, flipping above/below and clamping to the edges.
  useEffect(() => {
    if (!open) return;

    function updatePosition() {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const margin = 8;
      const panelWidth = Math.min(320, window.innerWidth - margin * 2);
      const panelMaxHeight = 384;

      let left = rect.left;
      if (left + panelWidth > window.innerWidth - margin) {
        left = window.innerWidth - margin - panelWidth;
      }
      if (left < margin) left = margin;

      let top = rect.bottom + margin;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceBelow < panelMaxHeight + margin && spaceAbove > spaceBelow) {
        top = rect.top - margin - panelMaxHeight;
      }
      if (top < margin) top = margin;
      if (top + panelMaxHeight > window.innerHeight - margin) {
        top = Math.max(margin, window.innerHeight - margin - panelMaxHeight);
      }

      setCoords({ top, left });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    load();
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-az-gold px-1 text-[10px] font-bold text-az-teal-dark">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="az-glass-card fixed z-[60] w-[calc(100vw-1rem)] max-w-[20rem] overflow-hidden rounded-xl shadow-2xl"
          style={{
            top: coords?.top ?? -9999,
            left: coords?.left ?? -9999,
            visibility: coords ? "visible" : "hidden",
          }}
        >
          <div className="flex items-center justify-between border-b border-line-strong/50 px-4 py-3">
            <p className="text-sm font-semibold text-heading">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-az-teal hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-content-muted">No notifications</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`border-b border-line-strong/40 px-4 py-3 text-sm transition-colors ${
                    !n.read ? "bg-az-teal/5" : ""
                  }`}
                >
                  <p className="font-medium text-heading">{n.title}</p>
                  <p className="mt-0.5 text-xs text-content-muted">{n.message}</p>
                  <p className="mt-1 text-[10px] text-content-faint">{formatDate(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
