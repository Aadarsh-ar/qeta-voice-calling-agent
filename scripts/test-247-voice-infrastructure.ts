import "dotenv/config";
import { prisma } from "../src/lib/db/prisma.js";
import { RoomServiceClient, SipClient, AccessToken, AgentDispatchClient } from "livekit-server-sdk";
import WebSocket from "ws";

interface TestResult {
  name: string;
  category: string;
  status: "PASS" | "FAIL" | "WARN";
  latencyMs: number;
  details: string;
}

const results: TestResult[] = [];

async function runCheck(
  name: string,
  category: string,
  fn: () => Promise<string>
) {
  const start = Date.now();
  try {
    const details = await fn();
    const latencyMs = Date.now() - start;
    results.push({ name, category, status: "PASS", latencyMs, details });
    console.log(`✅ [PASS] ${name} (${latencyMs}ms) — ${details}`);
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    results.push({ name, category, status: "FAIL", latencyMs, details: err?.message || String(err) });
    console.error(`❌ [FAIL] ${name} (${latencyMs}ms) — ${err?.message || err}`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("QETA — 24/7 PRODUCTION REALTIME INFRASTRUCTURE VERIFICATION SUITE");
  console.log("================================================================================\n");

  const livekitUrl = process.env.LIVEKIT_URL || "wss://ai-voice-agent-44qkuva3.livekit.cloud";
  const livekitHost = livekitUrl.replace(/^wss:\/\//, "https://");
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const deepgramKey = process.env.DEEPGRAM_API_KEY!;
  const groqKey = process.env.GROQ_API_KEY!;
  const cartesiaKey = process.env.CARTESIA_API_KEY!;
  const cartesiaVoiceId = process.env.CARTESIA_VOICE_ID || "41508a7d-4839-445f-ba7f-687f620ed0e7";

  // 1. Database & Tenancy Check
  await runCheck("PostgreSQL (Neon) Database Connection", "Database", async () => {
    const count = await prisma.agent.count();
    const active = await prisma.agent.findFirst({ where: { status: "ACTIVE" } });
    return `Connected. Total agents in DB: ${count}. Active agent: "${active?.name || "None"}" (${active?.id || "N/A"})`;
  });

  // 2. LiveKit Cloud API Authentication
  await runCheck("LiveKit Cloud Room Service API", "LiveKit", async () => {
    const rsc = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    const rooms = await rsc.listRooms();
    return `Authenticated to ${livekitHost}. Active rooms currently open: ${rooms.length}`;
  });

  // 3. LiveKit SIP Outbound Trunk Connectivity (Vobiz)
  await runCheck("LiveKit SIP Outbound Trunk (Vobiz)", "Telephony", async () => {
    const sipClient = new SipClient(livekitHost, apiKey, apiSecret);
    const trunks = await sipClient.listSipOutboundTrunk();
    const vobizTrunk = trunks.find(t => t.sipTrunkId === "ST_9Q74KhnAwJjj" || t.address.includes("vobiz.ai"));
    if (!vobizTrunk) {
      throw new Error(`Vobiz trunk ST_9Q74KhnAwJjj not found in ${trunks.length} trunks`);
    }
    return `Trunk found: "${vobizTrunk.name}" (ID: ${vobizTrunk.sipTrunkId}, Address: ${vobizTrunk.address}, Numbers: ${vobizTrunk.numbers.join(", ")})`;
  });

  // 4. Deepgram Nova-3 Multilingual STT Realtime WebSocket
  await runCheck("Deepgram Nova-3 Multilingual STT WebSocket", "STT", async () => {
    return new Promise((resolve, reject) => {
      const url = "wss://api.deepgram.com/v1/listen?model=nova-3&language=multi";
      const ws = new WebSocket(url, {
        headers: { Authorization: `Token ${deepgramKey}` },
      });
      const timeout = setTimeout(() => {
        ws.terminate();
        reject(new Error("Deepgram WebSocket handshake timeout after 5000ms"));
      }, 5000);

      ws.on("open", () => {
        clearTimeout(timeout);
        ws.close();
        resolve("Streaming handshake succeeded for model=nova-3, language=multi (Telugu/English/Tenglish)");
      });

      ws.on("unexpected-response", (_req, res) => {
        clearTimeout(timeout);
        let body = "";
        res.on("data", c => body += c);
        res.on("end", () => reject(new Error(`Deepgram rejected with HTTP ${res.statusCode}: ${body}`)));
      });

      ws.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  // 5. Groq LLM Streaming Inference
  await runCheck("Groq LLM Ultra-Low Latency Inference", "LLM", async () => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen/qwen3.8-27b",
        messages: [
          { role: "system", content: "You are Harika, an AI voice employee. Keep response to 1 short sentence." },
          { role: "user", content: "హాయ్, మీ సర్వీస్ గురించి చెప్పండి." },
        ],
        max_tokens: 60,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return `Model: qwen/qwen3.8-27b, Response: "${text}"`;
  });

  // 6. Cartesia Sonic Streaming TTS with Cloned Voice
  await runCheck("Cartesia Sonic Streaming TTS (Harika Cloned Voice)", "TTS", async () => {
    const res = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "X-API-Key": cartesiaKey,
        "Cartesia-Version": "2024-06-10",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "sonic-3.6",
        transcript: "నమస్తే అండి, నేను హారిక మాట్లాడుతున్నాను.",
        voice: { mode: "id", id: cartesiaVoiceId },
        output_format: {
          container: "raw",
          encoding: "pcm_s16le",
          sample_rate: 24000,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Cartesia HTTP ${res.status}: ${await res.text()}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const byteLength = arrayBuffer.byteLength;
    if (byteLength === 0) {
      throw new Error("Zero-byte audio payload received from Cartesia");
    }
    const durationSec = (byteLength / (24000 * 2)).toFixed(2);
    return `Received ${byteLength} raw PCM audio bytes (~${durationSec}s speech) for voice ID ${cartesiaVoiceId}`;
  });

  // 7. LiveKit Room & Agent Dispatch Lifecycle
  await runCheck("LiveKit Room & Agent Dispatch Lifecycle", "Agent Runtime", async () => {
    const roomName = `test_health_${Date.now()}`;
    const rsc = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    const room = await rsc.createRoom({ name: roomName, emptyTimeout: 30 });

    const adc = new AgentDispatchClient(livekitHost, apiKey, apiSecret);
    const dispatch = await adc.createDispatch(roomName, "", {
      metadata: JSON.stringify({ isHealthCheck: true }),
    });

    // Cleanup test room
    setTimeout(async () => {
      try { await rsc.deleteRoom(roomName); } catch {}
    }, 15000);

    return `Room created: ${room.name} (SID: ${room.sid}), Agent dispatch ID: ${dispatch.id}`;
  });

  // 8. Next.js Web Control Plane API (/api/demo/session)
  await runCheck("Next.js Control Plane Demo Session API", "Control Plane", async () => {
    const res = await fetch("http://localhost:3000/api/demo/session", {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(`Endpoint returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    if (!data.success || !data.token || !data.livekitUrl) {
      throw new Error(`Invalid response schema: ${JSON.stringify(data)}`);
    }

    return `Minted JWT token for room: ${data.roomName}, Participant: ${data.participantIdentity}`;
  });

  // 9. LiveKit SIP Outbound Call Pre-Flight Check
  await runCheck("LiveKit SIP Outbound Call API Validation", "Telephony", async () => {
    const res = await fetch("http://localhost:3000/api/calls/outbound", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: "+916305367443",
        agentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
      }),
    });

    const data = await res.json();
    if (!data.success || data.telephony?.status !== "RINGING") {
      throw new Error(`Call dispatch failed: ${JSON.stringify(data)}`);
    }

    return `SIP Call successfully queued with LiveKit SIP ID: ${data.telephony.vobizCallId} (Status: ${data.telephony.status})`;
  });

  // 10. Call Record Persistence in PostgreSQL
  await runCheck("PostgreSQL Call Record Persistence", "Database", async () => {
    const latestCall = await prisma.call.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latestCall) {
      throw new Error("No call records found in database");
    }

    return `Latest Call ID: ${latestCall.id} | LiveKit Room: ${latestCall.livekitRoom || "N/A"} | SIP Call ID: ${latestCall.livekitSipCallId || latestCall.vobizCallId || "N/A"} | Status: ${latestCall.status}`;
  });

  console.log("\n================================================================================");
  console.log("FINAL TEST SUMMARY");
  console.log("================================================================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const failed = results.filter(r => r.status === "FAIL").length;
  console.log(`Total Checks: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  if (failed === 0) {
    console.log("🎉 ALL REALTIME & 24/7 INFRASTRUCTURE CHECKS PASSED SUCCESSFULLY!");
  } else {
    console.error(`⚠️ ${failed} check(s) failed. See logs above.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
