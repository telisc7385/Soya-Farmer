import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const DEPLOY_LOG = path.join(LOG_DIR, "deploy.log");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function log(message: string): void {
  ensureLogDir();
  const line = `[${formatTimestamp()}] [INFO] ${message}`;
  fs.appendFileSync(DEPLOY_LOG, line + "\n");
  console.log(line);
}

export function logError(message: string): void {
  ensureLogDir();
  const line = `[${formatTimestamp()}] [ERROR] ${message}`;
  fs.appendFileSync(DEPLOY_LOG, line + "\n");
  console.error(line);
}

export function logWarn(message: string): void {
  ensureLogDir();
  const line = `[${formatTimestamp()}] [WARN] ${message}`;
  fs.appendFileSync(DEPLOY_LOG, line + "\n");
  console.warn(line);
}
