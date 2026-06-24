import path from "path";
import fs from "fs";
import { executeCommand } from "../utils/command-executor";
import { log, logError } from "../utils/logger";

const STATUS_FILE = path.resolve(process.cwd(), "logs", "deploy-status.json");

interface DeployStatus {
  running: boolean;
  lastDeployment: string | null;
  status: "success" | "failed" | "idle" | "running";
  lastLog: string | null;
}

let isRunning = false;

function getProjectPath(): string {
  return process.env.PROJECT_PATH || process.cwd();
}

function readStatus(): DeployStatus {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
    }
  } catch {
    // fall through
  }
  return { running: false, lastDeployment: null, status: "idle", lastLog: null };
}

function writeStatus(status: DeployStatus): void {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

export function getDeployStatus(): DeployStatus {
  return readStatus();
}

export async function runDeployment(): Promise<DeployStatus> {
  if (isRunning) {
    throw new Error("A deployment is already in progress");
  }

  isRunning = true;
  const startTime = new Date().toISOString();
  const status = readStatus();
  status.running = true;
  status.status = "running";
  writeStatus(status);

  const projectPath = getProjectPath();
  const commands = [
    { label: "git pull", cmd: "git pull origin main" },
    { label: "npm install", cmd: "npm install" },
    { label: "npm run build", cmd: "npm run build" },
    { label: "prisma generate", cmd: "npx prisma generate" },
    { label: "prisma migrate deploy", cmd: "npx prisma migrate deploy" },
  ];

  try {
    for (const { label, cmd } of commands) {
      log(`[Deploy] Running: ${label}`);
      const result = await executeCommand(cmd, projectPath);
      if (result.stdout) log(`[Deploy] ${label} stdout: ${result.stdout}`);
      if (result.stderr) log(`[Deploy] ${label} stderr: ${result.stderr}`);
    }

    const endTime = new Date().toISOString();
    const finalStatus: DeployStatus = {
      running: false,
      lastDeployment: endTime,
      status: "success",
      lastLog: startTime,
    };
    writeStatus(finalStatus);
    log("[Deploy] Deployment completed successfully");

    // Gracefully reload the server (fire-and-forget since it kills the current process)
    executeCommand("pm2 reload soya-api", projectPath).catch(() => {});
    return finalStatus;
  } catch (err: any) {
    const endTime = new Date().toISOString();
    const errorMsg = err?.stderr || err?.message || "Unknown error";
    logError(`[Deploy] Deployment failed: ${errorMsg}`);
    const finalStatus: DeployStatus = {
      running: false,
      lastDeployment: endTime,
      status: "failed",
      lastLog: startTime,
    };
    writeStatus(finalStatus);
    throw finalStatus;
  } finally {
    isRunning = false;
  }
}
