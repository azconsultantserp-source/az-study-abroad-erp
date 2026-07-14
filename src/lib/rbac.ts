import { Role, StudentStage } from "@prisma/client";

export type Permission =
  | "users:read"
  | "users:write"
  | "users:delete"
  | "students:read"
  | "students:write"
  | "students:delete"
  | "stages:read"
  | "stages:write"
  | "documents:read"
  | "documents:write"
  | "documents:approve"
  | "admin:access";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    "users:read",
    "users:write",
    "users:delete",
    "students:read",
    "students:write",
    "students:delete",
    "stages:read",
    "stages:write",
    "documents:read",
    "documents:write",
    "documents:approve",
    "admin:access",
  ],
  COUNSELOR: [
    "students:read",
    "students:write",
    "stages:read",
    "stages:write",
    "documents:read",
    "documents:write",
  ],
  STUDENT: ["documents:read", "documents:write", "stages:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  COUNSELOR: "Counselor",
  STUDENT: "Student",
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  children?: { href: string; label: string; stage?: StudentStage }[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    roles: [Role.ADMIN, Role.COUNSELOR],
  },
  {
    href: "/students",
    label: "Students",
    icon: "Users",
    roles: [Role.ADMIN, Role.COUNSELOR],
    children: [
      { href: "/students/query", label: "Queries", stage: "QUERY" },
      { href: "/students/admission", label: "Admission Processing", stage: "ADMISSION" },
      { href: "/students/visa", label: "Visa Processing", stage: "VISA" },
      { href: "/students/satisfied", label: "Satisfied", stage: "SATISFIED" },
      { href: "/students/all", label: "Total Students" },
    ],
  },
  {
    href: "/approvals",
    label: "Document Approvals",
    icon: "FileCheck",
    roles: [Role.ADMIN],
  },
  {
    href: "/admin",
    label: "User Management",
    icon: "Settings",
    roles: [Role.ADMIN],
  },
  {
    href: "/account",
    label: "My Account",
    icon: "KeyRound",
    roles: [Role.ADMIN, Role.COUNSELOR],
  },
  {
    href: "/my-portal",
    label: "My Portal",
    icon: "User",
    roles: [Role.STUDENT],
  },
];

export function getNavItemsForRole(role: Role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
