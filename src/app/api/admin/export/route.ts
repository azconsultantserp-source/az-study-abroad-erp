import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRole, handleApiError, logAudit } from "@/lib/api-auth";
import { listStudentCasesForExport } from "@/lib/data";
import { Role } from "@prisma/client";
import {
  STAGE_LABELS,
  FEE_STATUS_LABELS,
  getCountryLabel,
} from "@/lib/constants";

const AZ_TEAL = "FF0F5C5C";
const AZ_GOLD = "FFE9B949";

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET() {
  try {
    const admin = await requireRole(Role.ADMIN);
    const cases = await listStudentCasesForExport();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "AZ Consultants ERP";
    workbook.created = new Date();

    // ---- Sheet 1: Students (one row per student, current stage) ----
    const sheet = workbook.addWorksheet("Students", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "#", key: "index", width: 5 },
      { header: "Full Name", key: "fullName", width: 24 },
      { header: "Added By (Counselor)", key: "counselor", width: 22 },
      { header: "Email", key: "email", width: 26 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Nationality", key: "nationality", width: 16 },
      { header: "Address", key: "address", width: 28 },
      { header: "Passport No.", key: "passportNumber", width: 16 },
      { header: "Current Stage", key: "stage", width: 20 },
      { header: "Country", key: "country", width: 16 },
      { header: "Program", key: "program", width: 24 },
      { header: "Intake", key: "intake", width: 16 },
      { header: "Fee Status", key: "feeStatus", width: 14 },
      { header: "Fee Note", key: "feeNote", width: 26 },
      { header: "Counselor Notes", key: "notes", width: 34 },
      { header: "Documents", key: "documents", width: 12 },
      { header: "Portal Login", key: "portal", width: 26 },
      { header: "Date Added", key: "createdAt", width: 20 },
    ];

    cases.forEach((c, i) => {
      // Prefer the active record; fall back to the latest one.
      const active =
        c.stageRecords.find((r) => r.status === "ACTIVE") ??
        c.stageRecords[c.stageRecords.length - 1];

      sheet.addRow({
        index: i + 1,
        fullName: c.fullName,
        counselor: c.counselor?.name ?? "—",
        email: c.email ?? "—",
        phone: c.phone ?? "—",
        nationality: c.nationality ?? "—",
        address: c.address ?? "—",
        passportNumber: c.passportNumber ?? "—",
        stage: active ? STAGE_LABELS[active.stage] : "—",
        country: getCountryLabel(active?.country),
        program: active?.program ?? "—",
        intake: active?.intake ?? "—",
        feeStatus: active ? FEE_STATUS_LABELS[active.consultancyFeeStatus] : "—",
        feeNote: active?.consultancyFeeNote ?? "—",
        notes: active?.notes ?? "—",
        documents: active?._count.documents ?? 0,
        portal: c.user?.email ?? "No portal",
        createdAt: formatDateTime(c.createdAt),
      });
    });

    // ---- Sheet 2: Stage History (one row per stage record) ----
    const history = workbook.addWorksheet("Stage History", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    history.columns = [
      { header: "#", key: "index", width: 5 },
      { header: "Student", key: "fullName", width: 24 },
      { header: "Added By", key: "counselor", width: 20 },
      { header: "Stage", key: "stage", width: 20 },
      { header: "Status", key: "status", width: 12 },
      { header: "Country", key: "country", width: 16 },
      { header: "Program", key: "program", width: 24 },
      { header: "Intake", key: "intake", width: 16 },
      { header: "Fee Status", key: "feeStatus", width: 14 },
      { header: "Fee Note", key: "feeNote", width: 24 },
      { header: "Notes", key: "notes", width: 32 },
      { header: "Documents", key: "documents", width: 12 },
      { header: "Created", key: "createdAt", width: 20 },
      { header: "Last Updated", key: "updatedAt", width: 20 },
    ];

    let rowIndex = 0;
    cases.forEach((c) => {
      c.stageRecords.forEach((r) => {
        rowIndex += 1;
        history.addRow({
          index: rowIndex,
          fullName: c.fullName,
          counselor: c.counselor?.name ?? "—",
          stage: STAGE_LABELS[r.stage],
          status: r.status === "ACTIVE" ? "Active" : "Moved",
          country: getCountryLabel(r.country),
          program: r.program ?? "—",
          intake: r.intake ?? "—",
          feeStatus: FEE_STATUS_LABELS[r.consultancyFeeStatus],
          feeNote: r.consultancyFeeNote ?? "—",
          notes: r.notes ?? "—",
          documents: r._count.documents,
          createdAt: formatDateTime(r.createdAt),
          updatedAt: formatDateTime(r.updatedAt),
        });
      });
    });

    // ---- Shared styling for both sheets ----
    for (const ws of [sheet, history]) {
      const headerRow = ws.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: AZ_TEAL },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "left" };
      headerRow.height = 22;
      headerRow.border = {
        bottom: { style: "thin", color: { argb: AZ_GOLD } },
      };

      ws.eachRow((row, rowNumber) => {
        row.alignment = { vertical: "top", wrapText: true };
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF4F8F8" },
            };
          });
        }
      });
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columnCount },
      };
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await logAudit(admin.id, "EXPORT", "StudentCase", undefined, `Exported ${cases.length} students to Excel`);

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `AZ_Students_Export_${stamp}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
