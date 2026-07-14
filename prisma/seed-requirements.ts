import { PrismaClient } from "@prisma/client";
import { parseDocumentRequirementsFile } from "../src/lib/parse-document-requirements";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  const csvPath = path.join(process.cwd(), "data", "document-requirements.csv");
  console.log(`Reading requirements from ${csvPath}...`);

  const requirements = await parseDocumentRequirementsFile(csvPath);
  console.log(`Parsed ${requirements.length} requirement rows.`);

  await prisma.documentRequirement.deleteMany();

  const batchSize = 100;
  for (let i = 0; i < requirements.length; i += batchSize) {
    const batch = requirements.slice(i, i + batchSize);
    await prisma.documentRequirement.createMany({
      data: batch.map((r) => ({
        country: r.country,
        degree: r.degree,
        documentName: r.documentName,
        sortOrder: r.sortOrder,
        isMandatory: true,
      })),
      skipDuplicates: true,
    });
  }

  const count = await prisma.documentRequirement.count();
  console.log(`✓ Seeded ${count} document requirements.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
