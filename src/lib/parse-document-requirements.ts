import { readFile } from "fs/promises";
import { Country, Degree } from "@prisma/client";

export type ParsedRequirement = {
  country: Country;
  degree: Degree;
  documentName: string;
  sortOrder: number;
};

/** Map a CSV section header to one or more Country enum values. */
const SECTION_COUNTRY_MAP: Record<string, Country[]> = {
  "united kingdom + scotland": [Country.UNITED_KINGDOM, Country.SCOTLAND],
  china: [Country.CHINA],
  "romania, lithuania, hungary, sweden , germany": [
    Country.ROMANIA,
    Country.LITHUANIA,
    Country.HUNGARY,
    Country.SWEDEN,
    Country.GERMANY,
  ],
  italy: [Country.ITALY],
  cyprus: [Country.CYPRUS],
};

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseDegreeHeader(cell: string): Degree | null {
  const v = cell.trim().toLowerCase();
  if (v.startsWith("bachelor")) return Degree.BACHELORS;
  if (v.startsWith("master")) return Degree.MASTERS;
  if (v === "phd") return Degree.PHD;
  return null;
}

function cleanDocumentName(raw: string): string {
  return raw
    .replace(/^\d+\s*\.?\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function documentTypeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
}

export function documentTypeFromName(name: string): string {
  const key = documentTypeKey(name);
  return key || "document";
}

/**
 * A single CSV cell sometimes encodes several physically separate documents.
 * We expand those into individual checklist entries so each one gets its own
 * upload slot instead of sharing a single button:
 *
 *   "Birth Certificate + B-Form"  -> ["Birth Certificate", "B-Form"]
 *   "Recommendation Letters (2)"  -> ["Recommendation Letter (1 of 2)",
 *                                     "Recommendation Letter (2 of 2)"]
 *
 * Only a trailing "(<number>)" is treated as a quantity. Parenthetical notes
 * such as "(For Plus Points)", "(IELTS with 6.0-6.5)" or
 * "(Family Registration Certificate)" are left untouched.
 */
export function expandDocumentNames(name: string): string[] {
  // 1) Split documents joined with "+" (e.g. "B-Form + Birth Certificate").
  const plusParts = name
    .split("+")
    .map((part) => cleanDocumentName(part))
    .filter((part) => part.length >= 2);
  const parts = plusParts.length > 1 ? plusParts : [cleanDocumentName(name)];

  // 2) Expand a trailing quantity like "(2)" into that many numbered slots.
  const expanded: string[] = [];
  for (const part of parts) {
    const qtyMatch = part.match(/\((\d+)\)\s*$/);
    const qty = qtyMatch ? Number(qtyMatch[1]) : 1;

    if (qtyMatch && qty >= 2 && qty <= 10) {
      const base = part.slice(0, qtyMatch.index).trim().replace(/\s+$/, "");
      // Drop a trailing plural "s" so each slot reads naturally, e.g.
      // "Recommendation Letters" -> "Recommendation Letter (1 of 2)".
      const singular = base.replace(/s$/i, "");
      for (let i = 1; i <= qty; i++) {
        expanded.push(`${singular} (${i} of ${qty})`);
      }
    } else {
      expanded.push(part);
    }
  }

  return expanded.filter((n) => n.length >= 2);
}

/** Parse a simple CSV line respecting quoted fields with newlines. */
function parseCsvLines(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((c) => c.trim())) rows.push(row);
  }

  return rows;
}

/**
 * Parse the AZ Consultants document-requirements spreadsheet (exported as CSV).
 * Layout: country section header → blank row → Bachelors/Masters/PhD header → document rows.
 */
export function parseDocumentRequirementsCsv(content: string): ParsedRequirement[] {
  const rows = parseCsvLines(content);
  const results: ParsedRequirement[] = [];
  const seen = new Set<string>();

  let currentCountries: Country[] = [];
  let degreeColumns: { col: number; degree: Degree }[] = [];

  for (const row of rows) {
    const col0 = (row[0] ?? "").trim();
    const col1 = (row[1] ?? "").trim();
    const col2 = (row[2] ?? "").trim();

    // Country section header (only first column filled, not a degree row).
    if (col0 && !col1 && !col2) {
      const key = normalizeHeader(col0);
      const mapped = SECTION_COUNTRY_MAP[key];
      if (mapped) {
        currentCountries = mapped;
        degreeColumns = [];
      }
      continue;
    }

    // Degree header row.
    const d0 = parseDegreeHeader(col0);
    const d1 = parseDegreeHeader(col1);
    const d2 = parseDegreeHeader(col2);
    if (d0 || d1 || d2) {
      degreeColumns = [];
      if (d0) degreeColumns.push({ col: 0, degree: d0 });
      if (d1) degreeColumns.push({ col: 1, degree: d1 });
      if (d2) degreeColumns.push({ col: 2, degree: d2 });
      continue;
    }

    if (!currentCountries.length || !degreeColumns.length) continue;

    for (const { col, degree } of degreeColumns) {
      const raw = (row[col] ?? "").trim();
      if (!raw) continue;
      const documentName = cleanDocumentName(raw);
      if (!documentName || documentName.length < 2) continue;

      // One cell can describe multiple documents ("A + B", "Letters (2)"),
      // each of which becomes its own checklist row / upload slot.
      const expandedNames = expandDocumentNames(documentName);

      for (const country of currentCountries) {
        for (const expandedName of expandedNames) {
          const dedupeKey = `${country}|${degree}|${expandedName.toLowerCase()}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const sortOrder =
            results.filter((r) => r.country === country && r.degree === degree).length + 1;

          results.push({ country, degree, documentName: expandedName, sortOrder });
        }
      }
    }
  }

  return results;
}

export async function parseDocumentRequirementsFile(filePath: string): Promise<ParsedRequirement[]> {
  const content = await readFile(filePath, "utf-8");
  return parseDocumentRequirementsCsv(content);
}
