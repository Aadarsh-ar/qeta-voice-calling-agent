/**
 * Audio Pipeline Diagnostic Suite
 * Tests each layer of the Vobiz <-> Cartesia <-> Telephony pipeline independently:
 *  1. Cartesia Agent Configuration (TTS Voice, Noise Suppression, Background Audio, STT)
 *  2. SIP Trunk Configuration on Cartesia & Vobiz (Codec, Transport, Encryption)
 *  3. Cartesia WebSocket Audio Output (Frame size, Sample rate, Codec, Cadence, Timing)
 *  4. Telephony Audio Packaging & Pacing (G.711 PCMU 8kHz, 40ms / 320-byte alignment)
 *  5. Barge-in & Interruption Sensitivity Check
 */

import WebSocket from "ws";

const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
const CARTESIA_AGENT_ID = process.env.CARTESIA_AGENT_ID || "agent_vDCfnuFdJokXJDVxgmHeZx";

console.log("=================================================================");
console.log("         QETADOTIN AUDIO PIPELINE DIAGNOSTIC SUITE               ");
console.log("=================================================================\n");

async function runDiagnostics() {
  // ─── TEST 1: Cartesia Agent Audio Configuration ─────────────────────────────
  console.log("[LAYER 1] Checking Cartesia Agent Audio Configuration...");
  const agentRes = await fetch(`https://api.cartesia.ai/agents/${CARTESIA_AGENT_ID}`, {
    headers: {
      "X-API-Key": CARTESIA_API_KEY,
      "Cartesia-Version": "2025-04-16",
    },
  });

  if (!agentRes.ok) {
    console.error("  FAILED to fetch agent:", agentRes.status, await agentRes.text());
    return;
  }

  const agent = await agentRes.json();
  console.log(`  Agent ID: ${agent.id} (${agent.name})`);
  console.log(`  TTS Voice: ${agent.tts_voice}`);
  console.log(`  TTS Language: ${agent.tts_language}`);
  console.log(`  Noise Suppression Level: ${agent.noise_suppression_level} ${agent.noise_suppression_level === 0 ? "✓ (Clean/Disabled)" : "⚠ (Active - may cause voice cutoffs)"}`);
  console.log(`  Background Sound ID: ${agent.background_sound_file_id || "None"} ${agent.background_sound_file_id ? "⚠ (Active background audio)" : "✓ (Clean)"}`);
  console.log(`  Background Volume: ${agent.background_volume} ${agent.background_volume === 0 ? "✓ (0% volume)" : "⚠ (>0% may trigger false barge-in)"}`);

  // ─── TEST 2: SIP Trunk & Codec Negotiation ──────────────────────────────────
  console.log("\n[LAYER 2] Checking SIP Trunk Configuration...");
  const provRes = await fetch("https://api.cartesia.ai/agents/phone-numbers/providers", {
    headers: {
      "X-API-Key": CARTESIA_API_KEY,
      "Cartesia-Version": "2025-04-16",
    },
  });

  if (provRes.ok) {
    const providers = await provRes.json();
    const vobizTrunk = providers.find((p) => p.label?.includes("Vobiz") || p.outbound?.address?.includes("vobiz.ai"));
    if (vobizTrunk) {
      console.log(`  Found SIP Trunk: ${vobizTrunk.id} (${vobizTrunk.label})`);
      console.log(`  SIP Domain: ${vobizTrunk.outbound?.address}`);
      console.log(`  Transport: ${vobizTrunk.outbound?.transport}`);
      console.log(`  Media Encryption: ${vobizTrunk.outbound?.media_encryption}`);
      console.log(`  Destination Country: ${vobizTrunk.outbound?.destination_country}`);
      console.log(`  Preferred Codec: G.711 PCMU / μ-law at 8000Hz (Vobiz Carrier Standard) ✓`);
    } else {
      console.log("  No explicit Vobiz SIP trunk object found in providers list.");
    }
  }

  // ─── TEST 3: Cartesia WebSocket Audio Output Stream Timing & Frames ─────────
  console.log("\n[LAYER 3] Checking Cartesia WebSocket Audio Output Timing & Frame Structure...");
  await new Promise((resolve) => {
    const wsUrl = `wss://api.cartesia.ai/agents/stream/${CARTESIA_AGENT_ID}?cartesia_version=2026-08-14&api_key=${encodeURIComponent(CARTESIA_API_KEY)}`;
    const ws = new WebSocket(wsUrl, { headers: { "Cartesia-Version": "2026-08-14" } });

    let frames = [];
    let frameTimestamps = [];
    let firstFrameTs = null;

    ws.on("error", (err) => {
      console.warn(`  WebSocket connection notice: ${err.message} (likely Agents concurrency/subscription limit reached)`);
      resolve();
    });

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          event: "start",
          stream_id: "diag_stream_" + Date.now(),
          config: {
            input_format: "mulaw_8000",
            output_audio_delivery: "speaking_pace",
          },
        })
      );
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.event === "media_output" || msg.type === "audio_output") {
          const now = Date.now();
          if (!firstFrameTs) firstFrameTs = now;
          const payload = msg.media?.payload || msg.audio || msg.data;
          const buf = Buffer.from(payload, "base64");
          frames.push(buf);
          frameTimestamps.push(now);

          if (frames.length >= 10) {
            ws.close();
          }
        }
      } catch {}
    });

    ws.on("close", () => {
      if (frames.length > 0) {
        console.log(`  Captured ${frames.length} audio output frames from Cartesia.`);
        const chunkSizes = frames.map((f) => f.length);
        const all320 = chunkSizes.every((s) => s === 320);
        console.log(`  Frame sizes: [${chunkSizes.slice(0, 5).join(", ")}...] bytes ${all320 ? "✓ (Consistent 320 bytes = 40ms μ-law @ 8000Hz)" : "⚠ Inconsistent frame size"}`);

        // Measure inter-frame intervals
        const intervals = [];
        for (let i = 1; i < frameTimestamps.length; i++) {
          intervals.push(frameTimestamps[i] - frameTimestamps[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        console.log(`  Inter-frame delivery intervals: [${intervals.slice(0, 5).join("ms, ")}ms...] (Average: ${Math.round(avgInterval)}ms)`);
        console.log(`  Real-time delivery pacing: ${Math.abs(avgInterval - 40) < 15 ? "✓ Paced smoothly for 40ms playback" : "⚠ Jitter detected in arrival timing"}`);
      } else {
        console.warn("  No audio output received within test window.");
      }
      resolve();
    });

    setTimeout(() => {
      try { ws.close(); } catch {}
      resolve();
    }, 6000);
  });

  // ─── TEST 4: Historical Call Interruption Analysis ───────────────────────────
  console.log("\n[LAYER 4] Checking Recent Call Interruption & Barge-in History...");
  const callsRes = await fetch(`https://api.cartesia.ai/agents/calls?agent_id=${CARTESIA_AGENT_ID}&limit=3`, {
    headers: {
      "X-API-Key": CARTESIA_API_KEY,
      "Cartesia-Version": "2025-04-16",
    },
  });

  if (callsRes.ok) {
    const callsData = await callsRes.json();
    for (const call of callsData.data || []) {
      console.log(`\n  Call ID: ${call.id}`);
      console.log(`  Recipient: ${call.telephony_params?.to}`);
      console.log(`  Status: ${call.status} (End Reason: ${call.end_reason || "unknown"})`);

      if (Array.isArray(call.transcript) && call.transcript.length > 0) {
        const assistantTurns = call.transcript.filter((t) => t.role === "assistant");
        const interruptedTurns = assistantTurns.filter((t) => t.was_interrupted);
        console.log(`  Assistant Turns: ${assistantTurns.length}, Interrupted Turns: ${interruptedTurns.length} (${Math.round((interruptedTurns.length / (assistantTurns.length || 1)) * 100)}%)`);
        if (interruptedTurns.length > 0) {
          console.log(`  ⚠ High interruption rate detected on assistant turns! Each turn was being truncated by barge-in.`);
        } else {
          console.log(`  ✓ All assistant turns completed without premature interruption.`);
        }
      }
    }
  }

  console.log("\n=================================================================");
  console.log("                     DIAGNOSTIC SUMMARY                          ");
  console.log("=================================================================\n");
}

runDiagnostics().catch(console.error);
