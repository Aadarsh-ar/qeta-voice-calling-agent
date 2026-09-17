import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

let currentUrl = "";
let sshProcess = null;
let healthCheckInterval = null;

function updateEnv(url) {
  if (!url || !existsSync(envPath)) return;
  let content = readFileSync(envPath, "utf-8");
  content = content.replace(/PUBLIC_BASE_URL=.*/g, `PUBLIC_BASE_URL=${url}`);
  content = content.replace(/VOBIZ_WEBHOOK_URL=.*/g, `VOBIZ_WEBHOOK_URL=${url}`);
  content = content.replace(/NEXT_PUBLIC_SERVER_URL=.*/g, `NEXT_PUBLIC_SERVER_URL=${url}`);
  writeFileSync(envPath, content, "utf-8");
  process.env.PUBLIC_BASE_URL = url;
  process.env.VOBIZ_WEBHOOK_URL = url;
  process.env.NEXT_PUBLIC_SERVER_URL = url;
  console.log(`[TUNNEL_SUPERVISOR] Updated .env.local with active URL: ${url}`);
}

async function checkTunnelHealth() {
  if (!currentUrl) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${currentUrl}/api/vobiz/call-status`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      return;
    }
  } catch (err) {
    console.warn(`[TUNNEL_HEALTH] Health check failed for ${currentUrl} (${err.message}). Restarting tunnel...`);
    if (sshProcess) {
      sshProcess.kill();
    }
  }
}

function startTunnel() {
  console.log("[TUNNEL_SUPERVISOR] Starting persistent SSH tunnel via serveo.net...");
  currentUrl = "";

  sshProcess = spawn("ssh", [
    "-o", "StrictHostKeyChecking=no",
    "-o", "ServerAliveInterval=10",
    "-o", "ServerAliveCountMax=3",
    "-R", "80:localhost:3000",
    "serveo.net"
  ]);

  sshProcess.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    console.log(`[SSH_OUT] ${text.trim()}`);

    const match = text.match(/https:\/\/[a-zA-Z0-9\-]+\.serveousercontent\.com/);
    if (match && match[0] !== currentUrl) {
      currentUrl = match[0];
      console.log(`\n========================================`);
      console.log(`🎯 ACTIVE TELEPHONY TUNNEL: ${currentUrl}`);
      console.log(`========================================\n`);
      updateEnv(currentUrl);

      if (healthCheckInterval) clearInterval(healthCheckInterval);
      healthCheckInterval = setInterval(checkTunnelHealth, 20000);
    }

    if (text.includes("expired") || text.includes("closed") || text.includes("terminated") || text.includes("Connection reset")) {
      console.warn("[TUNNEL_SUPERVISOR] Port forwarding closed or expired. Killing process to reconnect...");
      if (sshProcess) sshProcess.kill();
    }
  });

  sshProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    if (!text.includes("Pseudo-terminal will not be allocated")) {
      console.warn(`[SSH_ERR] ${text.trim()}`);
    }
    if (text.includes("Connection closed") || text.includes("Permission denied")) {
      console.warn("[TUNNEL_SUPERVISOR] SSH connection error. Reconnecting...");
      if (sshProcess) sshProcess.kill();
    }
  });

  sshProcess.on("close", (code) => {
    console.warn(`[TUNNEL_SUPERVISOR] Tunnel disconnected (code ${code}). Reconnecting in 1 second...`);
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    setTimeout(startTunnel, 1000);
  });

  sshProcess.on("error", (err) => {
    console.error(`[TUNNEL_SUPERVISOR] SSH error: ${err.message}. Reconnecting...`);
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    setTimeout(startTunnel, 1000);
  });
}

startTunnel();
