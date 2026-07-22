import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const DEPLOY_LOG = path.join(LOG_DIR, "deploy.log");
const APP_LOG = path.join(LOG_DIR, "app.log");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(filePath: string, level: string, message: string): void {
  ensureLogDir();
  const line = `[${formatTimestamp()}] [${level}] ${message}`;
  fs.appendFileSync(filePath, line + "\n");
}

export function log(message: string): void {
  writeLog(DEPLOY_LOG, "INFO", message);
  console.log(`[${formatTimestamp()}] [INFO] ${message}`);
}

export function logError(message: string): void {
  writeLog(DEPLOY_LOG, "ERROR", message);
  writeLog(APP_LOG, "ERROR", message);
  console.error(`[${formatTimestamp()}] [ERROR] ${message}`);
}

export function logWarn(message: string): void {
  writeLog(DEPLOY_LOG, "WARN", message);
  writeLog(APP_LOG, "WARN", message);
  console.warn(`[${formatTimestamp()}] [WARN] ${message}`);
}

export function logHttp(method: string, url: string, status: number, ms: number): void {
  writeLog(APP_LOG, "HTTP", `${method} ${url} → ${status} (${ms}ms)`);
}

export function getAppLogLines(n?: number): string[] {
  try {
    ensureLogDir();
    if (!fs.existsSync(APP_LOG)) return [];
    const content = fs.readFileSync(APP_LOG, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    const filtered = lines.filter((line) => line.includes("[ERROR]") || line.includes("[WARN]"));
    return n ? filtered.slice(-n) : filtered;
  } catch {
    return [];
  }
}

export function getDeployLogLines(n?: number): string[] {
  try {
    ensureLogDir();
    if (!fs.existsSync(DEPLOY_LOG)) return [];
    const content = fs.readFileSync(DEPLOY_LOG, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    return n ? lines.slice(-n) : lines;
  } catch {
    return [];
  }
}
