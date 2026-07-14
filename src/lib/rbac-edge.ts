import type { AppRole } from "@/lib/auth.config";

export function canAccessRoute(role: AppRole, route: string): boolean {
  if (route.startsWith("/admin")) return role === "ADMIN";
  if (route.startsWith("/students")) return role === "ADMIN" || role === "COUNSELOR";
  if (route.startsWith("/my-portal")) return role === "STUDENT";
  if (route.startsWith("/approvals")) return role === "ADMIN";
  return true;
}
