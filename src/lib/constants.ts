import { ConsultancyFeeStatus, Country, Degree, DocumentStatus, StudentStage } from "@prisma/client";

// NOTE: Ireland intentionally omitted from the selectable list per business
// requirement. The Country enum still contains IRELAND for backward
// compatibility, but it is no longer offered in dropdowns.
export const COUNTRIES: { value: Country; label: string }[] = [
  { value: "GERMANY", label: "Germany" },
  { value: "LITHUANIA", label: "Lithuania" },
  { value: "UNITED_KINGDOM", label: "United Kingdom" },
  { value: "SCOTLAND", label: "Scotland" },
  { value: "ITALY", label: "Italy" },
  { value: "CHINA", label: "China" },
  { value: "HUNGARY", label: "Hungary" },
  { value: "CYPRUS", label: "Cyprus" },
  { value: "ROMANIA", label: "Romania" },
  { value: "SWEDEN", label: "Sweden" },
];

export const COUNTRY_LABELS: Record<Country, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.value, c.label])
) as Record<Country, string>;

export const STAGE_LABELS: Record<StudentStage, string> = {
  QUERY: "Queries",
  ADMISSION: "Admission Processing",
  VISA: "Visa Processing",
  SATISFIED: "Satisfied",
};

export const STAGE_DESCRIPTIONS: Record<StudentStage, string> = {
  QUERY: "New student inquiries and initial contact",
  ADMISSION: "Students actively processing university admissions",
  VISA: "Students in visa application process",
  SATISFIED: "Successfully completed students",
};

export const STAGE_COLORS: Record<StudentStage, string> = {
  QUERY: "bg-amber-100 text-amber-800 border-amber-200",
  ADMISSION: "bg-teal-100 text-teal-800 border-teal-200",
  VISA: "bg-blue-100 text-blue-800 border-blue-200",
  SATISFIED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export const NEXT_STAGE: Partial<Record<StudentStage, StudentStage>> = {
  QUERY: "ADMISSION",
  ADMISSION: "VISA",
  VISA: "SATISFIED",
};

// Reverse of NEXT_STAGE — lets counselors undo an accidental forward move.
export const PREV_STAGE: Partial<Record<StudentStage, StudentStage>> = {
  ADMISSION: "QUERY",
  VISA: "ADMISSION",
  SATISFIED: "VISA",
};

/** Dashboard folder URLs for each pipeline stage (used for "back" links). */
export const STAGE_ROUTES: Record<StudentStage, string> = {
  QUERY: "/students/query",
  ADMISSION: "/students/admission",
  VISA: "/students/visa",
  SATISFIED: "/students/satisfied",
};

export function getStageFolderHref(stage: StudentStage): string {
  return STAGE_ROUTES[stage];
}

export const MOVE_ACTION_LABELS: Partial<Record<StudentStage, string>> = {
  QUERY: "Move to Admission Processing",
  ADMISSION: "Move to Visa Processing",
  VISA: "Mark as Satisfied",
};

export const MOVE_BACK_ACTION_LABELS: Partial<Record<StudentStage, string>> = {
  ADMISSION: "Move back to Queries",
  VISA: "Move back to Admission Processing",
  SATISFIED: "Move back to Visa Processing",
};

export const FEE_STATUS_LABELS: Record<ConsultancyFeeStatus, string> = {
  NOT_PAID: "Not Paid",
  HALF_PAID: "Half Paid",
  PAID: "Paid",
};

export const FEE_STATUS_COLORS: Record<ConsultancyFeeStatus, string> = {
  NOT_PAID: "bg-red-100 text-red-800",
  HALF_PAID: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING_APPROVAL: "Awaiting Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export const DEGREES: { value: Degree; label: string }[] = [
  { value: "BACHELORS", label: "Bachelor's" },
  { value: "MASTERS", label: "Master's" },
  { value: "PHD", label: "PhD" },
];

export const DEGREE_LABELS: Record<Degree, string> = {
  BACHELORS: "Bachelor's",
  MASTERS: "Master's",
  PHD: "PhD",
};

export function getDegreeLabel(degree: Degree | null | undefined): string {
  if (!degree) return "—";
  return DEGREE_LABELS[degree] ?? degree;
}

export function getCountryLabel(country: Country | null | undefined): string {
  if (!country) return "—";
  return COUNTRY_LABELS[country] ?? country;
}
