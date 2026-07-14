import { describe, it, expect } from "vitest";
import { writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Country, Degree } from "@prisma/client";
import {
  expandDocumentNames,
  documentTypeFromName,
  parseDocumentRequirementsCsv,
  parseDocumentRequirementsFile,
} from "@/lib/parse-document-requirements";

describe("expandDocumentNames", () => {
  it("returns a single cleaned name for a plain document", () => {
    expect(expandDocumentNames("Passport")).toEqual(["Passport"]);
  });

  it("strips a leading numbering prefix", () => {
    expect(expandDocumentNames("1. Passport")).toEqual(["Passport"]);
    expect(expandDocumentNames("2 Birth Certificate")).toEqual(["Birth Certificate"]);
  });

  it('splits documents joined with "+"', () => {
    expect(expandDocumentNames("Birth Certificate + B-Form")).toEqual([
      "Birth Certificate",
      "B-Form",
    ]);
  });

  it('expands a trailing quantity "(2)" into numbered slots and singularizes', () => {
    expect(expandDocumentNames("Recommendation Letters (2)")).toEqual([
      "Recommendation Letter (1 of 2)",
      "Recommendation Letter (2 of 2)",
    ]);
  });

  it("expands quantity on each plus-separated part", () => {
    expect(expandDocumentNames("Photos (2) + Passport")).toEqual([
      "Photo (1 of 2)",
      "Photo (2 of 2)",
      "Passport",
    ]);
  });

  it("leaves non-quantity parentheticals untouched", () => {
    expect(expandDocumentNames("IELTS (with 6.0-6.5)")).toEqual(["IELTS (with 6.0-6.5)"]);
    expect(expandDocumentNames("Extra Doc (For Plus Points)")).toEqual([
      "Extra Doc (For Plus Points)",
    ]);
  });

  it("ignores an out-of-range quantity (>10)", () => {
    expect(expandDocumentNames("Copies (20)")).toEqual(["Copies (20)"]);
  });

  it("treats (1) as a single item, not an expansion", () => {
    expect(expandDocumentNames("Letter (1)")).toEqual(["Letter (1)"]);
  });

  it("keeps the whole name when only one plus-part is long enough", () => {
    expect(expandDocumentNames("A + Passport")).toEqual(["A + Passport"]);
  });

  it("drops a result shorter than 2 chars entirely", () => {
    expect(expandDocumentNames("A")).toEqual([]);
  });
});

describe("documentTypeFromName", () => {
  it("slugifies a name to snake_case", () => {
    expect(documentTypeFromName("Birth Certificate")).toBe("birth_certificate");
  });

  it("collapses non-alphanumerics and trims underscores", () => {
    expect(documentTypeFromName("  IELTS / TOEFL!! ")).toBe("ielts_toefl");
  });

  it('falls back to "document" for empty/symbol-only input', () => {
    expect(documentTypeFromName("!!!")).toBe("document");
    expect(documentTypeFromName("")).toBe("document");
  });
});

describe("parseDocumentRequirementsCsv", () => {
  it("parses a country section with degree columns", () => {
    const csv = [
      "China",
      "",
      "Bachelors,Masters,PhD",
      "Passport,Passport,Passport",
      "Birth Certificate,Degree Certificate,Research Proposal",
    ].join("\n");

    const rows = parseDocumentRequirementsCsv(csv);
    const chinaBachelors = rows.filter(
      (r) => r.country === Country.CHINA && r.degree === Degree.BACHELORS
    );
    expect(chinaBachelors.map((r) => r.documentName)).toEqual([
      "Passport",
      "Birth Certificate",
    ]);
    expect(chinaBachelors[0].sortOrder).toBe(1);
    expect(chinaBachelors[1].sortOrder).toBe(2);
  });

  it("maps a multi-country header to every country", () => {
    // Document rows need >= 2 columns, otherwise a lone cell is read as a header.
    const csv = [
      "United Kingdom + Scotland",
      "",
      "Bachelors,Masters",
      "Passport,CV",
    ].join("\n");

    const rows = parseDocumentRequirementsCsv(csv);
    const countries = rows.map((r) => r.country);
    expect(countries).toContain(Country.UNITED_KINGDOM);
    expect(countries).toContain(Country.SCOTLAND);
  });

  it("dedupes identical documents within a country/degree", () => {
    const csv = ["China", "", "Bachelors,Masters", "Passport,X", "Passport,Y"].join("\n");
    const rows = parseDocumentRequirementsCsv(csv);
    const chinaBachelorsPassports = rows.filter(
      (r) => r.country === Country.CHINA && r.degree === Degree.BACHELORS && r.documentName === "Passport"
    );
    expect(chinaBachelorsPassports).toHaveLength(1);
  });

  it("expands multi-document cells into separate rows", () => {
    const csv = ["China", "", "Bachelors,Masters", "Recommendation Letters (2),Passport"].join("\n");
    const rows = parseDocumentRequirementsCsv(csv);
    const chinaBachelors = rows.filter(
      (r) => r.country === Country.CHINA && r.degree === Degree.BACHELORS
    );
    expect(chinaBachelors.map((r) => r.documentName)).toEqual([
      "Recommendation Letter (1 of 2)",
      "Recommendation Letter (2 of 2)",
    ]);
  });

  it("ignores rows before any country section", () => {
    const csv = ["Bachelors,Masters", "Passport,CV"].join("\n");
    expect(parseDocumentRequirementsCsv(csv)).toEqual([]);
  });

  it("handles quoted cells containing commas", () => {
    const csv = ["China", "", "Bachelors,Masters", '"Passport, valid",CV'].join("\n");
    const rows = parseDocumentRequirementsCsv(csv);
    const doc = rows.find(
      (r) => r.country === Country.CHINA && r.degree === Degree.BACHELORS
    );
    expect(doc?.documentName).toBe("Passport, valid");
  });

  it("handles escaped double-quotes inside quoted cells", () => {
    const csv = ["China", "", "Bachelors,Masters", '"Doc ""A""",CV'].join("\n");
    const rows = parseDocumentRequirementsCsv(csv);
    const doc = rows.find(
      (r) => r.country === Country.CHINA && r.degree === Degree.BACHELORS
    );
    expect(doc?.documentName).toBe('Doc "A"');
  });

  it("parses Windows CRLF line endings", () => {
    const csv = ["China", "", "Bachelors,Masters", "Passport,CV"].join("\r\n");
    const rows = parseDocumentRequirementsCsv(csv);
    expect(
      rows.some((r) => r.country === Country.CHINA && r.documentName === "Passport")
    ).toBe(true);
  });

  it("ignores an unknown country section header", () => {
    const csv = ["Atlantis", "", "Bachelors,Masters", "Passport,CV"].join("\n");
    // Header is not in the country map -> currentCountries never set -> no rows.
    expect(parseDocumentRequirementsCsv(csv)).toEqual([]);
  });

  it("skips empty cells within a multi-column document row", () => {
    // Leading empty cell (Bachelors column) must be skipped, not misread as a header.
    const csv = ["China", "", "Bachelors,Masters,PhD", ",CV,Research Proposal"].join("\n");
    const rows = parseDocumentRequirementsCsv(csv);
    expect(rows.some((r) => r.degree === Degree.BACHELORS)).toBe(false);
    expect(
      rows.some((r) => r.degree === Degree.MASTERS && r.documentName === "CV")
    ).toBe(true);
  });

  it("skips a document name shorter than two characters", () => {
    const csv = ["China", "", "Bachelors,Masters,PhD", "X,CV,Research Proposal"].join("\n");
    const rows = parseDocumentRequirementsCsv(csv);
    expect(rows.some((r) => r.degree === Degree.BACHELORS)).toBe(false);
    expect(
      rows.some((r) => r.degree === Degree.MASTERS && r.documentName === "CV")
    ).toBe(true);
  });
});

describe("parseDocumentRequirementsFile", () => {
  it("reads and parses a CSV file from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "az-docs-"));
    const file = join(dir, "reqs.csv");
    await writeFile(file, ["China", "", "Bachelors,Masters", "Passport,CV"].join("\n"), "utf-8");

    const rows = await parseDocumentRequirementsFile(file);
    expect(rows.some((r) => r.country === Country.CHINA && r.documentName === "Passport")).toBe(true);
  });
});
