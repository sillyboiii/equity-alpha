import { spawn, execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, statSync, openSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");
const PID_FILE = join(DATA_DIR, "bot.pid");
const LOG_FILE = join(DATA_DIR, "bot.log");

const command = process.argv[2];

function log(msg) {
  console.log(msg);
}

function isRunning() {
  if (!existsSync(PID_FILE)) return false;
  const pid = parseInt(readFileSync(PID_FILE, "utf8"), 10);
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stop() {
  if (!isRunning()) {
    log("Bot is not running.");
    return;
  }
  const pid = parseInt(readFileSync(PID_FILE, "utf8"), 10);
  try {
    process.kill(pid, "SIGTERM");
    setTimeout(() => {
      if (isRunning()) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      }
    }, 3000);
    log(`Stopped bot (PID ${pid}).`);
  } catch (e) {
    log(`Failed to stop: ${e.message}`);
  }
  writeFileSync(PID_FILE, "");
}

function start() {
  if (isRunning()) {
    log(`Bot is already running (PID ${readFileSync(PID_FILE, "utf8").trim()}). Use 'restart' or 'stop' first.`);
    return;
  }
  mkdirSync(DATA_DIR, { recursive: true });
  const out = openSync(LOG_FILE, "a");
  const child = spawn("node", ["--env-file-if-exists=.env", "src/bot.js"], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, out],
  });
  const pid = child.pid;
  writeFileSync(PID_FILE, String(pid));
  child.unref();
  log(`Started bot (PID ${pid}). Logs: data/bot.log`);
  setTimeout(() => {
    if (isRunning()) {
      log(`✅ Bot is up. (PID ${pid})`);
    } else {
      log(`⚠️  Bot exited quickly — check data/bot.log for errors.`);
    }
  }, 3500);
}

function tailLog(lines = 15) {
  if (!existsSync(LOG_FILE)) {
    log("No log file yet.");
    return;
  }
  const content = readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
  for (const line of content.slice(-lines)) log(`  ${line}`);
}

function status() {
  const running = isRunning();
  log(`Running:   ${running ? "🟢 YES" : "🔴 NO"}`);
  if (running) log(`PID:       ${readFileSync(PID_FILE, "utf8").trim()}`);
  log(`Log file:  data/bot.log`);
  log(`\nLast log lines:`);
  tailLog(8);
}

function restart() {
  stop();
  const startTime = Date.now();
  while (isRunning() && Date.now() - startTime < 5000) {
    try {
      execSync("sleep 0.2");
    } catch {}
  }
  start();
}

function cleanLogs(maxBytes = 5 * 1024 * 1024) {
  if (!existsSync(LOG_FILE)) return log("No log file to clean.");
  const size = statSync(LOG_FILE).size;
  if (size > maxBytes) {
    writeFileSync(LOG_FILE, "");
    log("Log file was large, cleared it.");
  } else {
    log(`Log file is ${(size / 1024).toFixed(1)} KB — fine.`);
  }
}

const actions = { start, stop, restart, status, logs: tailLog, clean: cleanLogs };

if (!actions[command]) {
  log(`Usage: node src/control.js <start|stop|restart|status|logs|clean>`);
  process.exit(1);
}

actions[command]();
