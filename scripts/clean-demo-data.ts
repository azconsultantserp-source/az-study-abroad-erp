import { rm } from "fs/promises";
import path from "path";
import prisma from "../src/lib/db";

/**
 * Removes ALL student data (demo/test records) while preserving staff accounts
 * (ADMIN/COUNSELOR) and the seeded DocumentRequirement catalog.
 */
async function main() {
  const studentUsers = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true },
  });
  const studentUserIds = studentUsers.map((u) => u.id);

  const caseCount = await prisma.studentCase.count();
  const docCount = await prisma.document.count();

  console.log(`Deleting ${caseCount} student case(s), ${docCount} document(s), ${studentUserIds.length} portal user(s)...`);

  // Order matters: clear tables that reference stage records / documents first.
  await prisma.stageMoveHistory.deleteMany({});
  await prisma.notification.deleteMany({});
  // Deleting cases cascades to stage records and their documents.
  await prisma.studentCase.deleteMany({});
  // Remove audit logs tied to student users so the user rows can be deleted.
  await prisma.auditLog.deleteMany({ where: { userId: { in: studentUserIds } } });
  await prisma.user.deleteMany({ where: { role: "STUDENT" } });

  // Wipe uploaded files from local disk (safe: recreated on next upload).
  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  try {
    await rm(path.join(uploadDir, "documents"), { recursive: true, force: true });
    console.log("Removed local uploaded files.");
  } catch {
    console.log("No local upload folder to remove (ok).");
  }

  const remainingCases = await prisma.studentCase.count();
  const remainingDocs = await prisma.document.count();
  const staff = await prisma.user.count({ where: { role: { in: ["ADMIN", "COUNSELOR"] } } });
  const reqs = await prisma.documentRequirement.count();

  console.log(`\nDone.`);
  console.log(`  Remaining student cases: ${remainingCases}`);
  console.log(`  Remaining documents:     ${remainingDocs}`);
  console.log(`  Staff accounts kept:     ${staff}`);
  console.log(`  Requirements kept:       ${reqs}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
