import dotenv from "dotenv";

dotenv.config();

interface envConfigPayload {
  accessSecret: string;
  accessExpiry: string;

  port: string;

  dbUrl: string;

  githubWebhookSecret: string;
  logsUsername: string;
  logsPassword: string;
}

export const envConfig: envConfigPayload = {
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  accessExpiry: "7d",

  port: process.env.PORT!,
  dbUrl: process.env.DATABASE_URL!,

  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
  logsUsername: "suchit",
  logsPassword: "Suchit@123",
};
