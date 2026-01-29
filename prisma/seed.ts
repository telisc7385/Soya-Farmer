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

  if (existingAdmin) {
    console.log("✅ Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email,
      password: hashedPassword,
      role: "ADMIN",
      phone: "0000000000", // required? keep or remove based on schema
    },
  });

  console.log("🚀 Admin created successfully:", admin.email);
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
