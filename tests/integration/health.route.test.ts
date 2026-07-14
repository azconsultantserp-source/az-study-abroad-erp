import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  default: { $queryRaw: vi.fn() },
}));

import prisma from "@/lib/db";
import { GET } from "@/app/api/health/route";

const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>;

describe("GET /api/health", () => {
  beforeEach(() => queryRaw.mockReset());

  it("returns 200 ok when the database responds", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTypeOf("string");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 503 degraded when the database query throws", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection closed"));
    const res = await GET();
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe("degraded");
  });
});
