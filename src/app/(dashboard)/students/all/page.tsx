import { redirect } from "next/navigation";
import { Card, Badge, EmptyState } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { STAGE_LABELS, STAGE_COLORS, getCountryLabel } from "@/lib/constants";
import { getSessionUser } from "@/lib/api-auth";
import { listStudentCases } from "@/lib/data";
import { Country, StudentStage } from "@prisma/client";
import { Users } from "lucide-react";

type StudentListItem = Awaited<ReturnType<typeof listStudentCases>>["items"][number];

export default async function AllStudentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  let students: StudentListItem[] = [];
  let error = "";

  try {
    students = (await listStudentCases(user)).items;
  } catch (e) {
    console.error("All students page error:", e);
    error = "Could not load students.";
  }

  return (
    <div>
      <div className="az-enter mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-heading">Total Students</h1>
        <p className="mt-1 text-content-muted">All students across every stage and folder</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        {!error && students.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" aria-hidden="true" />}
            title="No students yet"
            description="Students you add across any stage will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Added By</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const activeRecord = student.stageRecords.find((r) => r.status === "ACTIVE");
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.fullName}</TableCell>
                    <TableCell>
                      <Badge className="bg-az-teal/10 text-az-teal">
                        {student.counselor?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{student.email || "—"}</TableCell>
                    <TableCell>{student.phone || "—"}</TableCell>
                    <TableCell>
                      {activeRecord ? (
                        <Badge className={STAGE_COLORS[activeRecord.stage]}>
                          {STAGE_LABELS[activeRecord.stage]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{getCountryLabel(activeRecord?.country)}</TableCell>
                    <TableCell>{formatDate(student.createdAt)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
