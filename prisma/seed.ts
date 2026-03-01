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

  // Seed formula deduction masters (examples)
  const deductionSeeds = [
    {
      name: "Over All Deduction",
      formulaExpression: "moisture + FM + Damage",
      variableValues: ["10+2+2", "10+2+3"],
      variables: [
        { code: "moisture", label: "Moisture %", unitHint: "1" },
        { code: "FM", label: "FM", unitHint: "1" },
        { code: "Damage", label: "Damage", unitHint: "1/4" },
      ],
    },
  ];

  for (const seed of deductionSeeds) {
    const existingDeduction = await prisma.deductionMaster.findFirst({
      where: { name: seed.name },
    });

    if (!existingDeduction) {
      const deduction = await prisma.deductionMaster.create({
        data: {
          name: seed.name,
          type: "FORMULA",
          formulaExpression: seed.formulaExpression,
          variableValues: seed.variableValues,
          createdBy: admin.id,
          variables: {
            create: seed.variables,
          },
        },
        include: { variables: true },
      });

      console.log("Deduction master seeded:", deduction.name);
    } else {
      console.log("Deduction master already exists:", seed.name);
    }
  }

  // Seed one production-grade goni type
  const goniName = "Plastic Poti";
  const existingGoni = await prisma.goniType.findFirst({
    where: { name: goniName },
  });

  if (!existingGoni) {
    const goni = await prisma.goniType.create({
      data: {
        name: goniName,
        weightPerBag: 0.0001,
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
