import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const h = vi.hoisted(() => ({
  session: { user: { id: "admin1", name: "Admin", email: "a@x.com", role: "ADMIN" } } as
    | { user: { id: string; name: string; email: string; role: string } }
    | null,
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => h.session) }));

vi.mock("@/lib/db", () => ({
  default: {
    studentStageRecord: { findUnique: vi.fn(), update: vi.fn() },
    studentCase: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

// React.cache dedupes per-request; make it an identity wrapper outside a render.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import prisma from "@/lib/db";
import * as apiAuth from "@/lib/api-auth";
import { GET, PATCH } from "@/app/api/stages/[id]/route";

const findUnique = prisma.studentStageRecord.findUnique as unknown as ReturnType<typeof vi.fn>;
const stageUpdate = prisma.studentStageRecord.update as unknown as ReturnType<typeof vi.fn>;
const caseUpdate = prisma.studentCase.update as unknown as ReturnType<typeof vi.fn>;
const transaction = prisma.$transaction as unknown as ReturnType<typeof vi.fn>;

const RECORD = {
  id: "rec1",
  caseId: "case1",
  studentCase: { id: "case1", counselorId: "c1", userId: null as string | null },
};

function patchReq(body: unknown, ip = "1.1.1.1") {
  return new NextRequest("http://localhost:3000/api/stages/rec1", {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "rec1" }) };

beforeEach(() => {
  h.session = { user: { id: "admin1", name: "Admin", email: "a@x.com", role: "ADMIN" } };
  findUnique.mockReset();
  stageUpdate.mockReset();
  caseUpdate.mockReset();
  transaction.mockReset();
  transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma));
  stageUpdate.mockResolvedValue({ id: "rec1", studentCase: { fullName: "Bob" } });
  caseUpdate.mockResolvedValue({});
});

describe("GET /api/stages/[id]", () => {
  it("returns the record for staff", async () => {
    findUnique.mockResolvedValueOnce({ ...RECORD, stage: "QUERY" });
    const res = await GET({} as never, params);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("rec1");
  });

  it("returns 404 when the record is missing", async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await GET({} as never, params);
    expect(res.status).toBe(404);
  });

  it("returns 403 when a student reads another student's case", async () => {
    h.session = { user: { id: "stu1", name: "S", email: "s@x.com", role: "STUDENT" } };
    findUnique.mockResolvedValueOnce({
      ...RECORD,
      studentCase: { ...RECORD.studentCase, userId: "otherStudent" },
    });
    const res = await GET({} as never, params);
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    h.session = null;
    const res = await GET({} as never, params);
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/stages/[id]", () => {
  it("updates the passport number on the linked student case", async () => {
    findUnique.mockResolvedValueOnce(RECORD);
    const res = await PATCH(patchReq({ passportNumber: "AB1234567", university: "Oxford" }), params);
    expect(res.status).toBe(200);
    expect(caseUpdate).toHaveBeenCalledWith({
      where: { id: "case1" },
      data: { passportNumber: "AB1234567" },
    });
    expect(stageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rec1" },
        data: expect.objectContaining({ university: "Oxford" }),
      })
    );
  });

  it("clears the passport number when given an empty string", async () => {
    findUnique.mockResolvedValueOnce(RECORD);
    await PATCH(patchReq({ passportNumber: "" }, "1.1.1.2"), params);
    expect(caseUpdate).toHaveBeenCalledWith({
      where: { id: "case1" },
      data: { passportNumber: null },
    });
  });

  it("does not touch the case when passport is omitted", async () => {
    findUnique.mockResolvedValueOnce(RECORD);
    await PATCH(patchReq({ university: "Cambridge" }, "1.1.1.3"), params);
    expect(caseUpdate).not.toHaveBeenCalled();
    expect(stageUpdate).toHaveBeenCalled();
  });

  it("returns 404 when the record is missing", async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(patchReq({ university: "X" }, "1.1.1.4"), params);
    expect(res.status).toBe(404);
  });

  it("returns 403 when a student attempts to write", async () => {
    h.session = { user: { id: "stu1", name: "S", email: "s@x.com", role: "STUDENT" } };
    const res = await PATCH(patchReq({ university: "X" }, "1.1.1.5"), params);
    expect(res.status).toBe(403);
  });

  it("returns 403 when case access is denied", async () => {
    const spy = vi.spyOn(apiAuth, "canAccessCase").mockReturnValue(false);
    findUnique.mockResolvedValueOnce(RECORD);
    const res = await PATCH(patchReq({ university: "X" }, "1.1.1.7"), params);
    expect(res.status).toBe(403);
    spy.mockRestore();
  });

  it("returns 403 for a cross-site origin", async () => {
    const bad = new NextRequest("http://localhost:3000/api/stages/rec1", {
      method: "PATCH",
      headers: { origin: "https://evil.com", "content-type": "application/json" },
      body: JSON.stringify({ university: "X" }),
    });
    findUnique.mockResolvedValueOnce(RECORD);
    const res = await PATCH(bad, params);
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid enum input", async () => {
    findUnique.mockResolvedValueOnce(RECORD);
    const res = await PATCH(patchReq({ country: "ATLANTIS" }, "1.1.1.6"), params);
    expect(res.status).toBe(422);
  });
});
