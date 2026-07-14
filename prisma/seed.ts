import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sealCredential } from "../src/lib/credential-vault";

const prisma = new PrismaClient();

const BASIC_PASSWORD = "azc@2026";

async function main() {
  console.log("Seeding AZ Consultants ERP...\n");

  // Remove any previous demo accounts (staff + students).
  // Delete student cases first: they hold a required counselorId relation,
  // so counselor users cannot be removed while demo cases still reference them.
  const demoEmails = [
    "admin@azconsultants.com",
    "counselor@azconsultants.com",
    "student@example.com",
  ];
  await prisma.studentCase.deleteMany({
    where: {
      OR: [
        { fullName: { in: ["Ahmed Hassan", "Fatima Ali"] } },
        { counselor: { email: { in: demoEmails } } },
        { user: { email: { in: demoEmails } } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { email: { in: demoEmails } } });
  console.log("✓ Removed demo accounts");

  const passwordHash = await bcrypt.hash(BASIC_PASSWORD, 12);

  // Managing Director — full admin access (admin representative)
  const md = await prisma.user.upsert({
    where: { email: "managingdirector@azconsultants.com" },
    update: {
      role: Role.ADMIN,
      name: "Managing Director",
      passwordHash,
      plainPassword: sealCredential(BASIC_PASSWORD),
      isActive: true,
    },
    create: {
      name: "Managing Director",
      email: "managingdirector@azconsultants.com",
      passwordHash,
      plainPassword: sealCredential(BASIC_PASSWORD),
      role: Role.ADMIN,
    },
  });
  console.log(`✓ Admin (MD): ${md.email}`);

  // Counselor 1 — Shifa Asif
  const shifa = await prisma.user.upsert({
    where: { email: "shifaasif@azconsultants.com" },
    update: {
      role: Role.COUNSELOR,
      name: "Shifa Asif",
      passwordHash,
      plainPassword: sealCredential(BASIC_PASSWORD),
      isActive: true,
    },
    create: {
      name: "Shifa Asif",
      email: "shifaasif@azconsultants.com",
      passwordHash,
      plainPassword: sealCredential(BASIC_PASSWORD),
      role: Role.COUNSELOR,
    },
  });
  console.log(`✓ Counselor: ${shifa.email}`);

  // Counselor 2 — Mehreen Ishfaq
  const mehreen = await prisma.user.upsert({
    where: { email: "mehreenishfaq@azconsultants.com" },
    update: {
      role: Role.COUNSELOR,
      name: "Mehreen Ishfaq",
      passwordHash,
      plainPassword: sealCredential(BASIC_PASSWORD),
      isActive: true,
    },
    create: {
      name: "Mehreen Ishfaq",
      email: "mehreenishfaq@azconsultants.com",
      passwordHash,
      plainPassword: sealCredential(BASIC_PASSWORD),
      role: Role.COUNSELOR,
    },
  });
  console.log(`✓ Counselor: ${mehreen.email}`);

  await prisma.auditLog.create({
    data: {
      userId: md.id,
      action: "SEED",
      entity: "System",
      details: "Seeded staff accounts (MD admin + 2 counselors)",
    },
  });

  console.log("\n═══════════════════════════════════════════");
  console.log("  Staff Accounts (basic password for all):");
  console.log("═══════════════════════════════════════════");
  console.log(`  Admin (MD): managingdirector@azconsultants.com`);
  console.log(`  Counselor:  shifaasif@azconsultants.com`);
  console.log(`  Counselor:  mehreenishfaq@azconsultants.com`);
  console.log(`  Password (all): ${BASIC_PASSWORD}`);
  console.log("═══════════════════════════════════════════\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
