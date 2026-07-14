"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { logoutToLogin } from "@/lib/logout";

const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes of no activity
const REFRESH_THROTTLE_MS = 60 * 1000; // extend the session at most once/min

/**
 * Signs the user out after 10 minutes without any interaction, and keeps the
 * session token refreshed while the user is active so they aren't logged out
 * mid-work. Server-side, the JWT also expires after 10 minutes as a backstop.
 */
export function IdleLogout() {
  const { update } = useSession();
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefresh = useRef<number>(0);

  useEffect(() => {
    function logout() {
      void logoutToLogin("/login?reason=timeout");
    }

    function onActivity() {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(logout, IDLE_LIMIT_MS);

      // Refresh the JWT window on activity (throttled) so it keeps extending.
      const now = Date.now();
      if (now - lastRefresh.current > REFRESH_THROTTLE_MS) {
        lastRefresh.current = now;
        void update();
      }
    }

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });

    // Start the countdown immediately on mount.
    idleTimer.current = setTimeout(logout, IDLE_LIMIT_MS);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      for (const e of events) window.removeEventListener(e, onActivity);
    };
  }, [update]);

  return null;
}
