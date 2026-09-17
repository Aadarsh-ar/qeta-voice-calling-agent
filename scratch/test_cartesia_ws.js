import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import WebSocket from "ws";

const apiKey = process.env.CARTESIA_API_KEY;
const agentId = "agent_Pv4hHbMWRubDumrq4v4L15";

console.log("Testing direct Cartesia WebSocket connection with API key...");
const t0 = Date.now();
const wsUrl = `wss://api.cartesia.ai/v1/agents/websocket/${agentId}?cartesia_version=2026-08-14&api_key=${apiKey}`;
const ws = new WebSocket(wsUrl);

ws.on("open", () => {
  console.log(`[SUCCESS] Connected to Cartesia Agent in ${Date.now() - t0}ms`);
  ws.send(
    JSON.stringify({
      type: "session_create",
      audio: {
        input_format: "mulaw_8000",
        output_delivery: "speaking_pace",
      },
    })
  );
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  console.log(`[CARTESIA_EVENT] type=${msg.type} in ${Date.now() - t0}ms`);
  if (msg.type === "session_ready") {
    console.log("[SUCCESS] Session is ready!", msg);
    ws.close();
  }
});

ws.on("error", (err) => {
  console.error("[ERROR] WebSocket error:", err.message);
});

ws.on("close", (code, reason) => {
  console.log(`[CLOSED] code=${code}`);
  process.exit(0);
});
