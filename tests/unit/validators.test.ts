import { describe, it, expect } from "vitest";
import {
  loginSchema,
  createUserSchema,
  updateAdminUserSchema,
  createStudentQuerySchema,
  createStudentPortalSchema,
  changePasswordSchema,
  changeOwnPasswordSchema,
  updateStageRecordSchema,
  moveStageSchema,
  documentApprovalSchema,
  typedDocumentUploadSchema,
  zipDocumentsSchema,
  markNotificationsSchema,
} from "@/lib/validators";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "secret1" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "secret1" }).success).toBe(false);
  });

  it("rejects a short password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });
});

describe("createUserSchema", () => {
  it("accepts a valid staff user", () => {
    const r = createUserSchema.safeParse({
      name: "Jane",
      email: "jane@x.com",
      password: "secret1",
      role: "ADMIN",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const r = createUserSchema.safeParse({
      name: "Jane",
      email: "jane@x.com",
      password: "secret1",
      role: "SUPERUSER",
    });
    expect(r.success).toBe(false);
  });
});

describe("updateAdminUserSchema", () => {
  it("accepts an isActive-only update", () => {
    expect(updateAdminUserSchema.safeParse({ id: "u1", isActive: false }).success).toBe(true);
  });

  it("accepts a password-only update", () => {
    expect(updateAdminUserSchema.safeParse({ id: "u1", password: "secret1" }).success).toBe(true);
  });

  it("rejects when neither isActive nor password provided", () => {
    expect(updateAdminUserSchema.safeParse({ id: "u1" }).success).toBe(false);
  });
});

describe("createStudentQuerySchema", () => {
  it("requires a name of at least 2 chars", () => {
    expect(createStudentQuerySchema.safeParse({ fullName: "A" }).success).toBe(false);
    expect(createStudentQuerySchema.safeParse({ fullName: "Al" }).success).toBe(true);
  });

  it("allows an empty-string email", () => {
    expect(
      createStudentQuerySchema.safeParse({ fullName: "Alice", email: "" }).success
    ).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(
      createStudentQuerySchema.safeParse({ fullName: "Alice", email: "bad" }).success
    ).toBe(false);
  });

  it("accepts optional passport and enum fields", () => {
    const r = createStudentQuerySchema.safeParse({
      fullName: "Alice",
      passportNumber: "AB123",
      country: "ROMANIA",
      degree: "MASTERS",
      consultancyFeeStatus: "PAID",
    });
    expect(r.success).toBe(true);
  });
});

describe("createStudentPortalSchema", () => {
  it("accepts a valid portal creation", () => {
    const r = createStudentPortalSchema.safeParse({
      caseId: "c1",
      name: "Bob",
      email: "bob@x.com",
      password: "secret1",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing caseId", () => {
    const r = createStudentPortalSchema.safeParse({
      caseId: "",
      name: "Bob",
      email: "bob@x.com",
      password: "secret1",
    });
    expect(r.success).toBe(false);
  });
});

describe("password schemas", () => {
  it("changePasswordSchema requires userId + 6-char password", () => {
    expect(changePasswordSchema.safeParse({ userId: "u1", password: "secret1" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ userId: "u1", password: "x" }).success).toBe(false);
  });

  it("changeOwnPasswordSchema requires current + new", () => {
    expect(
      changeOwnPasswordSchema.safeParse({ oldPassword: "x", newPassword: "secret1" }).success
    ).toBe(true);
    expect(
      changeOwnPasswordSchema.safeParse({ oldPassword: "", newPassword: "secret1" }).success
    ).toBe(false);
  });
});

describe("updateStageRecordSchema", () => {
  it("accepts a passportNumber field", () => {
    expect(updateStageRecordSchema.safeParse({ passportNumber: "AB1234567" }).success).toBe(true);
  });

  it("accepts an empty object (all optional)", () => {
    expect(updateStageRecordSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an invalid country enum", () => {
    expect(updateStageRecordSchema.safeParse({ country: "MARS" }).success).toBe(false);
  });
});

describe("moveStageSchema", () => {
  it("defaults direction to forward", () => {
    const r = moveStageSchema.parse({ recordId: "r1" });
    expect(r.direction).toBe("forward");
  });

  it("accepts backward direction", () => {
    expect(moveStageSchema.safeParse({ recordId: "r1", direction: "backward" }).success).toBe(true);
  });

  it("rejects an unknown direction", () => {
    expect(moveStageSchema.safeParse({ recordId: "r1", direction: "sideways" }).success).toBe(false);
  });
});

describe("documentApprovalSchema", () => {
  it("accepts APPROVED / REJECTED", () => {
    expect(documentApprovalSchema.safeParse({ status: "APPROVED" }).success).toBe(true);
    expect(documentApprovalSchema.safeParse({ status: "REJECTED" }).success).toBe(true);
  });

  it("rejects other statuses", () => {
    expect(documentApprovalSchema.safeParse({ status: "PENDING" }).success).toBe(false);
  });
});

describe("typedDocumentUploadSchema", () => {
  it("requires stageRecordId + documentType", () => {
    expect(
      typedDocumentUploadSchema.safeParse({ stageRecordId: "s1", documentType: "passport" }).success
    ).toBe(true);
    expect(typedDocumentUploadSchema.safeParse({ stageRecordId: "", documentType: "" }).success).toBe(
      false
    );
  });
});

describe("zipDocumentsSchema", () => {
  it("requires at least one id", () => {
    expect(zipDocumentsSchema.safeParse({ documentIds: [] }).success).toBe(false);
    expect(zipDocumentsSchema.safeParse({ documentIds: ["d1"] }).success).toBe(true);
  });

  it("rejects more than 100 ids", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `d${i}`);
    expect(zipDocumentsSchema.safeParse({ documentIds: ids }).success).toBe(false);
  });
});

describe("markNotificationsSchema", () => {
  it("accepts markAllRead", () => {
    expect(markNotificationsSchema.safeParse({ markAllRead: true }).success).toBe(true);
  });

  it("accepts a list of ids", () => {
    expect(markNotificationsSchema.safeParse({ ids: ["n1"] }).success).toBe(true);
  });

  it("rejects an empty request", () => {
    expect(markNotificationsSchema.safeParse({}).success).toBe(false);
    expect(markNotificationsSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
