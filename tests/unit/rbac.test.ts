import { describe, it, expect } from "vitest";
import { Role } from "@prisma/client";
import {
  hasPermission,
  getNavItemsForRole,
  ROLE_LABELS,
  NAV_ITEMS,
} from "@/lib/rbac";

describe("hasPermission", () => {
  it("grants admins every permission", () => {
    expect(hasPermission(Role.ADMIN, "users:delete")).toBe(true);
    expect(hasPermission(Role.ADMIN, "documents:approve")).toBe(true);
    expect(hasPermission(Role.ADMIN, "admin:access")).toBe(true);
  });

  it("limits counselors to student/stage/document scope", () => {
    expect(hasPermission(Role.COUNSELOR, "students:write")).toBe(true);
    expect(hasPermission(Role.COUNSELOR, "documents:write")).toBe(true);
    expect(hasPermission(Role.COUNSELOR, "documents:approve")).toBe(false);
    expect(hasPermission(Role.COUNSELOR, "admin:access")).toBe(false);
    expect(hasPermission(Role.COUNSELOR, "users:read")).toBe(false);
  });

  it("limits students to their own documents/stages", () => {
    expect(hasPermission(Role.STUDENT, "documents:read")).toBe(true);
    expect(hasPermission(Role.STUDENT, "documents:write")).toBe(true);
    expect(hasPermission(Role.STUDENT, "stages:read")).toBe(true);
    expect(hasPermission(Role.STUDENT, "stages:write")).toBe(false);
    expect(hasPermission(Role.STUDENT, "students:read")).toBe(false);
  });

  it("returns false for an unknown role", () => {
    expect(hasPermission("UNKNOWN" as Role, "users:read")).toBe(false);
  });
});

describe("ROLE_LABELS", () => {
  it("has a human label for every role", () => {
    expect(ROLE_LABELS.ADMIN).toBe("Administrator");
    expect(ROLE_LABELS.COUNSELOR).toBe("Counselor");
    expect(ROLE_LABELS.STUDENT).toBe("Student");
  });
});

describe("getNavItemsForRole", () => {
  it("gives admins the management items", () => {
    const hrefs = getNavItemsForRole(Role.ADMIN).map((i) => i.href);
    expect(hrefs).toContain("/admin");
    expect(hrefs).toContain("/approvals");
    expect(hrefs).not.toContain("/my-portal");
  });

  it("hides admin-only items from counselors", () => {
    const hrefs = getNavItemsForRole(Role.COUNSELOR).map((i) => i.href);
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).not.toContain("/admin");
    expect(hrefs).not.toContain("/approvals");
  });

  it("shows students only their portal", () => {
    const items = getNavItemsForRole(Role.STUDENT);
    expect(items.map((i) => i.href)).toEqual(["/my-portal"]);
  });

  it("every nav item declares at least one role", () => {
    for (const item of NAV_ITEMS) {
      expect(item.roles.length).toBeGreaterThan(0);
    }
  });
});
