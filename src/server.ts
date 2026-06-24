import { createServer } from "http";
import app from "./app";
import { envConfig } from "./config/env";
import { logError } from "./utils/logger";

const PORT = Number(envConfig.port) || 5000;

process.on("uncaughtException", (err) => {
  logError(`UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  logError(`UNHANDLED REJECTION: ${message}`);
});

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
