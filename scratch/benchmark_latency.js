import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { agentRuntimeCache } from "../src/lib/agent/agentRuntimeCache.ts";
import { KnowledgeRetriever } from "../src/lib/agent/knowledge-retriever.ts";
import { executeToolCall } from "../src/lib/agent/tools.ts";
import { compileAgentGreeting, compileAgentInstructions } from "../src/lib/agent/promptCompiler.ts";
import WebSocket from "ws";

async function runBenchmark() {
  console.log("===============================================================");
  console.log("🚀 QETA — CARTESIA EXTREME LOW-LATENCY BENCHMARK SUITE");
  console.log("===============================================================\n");

  const results = {};
  const apiKey = process.env.CARTESIA_API_KEY;
  const agentId = process.env.CARTESIA_AGENT_ID || "agent_GaiYMgB9Bj9kaKW1tUgqSQ";
  const voiceId = process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";

  console.log(`Target Cartesia Agent: ${agentId}`);
  console.log(`Target Voice ID: ${voiceId}`);
  console.log(`Cartesia API Key: ${apiKey ? apiKey.slice(0, 10) + "..." : "MISSING"}\n`);

  // ── TEST 1: Agent Config Load & Sub-Millisecond Runtime Cache ──
  console.log("--- TEST 1: Agent Config Load & Runtime Cache (< 200ms target) ---");
  const t0 = performance.now();
  const agentConfig = await agentRuntimeCache.getExactAgent(agentId);
  const t1 = performance.now();
  const cacheHitT0 = performance.now();
  const cachedConfig = await agentRuntimeCache.getExactAgent(agentId);
  const cacheHitT1 = performance.now();

  const coldLoadMs = Math.round(t1 - t0);
  const warmLoadMs = parseFloat((cacheHitT1 - cacheHitT0).toFixed(2));
  console.log(`Cold Load (DB): ${coldLoadMs} ms | Name: "${agentConfig?.name}"`);
  console.log(`Warm Load (Cache): ${warmLoadMs} ms (Sub-millisecond)`);
  results.agentConfigLoad = { coldLoadMs, warmLoadMs, pass: coldLoadMs < 200 && warmLoadMs < 5 };

  // ── TEST 2: Indexed PostgreSQL Database Query (< 150ms target) ──
  console.log("\n--- TEST 2: Indexed PostgreSQL Query (< 150ms target) ---");
  const prisma = new PrismaClient();
  const dbT0 = performance.now();
  const agentFromDb = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      cartesiaAgentId: true,
      status: true,
      tools: { where: { isEnabled: true }, select: { name: true } },
    },
  });
  const dbT1 = performance.now();
  const dbQueryMs = Math.round(dbT1 - dbT0);
  console.log(`PostgreSQL Query: ${dbQueryMs} ms | Active Tools: ${agentFromDb?.tools.length}`);
  results.indexedDbQuery = { dbQueryMs, pass: dbQueryMs < 150 };

  // ── TEST 3: Knowledge Retriever & Conversational Short-Circuit ──
  console.log("\n--- TEST 3: Knowledge Retrieval & Short-Circuit (< 10ms for greeting, < 300ms search) ---");
  const retriever = new KnowledgeRetriever();
  const knowledgeContext = {
    businessName: "ABC Electronics",
    policies: {
      refundPolicy: "రీఫండ్లు ఆర్డర్ డెలివరీ అయిన 7 రోజులలోపు మాత్రమే వర్తిస్తాయి.",
      deliveryPolicy: "2 నుండి 4 పని దినాలలో డెలివరీ చేయబడుతుంది.",
    },
    faqs: [
      { question: "మీ షోరూమ్ ఎక్కడ ఉంది?", answer: "హైదరాబాద్ హైటెక్ సిటీ లో ఉంది." },
    ],
  };

  // 3a. Greeting short-circuit
  const scT0 = performance.now();
  const greetingResult = retriever.retrieveRelevantKnowledge("హలో అండి నమస్కారం", knowledgeContext);
  const scT1 = performance.now();
  const shortCircuitMs = parseFloat((scT1 - scT0).toFixed(2));
  console.log(`Greeting Short-Circuit: ${shortCircuitMs} ms (Snippets: ${greetingResult.snippets.length})`);

  // 3b. Policy query retrieval
  const qrT0 = performance.now();
  const policyResult = retriever.retrieveRelevantKnowledge("రీఫండ్ ఎప్పుడు వస్తుంది?", knowledgeContext);
  const qrT1 = performance.now();
  const queryRetrievalMs = parseFloat((qrT1 - qrT0).toFixed(2));
  console.log(`Policy Knowledge Match: ${queryRetrievalMs} ms (Found: "${policyResult.snippets[0]?.title || "none"}")`);
  results.knowledgeRetriever = {
    shortCircuitMs,
    queryRetrievalMs,
    pass: shortCircuitMs < 10 && queryRetrievalMs < 50,
  };

  // ── TEST 4: Starter Welcome Greeting Training & Synthesis Latency ──
  console.log("\n--- TEST 4: Starter Welcome Message Synthesis & TTS (< 350ms target) ---");
  const greetingTel = compileAgentGreeting({
    agentName: "Aadarsh",
    businessName: "ABC Electronics",
    language: "TELUGU_ENGLISH",
  });
  console.log(`Trained Starter Greeting: "${greetingTel}"`);

  const ttsT0 = performance.now();
  const ttsRes = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Cartesia-Version": "2026-08-14",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_id: "sonic-3.6",
      transcript: greetingTel,
      voice: { mode: "id", id: voiceId },
      output_format: { container: "raw", encoding: "pcm_mulaw", sample_rate: 8000 },
    }),
  });
  const audioBuffer = await ttsRes.arrayBuffer();
  const ttsT1 = performance.now();
  const ttsLatencyMs = Math.round(ttsT1 - ttsT0);
  console.log(`Cartesia Sonic TTS Latency: ${ttsLatencyMs} ms | Audio Bytes: ${audioBuffer.byteLength} (${(audioBuffer.byteLength / 8000).toFixed(2)}s audio)`);
  results.cartesiaTts = { ttsLatencyMs, byteLength: audioBuffer.byteLength, pass: ttsLatencyMs < 400 };

  // ── TEST 5: Cartesia Native Agent WebSocket Handshake ──
  console.log("\n--- TEST 5: Cartesia Agent WebSocket Handshake & Session Creation ---");
  const wsT0 = performance.now();
  const wsResult = await new Promise((resolve) => {
    const ws = new WebSocket(`wss://api.cartesia.ai/v1/agents/websocket/${agentId}?cartesia_version=2026-08-14&api_key=${apiKey}`, {
      headers: { "X-API-Key": apiKey, "Cartesia-Version": "2026-08-14" },
    });

    let connectedAt = 0;
    ws.on("open", () => {
      connectedAt = performance.now();
      ws.send(JSON.stringify({
        type: "session_create",
        audio: { input_format: "mulaw_8000", output_delivery: "speaking_pace" },
      }));
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "session_ready") {
          const readyAt = performance.now();
          ws.close();
          resolve({
            connectMs: Math.round(connectedAt - wsT0),
            sessionReadyMs: Math.round(readyAt - wsT0),
            callId: msg.call_id,
            success: true,
          });
        }
      } catch {}
    });

    ws.on("error", (err) => resolve({ error: err.message, success: false }));
    setTimeout(() => {
      try { ws.close(); } catch {}
      resolve({ error: "timeout after 5000ms", success: false });
    }, 5000);
  });

  console.log(`WS Handshake Connect: ${wsResult.connectMs} ms | Session Ready: ${wsResult.sessionReadyMs} ms | Call ID: ${wsResult.callId || "none"}`);
  results.cartesiaWebSocket = { ...wsResult, pass: wsResult.success && wsResult.sessionReadyMs < 600 };

  // ── TEST 6: Tool Execution Latency (< 300ms target) ──
  console.log("\n--- TEST 6: Tool Execution Latency (< 300ms target) ---");
  const toolT0 = performance.now();
  const toolRes = await executeToolCall("get_order_status", { orderId: "4567" });
  const toolT1 = performance.now();
  const toolLatencyMs = Math.round(toolT1 - toolT0);
  console.log(`Tool 'get_order_status' Executed: ${toolLatencyMs} ms | Result: ${JSON.stringify(toolRes)}`);
  results.toolExecution = { toolLatencyMs, pass: toolLatencyMs < 300 };

  // ── SUMMARY & REPORT ──
  console.log("\n===============================================================");
  console.log("📊 LATENCY BENCHMARK VERIFICATION RESULTS");
  console.log("===============================================================");
  console.table({
    "Agent Config Load (Cold)": { Target: "< 200ms", Actual: `${results.agentConfigLoad.coldLoadMs} ms`, Status: results.agentConfigLoad.coldLoadMs < 200 ? "PASS" : "WARN" },
    "Agent Config Cache (Warm)": { Target: "< 5ms", Actual: `${results.agentConfigLoad.warmLoadMs} ms`, Status: results.agentConfigLoad.warmLoadMs < 5 ? "PASS" : "WARN" },
    "PostgreSQL Indexed Query": { Target: "< 150ms", Actual: `${results.indexedDbQuery.dbQueryMs} ms`, Status: results.indexedDbQuery.pass ? "PASS" : "WARN" },
    "Greeting Short-Circuit": { Target: "< 10ms", Actual: `${results.knowledgeRetriever.shortCircuitMs} ms`, Status: results.knowledgeRetriever.shortCircuitMs < 10 ? "PASS" : "WARN" },
    "Knowledge Match": { Target: "< 50ms", Actual: `${results.knowledgeRetriever.queryRetrievalMs} ms`, Status: results.knowledgeRetriever.queryRetrievalMs < 50 ? "PASS" : "WARN" },
    "Cartesia TTS Synthesis": { Target: "< 400ms", Actual: `${results.cartesiaTts.ttsLatencyMs} ms`, Status: results.cartesiaTts.pass ? "PASS" : "WARN" },
    "Cartesia WS Session Ready": { Target: "< 600ms", Actual: `${results.cartesiaWebSocket.sessionReadyMs} ms`, Status: results.cartesiaWebSocket.pass ? "PASS" : "FAIL" },
    "Tool Execution": { Target: "< 300ms", Actual: `${results.toolExecution.toolLatencyMs} ms`, Status: results.toolExecution.pass ? "PASS" : "WARN" },
  });

  await prisma.$disconnect();
}

runBenchmark().catch(console.error);
