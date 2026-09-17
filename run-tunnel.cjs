const { spawn } = require("child_process");

console.log("[TUNNEL] Launching Cloudflare Tunnel for voice.qeta.in -> http://localhost:3000");

const cp = spawn("cloudflared", ["tunnel", "run", "qeta-voice"], {
  stdio: "inherit",
  shell: true,
});

cp.on("error", (err) => {
  console.error("[TUNNEL_ERROR]", err);
  process.exit(1);
});

cp.on("exit", (code) => {
  console.log(`[TUNNEL] Process exited with code ${code}`);
  process.exit(code || 0);
});
