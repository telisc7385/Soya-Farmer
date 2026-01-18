import bcrypt from "bcrypt";
import prisma from "../src/database/prisma";

async function main() {
  const adminEmail = "admin@example.com";

  // Check if admin already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { email: adminEmail },
  });

  console.log("existingAdmin", existingAdmin);

  if (existingAdmin) {
    console.log("✅ Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash("Admin@123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "System Admin",
      email: adminEmail,
      phone: "9999999999",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("🚀 Admin user created:", {
    id: admin.id,
    email: admin.email,
    role: admin.role,
  });
}

main()
  .catch((e) => {
    console.error("❌ Seed failed", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
