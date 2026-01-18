import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { envConfig } from "../config/env";

const { PrismaClient } = pkg;

const pool = new Pool({
  connectionString: envConfig.dbUrl,
});

const adapter = new PrismaPg(pool);

const globalForPrisma = global as unknown as {
  prisma: InstanceType<typeof PrismaClient> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
