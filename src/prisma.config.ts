// prisma.config.ts
import { defineConfig } from "prisma/config";
import { envConfig } from "./config/env";

export default defineConfig({
  datasource: {
    url: envConfig.dbUrl,
  },
});
