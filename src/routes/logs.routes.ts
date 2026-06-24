import { Router, Request, Response, NextFunction } from "express";
import { getAppLogLines, getDeployLogLines } from "../utils/logger";
import fs from "fs";
import path from "path";

const router = Router();

const LOGS_USERNAME = process.env.LOGS_USERNAME || "admin";
const LOGS_PASSWORD = process.env.LOGS_PASSWORD || "";

function basicAuth(req: Request, res: Response, next: NextFunction): void {
  if (!LOGS_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="Logs"');
    res.status(401).send("Logs password not configured. Set LOGS_PASSWORD in .env");
    return;
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Logs"');
    res.status(401).send("Authentication required");
    return;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const [username, password] = decoded.split(":");

  if (username !== LOGS_USERNAME || password !== LOGS_PASSWORD) {
    res.set("WWW-Authenticate", 'Basic realm="Logs"');
    res.status(401).send("Invalid credentials");
    return;
  }

  next();
}

router.use(basicAuth);

const LOG_DIR = path.resolve(process.cwd(), "logs");
const APP_LOG = path.join(LOG_DIR, "app.log");
const DEPLOY_LOG = path.join(LOG_DIR, "deploy.log");

router.get("/", (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Server Logs</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
  h1 { font-size: 22px; color: #f0f6fc; }
  .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  select, button { padding: 6px 14px; border: 1px solid #30363d; border-radius: 6px; background: #21262d; color: #c9d1d9; font-size: 13px; cursor: pointer; }
  button:hover { background: #30363d; }
  .badge { font-size: 12px; color: #8b949e; }
  .log-container { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 12px; max-height: 80vh; overflow-y: auto; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; }
  .log-line { white-space: pre-wrap; word-break: break-all; padding: 1px 4px; border-radius: 3px; }
  .log-line:hover { background: #1c2128; }
  .INFO { color: #3fb950; }
  .WARN { color: #d29922; }
  .ERROR { color: #f85149; }
  .HTTP { color: #58a6ff; }
  .empty { color: #8b949e; text-align: center; padding: 40px; }
  .clear-btn { border-color: #f85149; color: #f85149; }
  .clear-btn:hover { background: #f851491a; }
  .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .status-dot.live { background: #3fb950; animation: pulse 2s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
</head>
<body>
<div class="header">
  <h1><span class="status-dot live"></span>Server Logs</h1>
  <div class="controls">
    <select id="logSource">
      <option value="app">App Log</option>
      <option value="deploy">Deploy Log</option>
    </select>
    <span class="badge" id="lineCount">0 lines</span>
    <button onclick="refresh()">Refresh</button>
    <button class="clear-btn" onclick="clearLogs()">Clear</button>
  </div>
</div>
<div class="log-container" id="logContainer">
  <div class="empty">Loading...</div>
</div>
<script>
  let currentSource = "app";
  let refreshInterval;

  async function refresh() {
    const source = document.getElementById("logSource").value;
    currentSource = source;
    try {
      const res = await fetch("/api/logs/data?source=" + source);
      const data = await res.json();
      const container = document.getElementById("logContainer");
      const count = document.getElementById("lineCount");
      if (!data.lines || data.lines.length === 0) {
        container.innerHTML = '<div class="empty">No log entries yet.</div>';
        count.textContent = "0 lines";
        return;
      }
      container.innerHTML = data.lines.reverse().map(line => {
        const level = (line.match(/\\[([A-Z]+)\\]/) || [])[1] || "INFO";
        return '<div class="log-line ' + level + '">' + escapeHtml(line) + '</div>';
      }).join("");
      count.textContent = data.lines.length + " lines";
      container.scrollTop = 0;
    } catch (e) {
      document.getElementById("logContainer").innerHTML = '<div class="empty ERROR">Failed to load logs</div>';
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function clearLogs() {
    if (!confirm("Clear " + currentSource + " logs?")) return;
    try {
      await fetch("/api/logs/clear?source=" + currentSource, { method: "POST" });
      refresh();
    } catch (e) {
      alert("Failed to clear logs");
    }
  }

  document.getElementById("logSource").addEventListener("change", refresh);

  refresh();
  refreshInterval = setInterval(refresh, 5000);
</script>
</body>
</html>`);
});

router.get("/data", (req: Request, res: Response) => {
  const source = req.query.source === "deploy" ? "deploy" : "app";
  const lines = source === "deploy" ? getDeployLogLines(200) : getAppLogLines(200);
  res.json({ source, lines });
});

router.post("/clear", (req: Request, res: Response) => {
  const source = req.query.source === "deploy" ? "deploy" : "app";
  const target = source === "deploy" ? DEPLOY_LOG : APP_LOG;
  try {
    fs.writeFileSync(target, "");
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: "Failed to clear logs" });
  }
});

export default router;