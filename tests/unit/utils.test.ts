import { describe, it, expect } from "vitest";
import { cn, formatDate, formatFileSize } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("dedupes conflicting tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("supports conditional object syntax", () => {
    expect(cn({ a: true, b: false }, "c")).toBe("a c");
  });
});

describe("formatDate", () => {
  it("returns em dash for null/undefined/empty", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("")).toBe("—");
  });

  it("formats a Date to en-GB dd Mon yyyy", () => {
    expect(formatDate(new Date("2026-07-13T00:00:00Z"))).toBe("13 Jul 2026");
  });

  it("formats an ISO string", () => {
    expect(formatDate("2026-01-05T12:00:00Z")).toBe("05 Jan 2026");
  });
});

describe("formatFileSize", () => {
  it("formats bytes under 1KB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes with one decimal", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes with one decimal", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
