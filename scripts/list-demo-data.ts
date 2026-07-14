import prisma from "../src/lib/db";

async function main() {
  const cases = await prisma.studentCase.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      createdAt: true,
      user: { select: { email: true, role: true } },
      _count: { select: { stageRecords: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nSTUDENT CASES: ${cases.length}`);
  for (const c of cases) {
    console.log(
      `  - ${c.fullName} | ${c.email ?? "no email"} | portal: ${c.user?.email ?? "none"} | stages: ${c._count.stageRecords}`
    );
  }

  const docs = await prisma.document.count();
  const studentUsers = await prisma.user.count({ where: { role: "STUDENT" } });
  console.log(`\nDOCUMENTS: ${docs}`);
  console.log(`STUDENT PORTAL USERS: ${studentUsers}`);

  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "COUNSELOR"] } },
    select: { email: true, role: true },
  });
  console.log(`\nSTAFF (will be kept): ${staff.length}`);
  for (const s of staff) console.log(`  - ${s.email} (${s.role})`);

  const reqs = await prisma.documentRequirement.count();
  console.log(`\nDOCUMENT REQUIREMENTS (will be kept): ${reqs}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
