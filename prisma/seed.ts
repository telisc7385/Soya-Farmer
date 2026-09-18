// npx ts-node prisma/seed.ts
import bcrypt from "bcrypt";
import prisma from "../src/database/prisma";

async function main() {
  const email = "tulajabhawani@gmail.com";
  const password = "masterAdmin@123";

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
        isMasterAdmin: true,
        phone: "0000000000",
      },
    });

    console.log("Admin created successfully:", admin.email);
  } else {
      console.log("Master Admin already exists");
  }

  const existingLimit = await prisma.purchaseLimit.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!existingLimit) {
    await prisma.purchaseLimit.create({
      data: { value: 12, note: "Initial seed value" },
    });
    console.log("Seeded PurchaseLimit=12 history record");
  } else {
    console.log(
      `Skipped PurchaseLimit seed. Existing latest value: ${existingLimit.value}`,
    );
  }

  // Seed formula deduction masters (examples)
  const deductionSeeds = [
    {
      name: "Over All Deduction",
      formulaExpression: "Moisture + FM + Damage",
      variableValues: ["10+2+2", "10+2+3"],
      variables: [
        {
          code: "Moisture",
          label: "Moisture %",
          unitHint: "range:<=variableValue:0,10-13:1,14-16:1.5,>16:2",
        },
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

  // Seed bag families + weight variants (PP / Katta with gram weights)
  const bagFamilies: Array<{
    name: string;
    defaultWeightPerBag: number;
    variants: Array<{ name: string; weightPerBag: number }>;
  }> = [
    {
      name: "PP Bag",
      defaultWeightPerBag: 0.01,
      variants: [
        { name: "PP 400 gm", weightPerBag: 0.4 },
        { name: "PP 600 gm", weightPerBag: 0.6 },
        { name: "PP 700 gm", weightPerBag: 0.7 },
      ],
    },
    {
      name: "Kaltani Katta",
      defaultWeightPerBag: 0.05,
      variants: [
        { name: "Kaltani 600 gm", weightPerBag: 0.6 },
        { name: "Kaltani 1 kg", weightPerBag: 1 },
        { name: "Kaltani 1.5 kg", weightPerBag: 1.5 },
      ],
    },
  ];

  for (const family of bagFamilies) {
    // Legacy flat rows have isVariant=false (migration default); they become families
    const legacyFamily = await prisma.goniType.findFirst({
      where: { name: family.name, isVariant: false },
      select: { id: true },
    });

    // Legacy flat rows become bag families (no weight, no tracking at family level)
    let familyRow: { id: string };
    if (legacyFamily) {
      familyRow = await prisma.goniType.update({
        where: { id: legacyFamily.id },
        data: { isVariant: false, isTracked: false, weightPerBag: null },
        select: { id: true },
      });
      console.log("Bag family converted:", family.name);
    } else {
      familyRow = await prisma.goniType.create({
        data: {
          name: family.name,
          weightPerBag: null,
          isActive: true,
          isTracked: false,
          isVariant: false,
          createdBy: admin.id,
        },
        select: { id: true },
      });
      console.log("Bag family seeded:", family.name);
    }

    // Default variant keeps legacy balances alive (historical bills/ledgers point here)
    const defaultVariantName = `${family.name} (Default)`;
    let defaultVariant = await prisma.goniType.findFirst({
      where: { parentId: familyRow.id, name: defaultVariantName },
      select: { id: true },
    });
    if (!defaultVariant) {
      defaultVariant = await prisma.goniType.create({
        data: {
          name: defaultVariantName,
          weightPerBag: family.defaultWeightPerBag,
          isActive: true,
          isTracked: true,
          isVariant: true,
          parentId: familyRow.id,
          createdBy: admin.id,
        },
        select: { id: true },
      });
      console.log("Default goni variant seeded:", defaultVariantName);
    }

    // Reparent any history still referencing the family onto the default variant
    await prisma.billGoni.updateMany({
      where: { goniTypeId: familyRow.id },
      data: { goniTypeId: defaultVariant.id },
    });
    await prisma.bagMovement.updateMany({
      where: { goniTypeId: familyRow.id },
      data: { goniTypeId: defaultVariant.id },
    });
    await prisma.stock.updateMany({
      where: { goniTypeId: familyRow.id },
      data: { goniTypeId: defaultVariant.id },
    });
    await prisma.stockTransfer.updateMany({
      where: { goniTypeId: familyRow.id },
      data: { goniTypeId: defaultVariant.id },
    });
    await prisma.stockTransferItem.updateMany({
      where: { goniTypeId: familyRow.id },
      data: { goniTypeId: defaultVariant.id },
    });
    await prisma.thappiBagBreakdown.updateMany({
      where: { goniTypeId: familyRow.id },
      data: { goniTypeId: defaultVariant.id },
    });

    // Weight variants under the family (idempotent)
    for (const variant of family.variants) {
      const existingVariant = await prisma.goniType.findFirst({
        where: { parentId: familyRow.id, name: variant.name },
        select: { id: true },
      });
      if (!existingVariant) {
        await prisma.goniType.create({
          data: {
            name: variant.name,
            weightPerBag: variant.weightPerBag,
            isActive: true,
            isTracked: true,
            isVariant: true,
            parentId: familyRow.id,
            createdBy: admin.id,
          },
        });
        console.log("Goni variant seeded:", variant.name);
      }
    }
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
