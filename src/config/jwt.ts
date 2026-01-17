import dotenv from "dotenv";

dotenv.config();

interface envConfigPayload {
    accessSecret: string;
    accessExpiry: string;

    port: string;

    dbUrl: string;
}

export const envConfig: envConfigPayload = {
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  accessExpiry: "7d",

  port: process.env.PORT!,
  dbUrl: process.env.DATABASE_URL!,
};
