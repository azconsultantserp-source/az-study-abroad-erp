import { describe, it, expect } from "vitest";
import {
  getCountryLabel,
  getDegreeLabel,
  getStageFolderHref,
  COUNTRIES,
  DEGREES,
  STAGE_LABELS,
  NEXT_STAGE,
  PREV_STAGE,
  FEE_STATUS_LABELS,
  DOCUMENT_STATUS_LABELS,
} from "@/lib/constants";

describe("getCountryLabel", () => {
  it("maps a known country", () => {
    expect(getCountryLabel("ROMANIA")).toBe("Romania");
    expect(getCountryLabel("UNITED_KINGDOM")).toBe("United Kingdom");
  });

  it("returns em dash for null/undefined", () => {
    expect(getCountryLabel(null)).toBe("—");
    expect(getCountryLabel(undefined)).toBe("—");
  });

  it("falls back to the raw enum value when no label exists", () => {
    expect(getCountryLabel("IRELAND")).toBe("IRELAND");
  });
});

describe("getDegreeLabel", () => {
  it("maps known degrees", () => {
    expect(getDegreeLabel("BACHELORS")).toBe("Bachelor's");
    expect(getDegreeLabel("MASTERS")).toBe("Master's");
    expect(getDegreeLabel("PHD")).toBe("PhD");
  });

  it("returns em dash for null/undefined", () => {
    expect(getDegreeLabel(null)).toBe("—");
    expect(getDegreeLabel(undefined)).toBe("—");
  });

  it("falls back to the raw enum value when no label exists", () => {
    expect(getDegreeLabel("BACHELORS" as "BACHELORS")).toBe("Bachelor's");
    // Simulate a future enum value not yet in DEGREE_LABELS.
    expect(getDegreeLabel("ASSOCIATE" as "BACHELORS")).toBe("ASSOCIATE");
  });
});

describe("getStageFolderHref", () => {
  it("returns the folder route for each stage", () => {
    expect(getStageFolderHref("QUERY")).toBe("/students/query");
    expect(getStageFolderHref("ADMISSION")).toBe("/students/admission");
    expect(getStageFolderHref("VISA")).toBe("/students/visa");
    expect(getStageFolderHref("SATISFIED")).toBe("/students/satisfied");
  });
});

describe("constant tables", () => {
  it("Ireland is excluded from selectable countries", () => {
    expect(COUNTRIES.some((c) => c.value === "IRELAND")).toBe(false);
  });

  it("offers three degrees", () => {
    expect(DEGREES.map((d) => d.value)).toEqual(["BACHELORS", "MASTERS", "PHD"]);
  });

  it("labels every stage", () => {
    expect(Object.keys(STAGE_LABELS)).toEqual(["QUERY", "ADMISSION", "VISA", "SATISFIED"]);
  });

  it("NEXT_STAGE and PREV_STAGE are inverses", () => {
    expect(NEXT_STAGE.QUERY).toBe("ADMISSION");
    expect(PREV_STAGE.ADMISSION).toBe("QUERY");
    expect(NEXT_STAGE.VISA).toBe("SATISFIED");
    expect(PREV_STAGE.SATISFIED).toBe("VISA");
  });

  it("has fee + document status labels", () => {
    expect(FEE_STATUS_LABELS.PAID).toBe("Paid");
    expect(DOCUMENT_STATUS_LABELS.APPROVED).toBe("Approved");
  });
});
