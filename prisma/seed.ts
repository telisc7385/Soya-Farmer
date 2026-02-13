// npx ts-node prisma/seed.ts
import bcrypt from "bcrypt";
import prisma from "../src/database/prisma";

async function main() {
  const email = "admin@gmail.com";
  const password = "admin@123";

  // check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  });

  let admin = existingAdmin;
  if (!admin) {
    const hashedPassword = await bcrypt.hash(password, 10);

    admin = await prisma.user.create({
      data: {
        name: "Admin",
        email,
        password: hashedPassword,
        role: "ADMIN",
        phone: "0000000000",
      },
    });

    console.log("Admin created successfully:", admin.email);
  } else {
    console.log("Admin already exists");
  }

  // Seed one production-grade deduction master (formula based)
  const deductionName = "Market Fee";
  const existingDeduction = await prisma.deductionMaster.findFirst({
    where: { name: deductionName },
  });

  if (!existingDeduction) {
    const deduction = await prisma.deductionMaster.create({
      data: {
        name: deductionName,
        type: "FORMULA",
        formulaExpression: "grossAmount * ratePercent / 100",
        createdBy: admin.id,
        variables: {
          create: [
            {
              code: "ratePercent",
              label: "Rate (%)",
              unitHint: "%",
            },
            {
              code: "grossAmount",
              label: "Gross Amount",
              unitHint: "INR",
            },
          ],
        },
      },
      include: { variables: true },
    });

    console.log("Deduction master seeded:", deduction.name);
  } else {
    console.log("Deduction master already exists");
  }

  // Seed one production-grade goni type
  const goniName = "Standard Jute Bag";
  const existingGoni = await prisma.goniType.findFirst({
    where: { name: goniName },
  });

  if (!existingGoni) {
    const goni = await prisma.goniType.create({
      data: {
        name: goniName,
        weightPerBag: 1.0,
        createdBy: admin.id,
      },
    });

    console.log("Goni type seeded:", goni.name);
  } else {
    console.log("Goni type already exists");
  }
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
