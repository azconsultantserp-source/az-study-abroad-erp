import { describe, it, expect } from "vitest";
import {
  parsePagination,
  paginated,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/lib/pagination";

function sp(obj: Record<string, string>) {
  return new URLSearchParams(obj);
}

describe("parsePagination", () => {
  it("uses defaults when params are missing", () => {
    const r = parsePagination(sp({}));
    expect(r).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      skip: 0,
      take: DEFAULT_PAGE_SIZE,
    });
  });

  it("respects a custom default size", () => {
    const r = parsePagination(sp({}), 10);
    expect(r.pageSize).toBe(10);
    expect(r.take).toBe(10);
  });

  it("parses page and pageSize and computes skip", () => {
    const r = parsePagination(sp({ page: "3", pageSize: "20" }));
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(20);
    expect(r.skip).toBe(40);
    expect(r.take).toBe(20);
  });

  it("clamps page to a minimum of 1", () => {
    expect(parsePagination(sp({ page: "0" })).page).toBe(1);
    expect(parsePagination(sp({ page: "-5" })).page).toBe(1);
  });

  it("clamps pageSize to MAX_PAGE_SIZE", () => {
    expect(parsePagination(sp({ pageSize: "9999" })).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it("treats a zero pageSize as the default (0 is falsy)", () => {
    expect(parsePagination(sp({ pageSize: "0" })).pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("clamps a negative pageSize to a minimum of 1", () => {
    expect(parsePagination(sp({ pageSize: "-1" })).pageSize).toBe(1);
  });

  it("falls back to defaults for non-numeric input", () => {
    const r = parsePagination(sp({ page: "abc", pageSize: "xyz" }));
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe("paginated", () => {
  it("wraps items with metadata", () => {
    const r = paginated([1, 2, 3], 55, 2, 20);
    expect(r).toEqual({
      items: [1, 2, 3],
      page: 2,
      pageSize: 20,
      total: 55,
      totalPages: 3,
    });
  });

  it("returns at least 1 total page even with 0 items", () => {
    expect(paginated([], 0, 1, 20).totalPages).toBe(1);
  });

  it("rounds partial pages up", () => {
    expect(paginated([], 21, 1, 20).totalPages).toBe(2);
  });
});
