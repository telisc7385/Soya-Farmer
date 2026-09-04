// npx ts-node prisma/data-migrate-bank-documents.ts
import prisma from "../src/database/prisma";

async function main() {
  // All bank records that have a passbookImage
  const banks = await prisma.farmerBank.findMany({
    where: {
      passbookImage: { not: "" },
    },
  });

  console.log(`Found ${banks.length} bank record(s) to process.`);

  let migrated = 0;
  let skipped = 0;

  for (const bank of banks) {
    if (!bank.passbookImage) {
      skipped++;
      continue;
    }

    // If passbookImage is already in documentUrls, nothing to do
    if (bank.documentUrls.includes(bank.passbookImage)) {
      skipped++;
      continue;
    }

    const merged = [...bank.documentUrls, bank.passbookImage];
    await prisma.farmerBank.update({
      where: { id: bank.id },
      data: { documentUrls: merged },
    });

    migrated++;
    console.log(`Migrated bank ${bank.id}: added ${bank.passbookImage}`);
  }

  console.log(
    `Migration complete. Updated ${migrated} record(s), skipped ${skipped} record(s).`,
  );
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
