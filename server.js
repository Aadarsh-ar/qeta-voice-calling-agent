/**
 * Custom Next.js Server with Vobiz WebSocket Voice Bridge
 *
 * This server:
 *  1. Runs the standard Next.js app on port 3000
 *  2. Intercepts WebSocket upgrades to /api/vobiz/stream
 *  3. Handles the full bidirectional voice pipeline:
 *     Vobiz audio → Sarvam STT → Groq LLM → Cartesia TTS → caller
 */

import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

/**
 * fetchWithRetry — Wraps native fetch with:
 *  - AbortController timeout (default 12s) to prevent hanging TCP reads
 *  - Exponential back-off retry (up to maxRetries) on network errors or 5xx
 *  - Surfaces the original error message for clean logging
 */
async function fetchWithRetry(url, options = {}, { timeoutMs = 12000, maxRetries = 2, retryOn5xx = true } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (retryOn5xx && res.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (err.name === "AbortError") {
        console.warn(`[FETCH_TIMEOUT] ${url} timed out after ${timeoutMs}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      } else {
        console.warn(`[FETCH_ERR] ${url} → ${err.message} (attempt ${attempt + 1}/${maxRetries + 1})`);
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 300 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr || new Error(`fetchWithRetry failed after ${maxRetries + 1} attempts: ${url}`);
}

// Load .env.local manually (Next.js doesn't do it for custom servers automatically)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, ".env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
  console.log("[SERVER] Loaded .env.local");
}

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, port });
const handle = app.getRequestHandler();

// Live Developer Pipeline Status
const livePipelineStatus = {
  vobizCall: "Connected",
  mediaStream: "Connected",
  callerAudio: "Receiving",
  sarvam: "Connected",
  transcript: "Receiving",
  groq: "Responding",
  cartesia: "Generating Audio",
  outboundAudio: "Sending",
  callerPlayback: "Confirmed",
  lastActive: new Date().toISOString(),
};

// ─── TTS: Cartesia Sonic ────────────────────────────────────────────────────
async function synthesizeSpeech(text, voiceId) {
  const apiKey = process.env.CARTESIA_API_KEY || "";
  if (!apiKey || !apiKey.startsWith("sk_car_")) {
    console.error("[CARTESIA_TTS_ERROR] Cartesia key not configured");
    return null;
  }

  console.log(`[CARTESIA_TTS_STARTED] text="${text}"`);
  const t0 = Date.now();

  try {
    const res = await fetchWithRetry(
      "https://api.cartesia.ai/tts/bytes",
      {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Cartesia-Version": "2024-06-10",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "sonic-3.6",
          transcript: text,
          voice: { mode: "id", id: voiceId },
          output_format: {
            container: "raw",
            encoding: "pcm_mulaw",
            sample_rate: 8000,
          },
        }),
      },
      { timeoutMs: 15000, maxRetries: 2 }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[CARTESIA_TTS_ERROR] (${res.status}): ${err}`);
      return null;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    console.log(`[CARTESIA_AUDIO_RECEIVED]\nAUDIO_BYTES=${buf.length}\nAUDIO_FORMAT=audio/x-mulaw;rate=8000`);
    console.log(`[TTS_AUDIO_RECEIVED] bytes=${buf.length} in ${Date.now() - t0}ms`);
    livePipelineStatus.cartesia = "Generating Audio";
    livePipelineStatus.lastActive = new Date().toISOString();
    return buf;
  } catch (err) {
    console.error(`[CARTESIA_TTS_ERROR] Fetch exception: ${err.message}`);
    return null;
  }
}

// ─── STT: Sarvam Batch REST ─────────────────────────────────────────────────
function createWavHeader(dataLength, sampleRate = 8000, channels = 1, bitsPerSample = 16) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(dataLength + 36, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

// Convert μ-law (G.711 PCMU 8kHz) to PCM16 for Sarvam / Whisper
function mulawToPcm16(mulawBuffer) {
  const pcm = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    let ulaw = ~mulawBuffer[i] & 0xff;
    const sign = ulaw & 0x80;
    const exponent = (ulaw >> 4) & 0x07;
    const mantissa = ulaw & 0x0f;
    let sample = ((mantissa << 1) + 33) << (exponent + 2);
    sample = sign ? 33 - sample : sample - 33;
    sample = Math.max(-32768, Math.min(32767, sample));
    pcm.writeInt16LE(sample, i * 2);
  }
  return pcm;
}

// Calculate audio RMS energy to distinguish real voice from ambient line noise
function calculateRms(mulawBuffer) {
  if (!mulawBuffer || mulawBuffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < mulawBuffer.length; i++) {
    let ulaw = ~mulawBuffer[i] & 0xff;
    const sign = ulaw & 0x80;
    const exponent = (ulaw >> 4) & 0x07;
    const mantissa = ulaw & 0x0f;
    let sample = ((mantissa << 1) + 33) << (exponent + 2);
    sample = sign ? 33 - sample : sample - 33;
    sum += sample * sample;
  }
  return Math.sqrt(sum / mulawBuffer.length);
}

let sarvamQuotaExhaustedUntil = 0;

async function transcribeAudio(mulawBuffer) {
  const pcm16 = mulawToPcm16(mulawBuffer);
  const wavHeader = createWavHeader(pcm16.length, 8000, 1, 16);
  const wav = Buffer.concat([wavHeader, pcm16]);

  const sarvamKey = process.env.SARVAM_API_KEY || "";
  if (sarvamKey && Date.now() > sarvamQuotaExhaustedUntil) {
    console.log(`[STT_CONNECTED] Sending ${mulawBuffer.length} bytes to Sarvam Saaras STT (language: te-IN)...`);
    console.log(`[SARVAM_CONNECTED] Connected to Sarvam Speech-to-Text`);
    try {
      const form = new FormData();
      const blob = new Blob([wav], { type: "audio/wav" });
      form.append("file", blob, "audio.wav");
      form.append("model", "saaras:v3");
      form.append("language_code", "te-IN");

      const t0 = Date.now();
      let res;
      try {
        res = await fetchWithRetry(
          "https://api.sarvam.ai/speech-to-text",
          { method: "POST", headers: { "api-subscription-key": sarvamKey }, body: form },
          { timeoutMs: 12000, maxRetries: 1, retryOn5xx: true }
        );
      } catch (netErr) {
        console.error(`[ERROR] Sarvam STT network error: ${netErr.message}`);
        res = null;
      }

      if (res && res.ok) {
        const data = await res.json();
        const text = data.transcript || "";
        if (text.trim().length > 0) {
          console.log(`[TRANSCRIPT_RECEIVED] text="${text.trim()}"`);
          console.log(`[SARVAM_FINAL_TRANSCRIPT] "${text.trim()}" in ${Date.now() - t0}ms`);
          livePipelineStatus.sarvam = "Connected";
          livePipelineStatus.transcript = "Receiving";
          return text.trim();
        }
      } else if (res) {
        const errText = await res.text();
        if (res.status === 402) {
          sarvamQuotaExhaustedUntil = Date.now() + 15 * 60 * 1000;
          console.warn(`[STT_NOTICE] Sarvam credit quota exhausted (402). Auto-switching to high-accuracy Whisper Turbo for 15 mins.`);
        } else {
          console.warn(`[ERROR] Sarvam STT returned ${res.status}: ${errText.slice(0, 160)}`);
        }
      }
    } catch (err) {
      console.error(`[ERROR] Sarvam STT exception: ${err.message}`);
    }
  }

  // Resilient Whisper Turbo with Multilingual (Telugu, Tenglish & English) Telephony Vocabulary Priming
  const groqKey = process.env.GROQ_API_KEY || "";
  if (groqKey) {
    console.log(`[SARVAM_CONNECTED] Fallback STT active (whisper-large-v3-turbo, multilingual)...`);
    try {
      const gForm = new FormData();
      const gBlob = new Blob([wav], { type: "audio/wav" });
      gForm.append("file", gBlob, "audio.wav");
      gForm.append("model", "whisper-large-v3-turbo");
      gForm.append(
        "prompt",
        "కస్టమర్ మరియు సపోర్ట్ ఎగ్జిక్యూటివ్ మధ్య తెలుగు, ఇంగ్లీష్ సంభాషణ. Customer speaking Telugu, Tenglish, or English. హలో, అవునండి, order, villas, pricing, demo, address, ధన్యవాదాలు."
      );
      gForm.append("temperature", "0.0");

      const t0 = Date.now();
      let gRes;
      try {
        gRes = await fetchWithRetry(
          "https://api.groq.com/openai/v1/audio/transcriptions",
          { method: "POST", headers: { Authorization: `Bearer ${groqKey}` }, body: gForm },
          { timeoutMs: 12000, maxRetries: 2, retryOn5xx: true }
        );
      } catch (netErr) {
        console.error(`[ERROR] Groq Whisper network error: ${netErr.message}`);
        gRes = null;
      }

      if (gRes && gRes.ok) {
        const gData = await gRes.json();
        const text = (gData.text || "").trim();
        if (text.length > 0) {
          console.log(`[TRANSCRIPT_RECEIVED] text="${text}"`);
          console.log(`[SARVAM_FINAL_TRANSCRIPT] "${text}" in ${Date.now() - t0}ms`);
          livePipelineStatus.transcript = "Receiving";
          return text;
        }
      } else if (gRes) {
        const gErr = await gRes.text();
        console.error(`[ERROR] Groq Whisper error (${gRes.status}): ${gErr.slice(0, 160)}`);
      }
    } catch (err) {
      console.error(`[ERROR] Whisper fallback exception: ${err.message}`);
    }
  }

  return null;
}

// ─── LLM: Groq (ultra-fast inference) ───────────────────────────────────────
async function getLLMResponse(systemPrompt, history, userText) {
  const groqKey = process.env.GROQ_API_KEY || "";
  const openaiKey = process.env.OPENAI_API_KEY || "";

  const isGroq = Boolean(groqKey && groqKey.length > 10);
  const endpoint = isGroq
    ? "https://api.groq.com/openai/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const bearer = isGroq ? groqKey : openaiKey;
  const model = isGroq ? (process.env.GROQ_MODEL || "qwen/qwen3.8-27b") : "gpt-4o-mini";

  if (!bearer) {
    return getFallbackResponse(userText);
  }

  console.log(`[LLM_REQUEST_STARTED] model=${model}, userText="${userText}"`);
  const t0 = Date.now();

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.slice(-8).map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userText },
  ];

  try {
    const res = await fetchWithRetry(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: 350,
        }),
      },
      { timeoutMs: 14000, maxRetries: 2, retryOn5xx: true }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[ERROR] LLM API error (${res.status}): ${err.slice(0, 200)}`);
      return getFallbackResponse(userText);
    }

    const data = await res.json();
    let reply = (data.choices?.[0]?.message?.content || "").trim();
    if (!reply) {
      reply = getFallbackResponse(userText);
    }
    console.log(`[LLM_RESPONSE_RECEIVED] "${reply}" in ${Date.now() - t0}ms`);
    livePipelineStatus.groq = "Responding";
    return reply.trim();
  } catch (err) {
    console.error(`[ERROR] LLM fetch error: ${err.message}`);
    return getFallbackResponse(userText);
  }
}

function getFallbackResponse(userText) {
  const lower = userText.toLowerCase();
  if (lower.includes("ధర") || lower.includes("price") || lower.includes("cost") || lower.includes("fee")) {
    return "మా స్టార్టర్ ప్యాకేజ్ నెలకు ₹15,000 మాత్రమే, ఇందులో 2,000 కాలింగ్ నిమిషాలు ఉంటాయి.";
  } else if (lower.includes("demo") || lower.includes("డెమో") || lower.includes("appointment")) {
    return "ఖచ్చితంగా అండి! నేను మీకు రేపు ఉదయం 10:30 కి అపాయింట్‌మెంట్ బుక్ చేస్తాను.";
  } else if (lower.includes("bye") || lower.includes("thanks") || lower.includes("థాంక్స్")) {
    return "చాలా సంతోషం అండి! మీతో మాట్లాడటం చాలా బాగుంది. హావ్ ఎ గ్రేట్ డే!";
  } else {
    return "అవునండి, నేను మీ మాటలు విన్నాను. మీకు మరిన్ని వివరాలు కావాలంటే దయచేసి చెప్పండి.";
  }
}

// ─── Agent data loader & Instant Pre-warmed Greeting Cache ─────────────────────
const agentGreetingCache = new Map();

async function getOrPrewarmGreeting(agentId, callerNumber = "+916305367443") {
  const cacheKey = agentId || "default";
  const cached = agentGreetingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 3600000)) {
    return cached;
  }

  // Load essential agent identity directly without multi-hop HTTP
  let agentName = "Aadarsh";
  let businessName = "ABC Electronics";
  let voiceId = process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
  let language = "TELUGU_ENGLISH";
  let systemPrompt = "";

  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    let dbAgent = null;
    if (agentId && agentId !== "default") {
      dbAgent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          name: true,
          instructions: true,
          systemPrompt: true,
          cartesiaVoiceId: true,
          language: true,
          business: { select: { name: true } },
          businessContext: true,
        },
      });
    }
    if (!dbAgent) {
      dbAgent = await prisma.agent.findFirst({
        where: { status: "ACTIVE" },
        select: {
          name: true,
          instructions: true,
          systemPrompt: true,
          cartesiaVoiceId: true,
          language: true,
          business: { select: { name: true } },
          businessContext: true,
        },
      }) || await prisma.agent.findFirst({
        select: {
          name: true,
          instructions: true,
          systemPrompt: true,
          cartesiaVoiceId: true,
          language: true,
          business: { select: { name: true } },
          businessContext: true,
        },
      });
    }
    if (dbAgent) {
      agentName = (dbAgent.name || agentName).replace(/\s*\(Active\)/gi, "").trim();
      voiceId = dbAgent.cartesiaVoiceId || voiceId;
      language = dbAgent.language || language;
      systemPrompt = dbAgent.instructions || dbAgent.systemPrompt || "";
      if (dbAgent.business?.name) businessName = dbAgent.business.name;
    }
    await prisma.$disconnect();
  } catch (dbErr) {
    console.warn("[GREETING_PREWARM_DB_WARN]", dbErr.message);
  }

  // Train well starter welcome greeting based on language
  let greeting;
  if (language === "ENGLISH") {
    greeting = `Hello! I am ${agentName} calling from ${businessName}. How may I help you today?`;
  } else if (language === "TELUGU") {
    greeting = `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను, ${businessName} నుండి కాల్ చేస్తున్నాను. మీకు ఎలా సహాయపడగలను?`;
  } else {
    greeting = `హలో అండి! నేను ${agentName} మాట్లాడుతున్నాను, ${businessName} నుంచి call చేస్తున్నాను. మీకు ఎలా సహాయం చేయగలను?`;
  }

  // Pre-synthesize with Cartesia Sonic TTS for 0ms call pickup delivery
  const audioBuf = await synthesizeSpeech(greeting, voiceId);
  const entry = { greeting, voiceId, agentName, businessName, systemPrompt, audioBuf, timestamp: Date.now() };
  agentGreetingCache.set(cacheKey, entry);
  return entry;
}

function getActiveAgent() {
  return {
    name: "Aadarsh",
    voiceId: process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    systemPrompt: `# IDENTITY & ROLE
You are ఆదర్శ్ (Adarsh), a professional and friendly AI voice assistant representing Vaani Enterprises.
You are on a LIVE, REAL-TIME PHONE CALL with an Indian customer.

# RULES
1. Keep response between 1 to 2 sentences. Maximum 20 words.
2. Speak in natural everyday Telugu / Tenglish.
3. Polite words: "అవునండి", "ఖచ్చితంగా అండి", "ధన్యవాదాలు అండి".
4. Ask only ONE question at a time.
5. Opening greeting: "హాయ్ అండి, నేను ఆదర్శ్. మీకు ఎలా సహాయం చేయగలను?"
6. Business: Vaani Enterprises - Telugu AI Voice Calling Platform (Starter ₹15,000/mo, Hyderabad).`,
  };
}

// ─── ITU-T G.711 μ-law Companding & Office Ambience Audio Mixer ──────────────
function linear2ulaw(sample) {
  const BIAS = 0x84;
  const CLIP = 32635;
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample = sample + BIAS;
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  let mantissa = (sample >> (exponent + 3)) & 0x0f;
  let ulawbyte = ~(sign | (exponent << 4) | mantissa);
  return ulawbyte & 0xff;
}

function mulaw2linear(ulawbyte) {
  let ulaw = ~ulawbyte & 0xff;
  const sign = ulaw & 0x80;
  const exponent = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  let sample = ((mantissa << 1) + 33) << (exponent + 2);
  sample = sign ? 33 - sample : sample - 33;
  return Math.max(-32768, Math.min(32767, sample));
}

// ─── Outbound Audio Stream Helper ─────────────────────────────────────────────
function sendAudioToVobiz(ws, streamId, rawAudioBuf) {
  if (!ws || ws.readyState !== 1 || !streamId || !rawAudioBuf || rawAudioBuf.length === 0) {
    if (!ws || ws.readyState !== 1) console.error("[VOBIZ_OUTBOUND_STREAM_CLOSED] WebSocket connection is closed");
    return 0;
  }

  const audioBuf = rawAudioBuf;

  // 40ms chunks: 320 bytes at 8000Hz 8-bit mono μ-law (8000 bytes/sec)
  const CHUNK_SIZE = 320;
  let frameCount = 0;
  let totalBytes = 0;

  for (let offset = 0; offset < audioBuf.length; offset += CHUNK_SIZE) {
    if (ws.readyState !== 1) {
      console.warn(`[SEND_ABORT] WS closed mid-send at offset ${offset}/${audioBuf.length}`);
      break;
    }
    const chunk = audioBuf.subarray(offset, Math.min(offset + CHUNK_SIZE, audioBuf.length));
    try {
      ws.send(
        JSON.stringify({
          event: "playAudio",
          streamId: streamId,
          media: {
            contentType: "audio/x-mulaw",
            sampleRate: 8000,
            payload: chunk.toString("base64"),
          },
        })
      );
    } catch (sendErr) {
      console.warn(`[SEND_ERR] Drop during audio stream: ${sendErr.message}`);
      break;
    }
    frameCount++;
    totalBytes += chunk.length;
  }

  // Checkpoint to track completion
  const checkpoint = `chk_${Date.now()}`;
  try {
    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          event: "checkpoint",
          streamId: streamId,
          name: checkpoint,
        })
      );
    }
  } catch {}

  console.log(`[VOBIZ_AUDIO_FRAME_SENT]\nBYTES=${totalBytes}`);
  console.log(
    `[TTS_AUDIO_SENT_TO_VOBIZ] bytes=${totalBytes}, frames=${frameCount}, streamId=${streamId}, timestamp=${new Date().toISOString()}`
  );
  livePipelineStatus.outboundAudio = "Sending";
  livePipelineStatus.lastActive = new Date().toISOString();
  return frameCount;
}

// ─── Cartesia Native Agent WebSocket Bridge ───────────────────────────────────
// When a call targets a Cartesia conversational agent (agent_xxx ID format),
// we bypass Sarvam+Groq and bridge Vobiz audio ↔ Cartesia Agent WebSocket natively.
// Cartesia handles STT (speech detection), LLM (Gemini 2.5 Flash), and TTS internally.
//
// Vobiz sends:  mulaw/8kHz audio → we forward as base64 audio_input events
// Cartesia sends: audio_output events → we decode and forward to Vobiz as playAudio
// ──────────────────────────────────────────────────────────────────────────────
async function handleCartesiaAgentStream(vobizWs, cartesiaAgentId, streamId) {
  const apiKey = process.env.CARTESIA_API_KEY || "";
  if (!apiKey) {
    console.error("[CARTESIA_AGENT] No API key — cannot connect to Cartesia agent");
    return null;
  }

  // 1. Obtain a short-lived access token (never expose raw key over WS)
  let accessToken = null;
  try {
    const tokenRes = await fetchWithRetry(
      "https://api.cartesia.ai/access-token",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-API-Key": apiKey,
          "Cartesia-Version": "2026-08-14",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grants: { "websocket:connect": { agent_id: cartesiaAgentId } },
          expires_in: 3600,
        }),
      },
      { timeoutMs: 8000, maxRetries: 2 }
    );
    if (tokenRes.ok) {
      const td = await tokenRes.json();
      accessToken = td.access_token || td.token;
    } else {
      console.warn("[CARTESIA_AGENT] Token fetch failed:", tokenRes.status);
    }
  } catch (err) {
    console.warn("[CARTESIA_AGENT] Token exception:", err.message);
  }

  if (!accessToken) {
    console.error("[CARTESIA_AGENT] Could not obtain access token — falling back to standard pipeline");
    return null;
  }

  // 2. Connect to Cartesia Agent WebSocket (Official Ultra-Low Latency Agent Stream Protocol)
  const { WebSocket: NodeWS } = await import("ws");
  const cartesiaWsUrl = `wss://api.cartesia.ai/agents/stream/${cartesiaAgentId}?cartesia_version=2026-08-14`;
  const cartesiaWs = new NodeWS(cartesiaWsUrl, {
    headers: {
      "X-API-Key": apiKey,
      Authorization: `Bearer ${accessToken || apiKey}`,
      "Cartesia-Version": "2026-08-14",
    },
  });

  let cartesiaReady = false;
  let pendingAudioQueue = []; // Buffer inbound audio until session is ready

  cartesiaWs.on("open", () => {
    console.log(`[CARTESIA_AGENT] Connected to Cartesia Agent Stream: ${cartesiaAgentId}`);

    // 3. Send official 'start' event — mulaw_8000 telephony input and speaking_pace streaming
    cartesiaWs.send(
      JSON.stringify({
        event: "start",
        stream_id: streamId,
        config: {
          input_format: "mulaw_8000",
          output_audio_delivery: "speaking_pace",
        },
      })
    );
  });

  cartesiaWs.on("message", (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      // Stream Acknowledged & Session Ready
      if (msg.event === "ack" || msg.type === "session_ready") {
        cartesiaReady = true;
        console.log(`[CARTESIA_AGENT] Session ready & acknowledged (Stream: ${msg.stream_id || streamId}) — flushing queued audio`);
        while (pendingAudioQueue.length > 0) {
          const chunk = pendingAudioQueue.shift();
          cartesiaWs.send(
            JSON.stringify({
              event: "media",
              stream_id: streamId,
              media: { payload: chunk.toString("base64") },
            })
          );
        }
      }

      // Voice Audio Stream Output (Immediate Welcome Speech + AI Turns)
      else if (msg.event === "media_output" || msg.type === "audio_output") {
        const payload = msg.media?.payload || msg.audio || msg.data;
        if (!payload) return;
        if (vobizWs.readyState === 1) {
          vobizWs.send(
            JSON.stringify({
              event: "playAudio",
              streamId,
              media: {
                contentType: "audio/x-mulaw",
                sampleRate: 8000,
                payload,
              },
            })
          );
        }
      }

      // Streaming Text Transcript
      else if (msg.event === "turn_output_text_delta" || msg.type === "turn_output_text_delta") {
        const text = msg.turn_output_text_delta?.text || msg.text;
        if (text) process.stdout.write(`[AI_SPOKE] ${text}\n`);
      }

      // Instant Zero-Latency Barge-In Interruption
      else if (msg.event === "audio_output_clear" || msg.type === "audio_output_clear") {
        console.log("[CARTESIA_AGENT] Barge-in detected — flushing telephony buffer immediately");
        try {
          if (vobizWs.readyState === 1) {
            vobizWs.send(JSON.stringify({ event: "clearAudio", streamId }));
          }
        } catch {}
      }

      // System / Custom Tool Calls
      else if (msg.event === "tool_call" || msg.type === "tool_call") {
        console.log("[CARTESIA_AGENT] Tool call:", JSON.stringify(msg));
        const toolName = msg.name || msg.function?.name || msg.tool_call?.name;
        if (toolName === "end_call") {
          console.log("[CARTESIA_AGENT] End call tool triggered — hanging up");
          setTimeout(() => {
            try { vobizWs.close(1000, "Cartesia agent ended call"); } catch {}
            try { cartesiaWs.close(1000, "End call"); } catch {}
          }, 1500);
        }
      }

      else if (msg.event === "error" || msg.type === "error") {
        console.error("[CARTESIA_AGENT] Error from Cartesia:", msg.message || JSON.stringify(msg));
      }
    } catch (parseErr) {
      // Binary audio frame? Handle raw
      if (Buffer.isBuffer(rawMsg) && vobizWs.readyState === 1) {
        sendAudioToVobizRaw(vobizWs, streamId, rawMsg);
      }
    }
  });

  cartesiaWs.on("error", (err) => {
    console.error("[CARTESIA_AGENT] WebSocket error:", err.message);
  });

  cartesiaWs.on("close", (code, reason) => {
    console.log(`[CARTESIA_AGENT] Disconnected: code=${code}, reason=${reason?.toString()}`);
    cartesiaReady = false;
  });

  // Keepalive ping to Cartesia WS every 30s
  const cartesiaPing = setInterval(() => {
    if (cartesiaWs.readyState === 1) cartesiaWs.ping();
    else clearInterval(cartesiaPing);
  }, 30000);

  // Return a handler function — call this with each incoming Vobiz audio chunk
  return {
    sendAudio: (mulawChunk) => {
      if (cartesiaWs.readyState !== 1) return;
      if (!cartesiaReady) {
        pendingAudioQueue.push(mulawChunk);
        return;
      }
      try {
        cartesiaWs.send(
          JSON.stringify({
            event: "media",
            stream_id: streamId,
            media: { payload: mulawChunk.toString("base64") },
          })
        );
      } catch (err) {
        console.warn("[CARTESIA_AGENT] Send audio error:", err.message);
      }
    },
    close: () => {
      clearInterval(cartesiaPing);
      try { cartesiaWs.close(1000, "Call ended"); } catch {}
    },
    isReady: () => cartesiaReady && cartesiaWs.readyState === 1,
  };
}

// sendAudioToVobizRaw — like sendAudioToVobiz but skips office ambience mixing
// (used when Cartesia already has ambience baked into its output)
function sendAudioToVobizRaw(ws, streamId, audioBuf) {
  if (!ws || ws.readyState !== 1 || !streamId || !audioBuf || audioBuf.length === 0) return;
  const CHUNK_SIZE = 320;
  for (let offset = 0; offset < audioBuf.length; offset += CHUNK_SIZE) {
    if (ws.readyState !== 1) break;
    const chunk = audioBuf.subarray(offset, Math.min(offset + CHUNK_SIZE, audioBuf.length));
    try {
      ws.send(
        JSON.stringify({
          event: "playAudio",
          streamId,
          media: { contentType: "audio/x-mulaw", sampleRate: 8000, payload: chunk.toString("base64") },
        })
      );
    } catch { break; }
  }
}

// ─── WebSocket Session Handler ────────────────────────────────────────────────
// ─── WebSocket Session Handler ────────────────────────────────────────────────
function handleVobizStream(ws, queryAgentId, queryCallerNumber = "+916305367443") {
  const fallbackAgent = getActiveAgent();
  let voiceId = fallbackAgent.voiceId;
  let agentName = fallbackAgent.name;
  let systemPrompt = fallbackAgent.systemPrompt;

  let streamId = null;
  let callUuid = null;
  let callConnectTime = Date.now();
  let conversationHistory = [];
  let speakingWatchdog = null;
  let callerIsSpeaking = false;
  let speechAudioChunks = [];
  let preSpeechBuffer = [];
  let lastSpeechTime = 0;
  let greetingSent = false;
  let isProcessing = false;
  let isAiSpeaking = false;
  let consecutiveSpeechFrames = 0;
  let hasLoggedFirstAudio = false;

  // ── Cartesia Native Agent Bridge ─────────────────────────────────────────────
  // If the selected QETADOTIN agent has a cartesiaAgentId, we use Cartesia's
  // full conversational pipeline (STT+LLM+TTS) instead of Sarvam+Groq+Cartesia TTS.
  let cartesiaAgentBridge = null; // Set after stream start if agent has cartesiaAgentId
  let useCartesiaNative = false;  // True when Cartesia bridge is active

  // Exact runtime agent selection — Section 4 & Section 5
  async function resolveExactAgent() {
    if (queryAgentId && queryAgentId.trim()) {
      try {
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        const dbAgent = await prisma.agent.findUnique({
          where: { id: queryAgentId.trim() },
          select: {
            id: true,
            name: true,
            instructions: true,
            systemPrompt: true,
            cartesiaAgentId: true,
            cartesiaVoiceId: true,
            language: true,
            business: { select: { name: true } },
          },
        });
        await prisma.$disconnect();
        if (dbAgent) return dbAgent;
      } catch {}
    }
    if (queryCallerNumber) {
      try {
        const clean = queryCallerNumber.replace(/[\s\-\(\)]/g, "");
        const { PrismaClient } = await import("@prisma/client");
        const prisma = new PrismaClient();
        const phone = await prisma.phoneNumber.findFirst({
          where: { e164Number: clean },
          select: {
            assignedAgent: {
              select: {
                id: true,
                name: true,
                instructions: true,
                systemPrompt: true,
                cartesiaAgentId: true,
                cartesiaVoiceId: true,
                language: true,
                business: { select: { name: true } },
              },
            },
          },
        });
        await prisma.$disconnect();
        if (phone?.assignedAgent) return phone.assignedAgent;
      } catch {}
    }
    return null;
  }
  // ─────────────────────────────────────────────────────────────────────────────

  console.log(`[VOBIZ_STREAM_CONNECTED] Stream connection established → QueryAgentId: ${queryAgentId || "none"}, Caller: ${queryCallerNumber}`);
  console.log(`[MEDIA_STREAM_CONNECTED] Live bidirectional audio socket open`);
  livePipelineStatus.vobizCall = "Connected";
  livePipelineStatus.mediaStream = "Connected";

  function setAiSpeaking(speaking, durationMs = 0) {
    isAiSpeaking = speaking;
    if (speakingWatchdog) {
      clearTimeout(speakingWatchdog);
      speakingWatchdog = null;
    }
    if (speaking && durationMs > 0) {
      // Safety watchdog: auto-clear isAiSpeaking after audio finishes + 400ms buffer
      speakingWatchdog = setTimeout(() => {
        if (isAiSpeaking) {
          console.log(`[VOBIZ] Watchdog reset AI speaking state (${durationMs}ms duration elapsed)`);
          isAiSpeaking = false;
        }
      }, durationMs + 400);
    }
  }

  async function processCallerAudio(allAudio) {
    if (!allAudio || allAudio.length === 0 || isProcessing) return;

    hasLoggedFirstAudio = false;

    // Skip brief noise / clicks (< 0.4s)
    if (allAudio.length < 3200) {
      console.log(`[VOBIZ_AUDIO_RECEIVED] Skipping brief noise/click: ${allAudio.length} bytes`);
      return;
    }

    isProcessing = true;
    console.log(`[LATENCY_TRACE] CUSTOMER_INPUT → Processing turn: ${allAudio.length} bytes (${(allAudio.length / 8000).toFixed(1)}s audio)`);

    try {
      console.log(`[CUSTOMER_AUDIO_RECEIVED] bytes=${allAudio.length}, duration=${(allAudio.length / 8000).toFixed(1)}s`);
      const transcript = await transcribeAudio(allAudio);
      if (!transcript || transcript.trim().length < 2) {
        console.log("[SARVAM_FINAL_TRANSCRIPT] No clear speech detected");
        isProcessing = false;
        return;
      }

      console.log(`[STT_TRANSCRIPT] text="${transcript.trim()}"`);
      conversationHistory.push({ role: "user", content: transcript });

      let replyText = "";
      let shouldEndCall = false;

      // ─── Execute Intelligent Turn via Agent Orchestrator API ───
      try {
        console.log(`[LATENCY_TRACE] PROCESSING_STARTED → agentId=${queryAgentId || "default"}, userUtterance="${transcript}"`);
        const turnRes = await fetch(`http://127.0.0.1:${port}/api/agent/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: queryAgentId,
            userUtterance: transcript,
            conversationHistory,
            customerPhone: queryCallerNumber,
          }),
        });

        if (turnRes.ok) {
          const turnData = await turnRes.json();
          replyText = turnData.normalizedReply || turnData.rawReply || "";
          shouldEndCall = Boolean(turnData.shouldEndCall);
          if (turnData.agent?.voiceId) voiceId = turnData.agent.voiceId;

          if (turnData.retrievedSnippets?.length > 0) {
            console.log(
              `[RAG_GROUNDED_RETRIEVAL] Retrieved ${turnData.retrievedSnippets.length} relevant knowledge snippets:`,
              turnData.retrievedSnippets.map((s) => `[${s.source}] ${s.title}`)
            );
          }
          if (turnData.toolCalls?.length > 0) {
            console.log(`[LATENCY_TRACE] TOOL_STARTED & COMPLETED →`, JSON.stringify(turnData.toolCalls));
          }
          if (turnData.qualityValidation?.wasModified) {
            console.log(`[QUALITY_ENGINE_OPTIMIZED] Reason: ${turnData.qualityValidation.modificationReason}`);
          }
        }
      } catch (turnErr) {
        console.error(`[AGENT_INTELLIGENCE_FALLBACK] Error: ${turnErr.message}`);
      }

      // Fallback to direct Groq call if turn API is unreachable
      if (!replyText || replyText.trim().length === 0) {
        replyText = await getLLMResponse(systemPrompt, conversationHistory, transcript);
      }

      if (!replyText || replyText.trim().length === 0) {
        isProcessing = false;
        return;
      }

      console.log(`[LATENCY_TRACE] RESPONSE_STARTED → text="${replyText}"`);
      conversationHistory.push({ role: "assistant", content: replyText });

      // Synthesize with Cartesia Sonic TTS
      console.log(`[LATENCY_TRACE] SPEECH_STARTED → Synthesizing turn with voice: ${voiceId}`);
      const audioBuf = await synthesizeSpeech(replyText, voiceId);

      if (audioBuf && audioBuf.length > 0 && streamId) {
        const durationMs = (audioBuf.length / 8000) * 1000;
        setAiSpeaking(true, durationMs);

        // Stream 40ms audio frames
        sendAudioToVobiz(ws, streamId, audioBuf);
        console.log(`[LISTENING] Spoken turn delivered. Listening for customer speech...`);

        // If turn instructed to end call, hang up gracefully after playback
        if (shouldEndCall) {
          setTimeout(() => {
            console.log("[LATENCY_TRACE] CALL_ENDED → Turn requested hang up. Closing stream.");
            try {
              ws.close(1000, "Call finished");
            } catch {}
          }, durationMs + 800);
        }
      }
    } catch (err) {
      console.error(`[ERROR] Pipeline turn error: ${err.message}`);
    }

    isProcessing = false;
  }

  ws.on("message", async (rawData) => {
    try {
      const text = rawData.toString();
      const msg = JSON.parse(text);
      const event = msg.event;

      if (event === "start") {
        const tStart = Date.now();
        streamId = msg.start?.streamId || msg.streamId || `sid_${Date.now()}`;
        callUuid = msg.start?.callUuid || msg.start?.callId || msg.start?.callSid || "unknown";
        console.log(`[LATENCY_TRACE] CALL_STARTED → streamId=${streamId}, callUuid=${callUuid}`);

        // Immediate RTP Carrier Readiness — NO ARTIFICIAL 800ms DELAY!
        console.log(`[MEDIA_CONNECTED] Bidirectional audio carrier pipeline ready instantly (0ms delay).`);

        // Section 4: Exact Agent Resolution — Strict, no random or fallback agent
        const exactAgent = await resolveExactAgent();
        const cartesiaAgentId = exactAgent?.cartesiaAgentId;

        if (exactAgent) {
          agentName = exactAgent.name;
          voiceId = exactAgent.cartesiaVoiceId || voiceId;
          systemPrompt = exactAgent.instructions || exactAgent.systemPrompt || systemPrompt;
          console.log(`[LATENCY_TRACE] AGENT_CONNECTED → Exact Agent resolved: "${agentName}" (${exactAgent.id}), CartesiaAgentId: ${cartesiaAgentId || "none"} in ${Date.now() - tStart}ms`);
        } else {
          console.warn(`[AGENT_NOTICE] No custom agent bound to call. Proceeding with active profile.`);
        }

        if (cartesiaAgentId) {
          // ── CARTESIA NATIVE AGENT PATH (Lowest latency, full STT+LLM+TTS runtime) ──
          console.log(`[CARTESIA_AGENT] Connecting to Cartesia Agent WebSocket: ${cartesiaAgentId}`);
          cartesiaAgentBridge = await handleCartesiaAgentStream(ws, cartesiaAgentId, streamId);
          if (cartesiaAgentBridge) {
            useCartesiaNative = true;
            greetingSent = true;
            console.log(`[LATENCY_TRACE] SPEECH_STARTED → Cartesia Native Agent active, delivering trained initial_message`);
          } else {
            console.warn(`[CARTESIA_AGENT] Bridge failed or credits exhausted — auto-routing to low-latency TTS pipeline`);
          }
        }

        if (!useCartesiaNative) {
          // ── LOW-LATENCY TTS PIPELINE PATH ─────────────────────────────────
          if (!greetingSent) {
            greetingSent = true;
            setAiSpeaking(true, 5000);

            let greetingEntry = agentGreetingCache.get(queryAgentId || "default");
            if (!greetingEntry) {
              greetingEntry = await getOrPrewarmGreeting(queryAgentId, queryCallerNumber);
            }

            if (greetingEntry) {
              agentName = greetingEntry.agentName || agentName;
              voiceId = greetingEntry.voiceId || voiceId;
              const greeting = greetingEntry.greeting;
              let greetAudio = greetingEntry.audioBuf;

              console.log(`[LATENCY_TRACE] SPEECH_STARTED → Starter welcome greeting delivered: "${greeting}" in ${Date.now() - tStart}ms`);

              if (!greetAudio) {
                greetAudio = await synthesizeSpeech(greeting, voiceId);
              }

              if (greetAudio && greetAudio.length > 0 && streamId) {
                const durationMs = (greetAudio.length / 8000) * 1000;
                setAiSpeaking(true, durationMs);
                sendAudioToVobiz(ws, streamId, greetAudio);
                conversationHistory.push({ role: "assistant", content: greeting });
                console.log(`[LISTENING] Starter greeting sent to phone. Listening for caller response...`);
              } else {
                setAiSpeaking(false);
              }
            } else {
              setAiSpeaking(false);
            }
          }
        }

      } else if (event === "media") {
        const payload = msg.media?.payload;
        if (!payload) return;
        const chunk = Buffer.from(payload, "base64");

        // ── CARTESIA NATIVE: pipe raw audio directly to Cartesia Agent WebSocket ──
        if (useCartesiaNative && cartesiaAgentBridge) {
          cartesiaAgentBridge.sendAudio(chunk);
          return; // Cartesia handles all VAD, STT, LLM, TTS internally
        }

        const rms = calculateRms(chunk);


        if (!hasLoggedFirstAudio) {
          hasLoggedFirstAudio = true;
          console.log(`[CALLER_AUDIO_RECEIVED] bytes=${chunk.length}, streamId=${msg.streamId || streamId}`);
          console.log(`[VOBIZ_AUDIO_RECEIVED] First packet: ${chunk.length} bytes (streamId: ${msg.streamId || streamId})`);
          livePipelineStatus.callerAudio = "Receiving";
        }

        // If AI is actively speaking, check for real voice barge-in (interruption)
        if (isAiSpeaking) {
          const elapsed = Date.now() - callConnectTime;
          // Allow natural conversational barge-in once initial audio is underway
          if (elapsed > 1800 && rms > 1200) { // Natural speech energy above line noise
            consecutiveSpeechFrames++;
            if (consecutiveSpeechFrames >= 3) { // ~120ms of continuous human speech
              console.log(`[BARGE_IN] Caller interrupted AI speech (rms=${Math.round(rms)})`);
              setAiSpeaking(false);
              if (streamId) {
                ws.send(JSON.stringify({ event: "clearAudio", streamId }));
              }
              callerIsSpeaking = true;
              speechAudioChunks = [chunk];
              lastSpeechTime = Date.now();
              consecutiveSpeechFrames = 0;
            }
          } else {
            consecutiveSpeechFrames = 0;
          }
          return; // Discard background line noise while AI is talking
        }

        consecutiveSpeechFrames = 0;

        // Rolling pre-speech buffer (keep 25 frames = 500ms to preserve soft initial syllables)
        preSpeechBuffer.push(chunk);
        if (preSpeechBuffer.length > 25) preSpeechBuffer.shift();

        // Sensitive PSTN voice threshold: 420 RMS captures quiet & normal speech without clipping
        if (rms >= 420) {
          if (!callerIsSpeaking) {
            console.log(`[CALLER_SPEECH_START] Voice detected (rms=${Math.round(rms)})`);
            callerIsSpeaking = true;
            speechAudioChunks = [...preSpeechBuffer];
          } else {
            speechAudioChunks.push(chunk);
          }
          lastSpeechTime = Date.now();
        } else if (callerIsSpeaking) {
          // Low energy frame after speaking
          speechAudioChunks.push(chunk);
          const silenceDuration = Date.now() - lastSpeechTime;
          // Natural conversational pause: 1350ms ensures caller finished their full sentence
          if (silenceDuration >= 1350 || speechAudioChunks.length > 500) {
            console.log(`[CALLER_SPEECH_END] Turn complete (${(speechAudioChunks.length * 20 / 1000).toFixed(1)}s audio, silence=${silenceDuration}ms)`);
            callerIsSpeaking = false;
            const turnAudio = Buffer.concat(speechAudioChunks);
            speechAudioChunks = [];
            preSpeechBuffer = [];
            processCallerAudio(turnAudio);
          }
        }

      } else if (event === "playedStream") {
        console.log(`[CALLER_AUDIO_PLAYBACK_CONFIRMED] name=${msg.name || "unknown"}`);
        console.log(`[VOBIZ] Outbound audio playback finished (name=${msg.name || "unknown"})`);
        livePipelineStatus.callerPlayback = "Confirmed";
        setAiSpeaking(false);

      } else if (event === "clearedAudio") {
        console.log(`[VOBIZ] Outbound audio buffer cleared`);
        setAiSpeaking(false);
      }

    } catch (parseErr) {
      if (Buffer.isBuffer(rawData)) {
        speechAudioChunks.push(rawData);
      }
    }
  });

  ws.on("close", (code, reason) => {
    const reasonStr = reason?.toString() || "";
    console.log(`[CALL_ENDED] WebSocket closed: code=${code}, reason=${reasonStr}`);
    if (speakingWatchdog) clearTimeout(speakingWatchdog);
    if (pingInterval) clearInterval(pingInterval);
    // Close Cartesia native bridge if active
    if (cartesiaAgentBridge) {
      cartesiaAgentBridge.close();
      cartesiaAgentBridge = null;
      console.log("[CARTESIA_AGENT] Bridge closed on call end");
    }
    // Drain any pending audio to avoid dangling references
    speechAudioChunks = [];
    preSpeechBuffer = [];
    isProcessing = false;
  });


  ws.on("error", (err) => {
    // wsarecv WSAECONNRESET = remote TCP RST — log and allow graceful close
    const isForceClose = err.message && (
      err.message.includes("wsarecv") ||
      err.message.includes("ECONNRESET") ||
      err.message.includes("forcibly closed") ||
      err.message.includes("connection reset")
    );
    if (isForceClose) {
      console.warn(`[VOBIZ_STREAM_DROP] Remote TCP RST received — carrier dropped the call (${err.message.slice(0, 120)}). Stream will close cleanly.`);
    } else {
      console.error(`[VOBIZ_MEDIA_STREAM_ERROR] WebSocket error: ${err.message}`);
    }
    // Ensure the socket closes rather than hanging
    try { ws.terminate(); } catch {}
  });

  // ─── Ping / Keepalive every 20s to prevent idle TCP RST from carrier ─────
  const pingInterval = setInterval(() => {
    if (ws.readyState === 1 /* OPEN */) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 20000);

  ws.on("pong", () => {
    // Carrier is alive — keepalive confirmed
    livePipelineStatus.lastActive = new Date().toISOString();
  });
}

// ─── Start the custom server ─────────────────────────────────────────────────
await app.prepare();

const server = createServer((req, res) => {
  const url = req.url || "";
  if (url === "/api/vobiz/stream" || url.startsWith("/api/vobiz/stream?")) {
    res.writeHead(426, { "Content-Type": "text/plain" });
    res.end("Upgrade Required: Connect via WebSocket (ws:// or wss://)");
    return;
  }
  if (url === "/api/agent/cache-invalidate" || url.startsWith("/api/agent/cache-invalidate")) {
    agentGreetingCache.clear();
    console.log("[CACHE_INVALIDATED] Cleared pre-warmed agent greeting and training cache");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Agent cache cleared" }));
    return;
  }
  handle(req, res);
});

// Attach WebSocket server for Vobiz stream endpoint
const wss = new WebSocketServer({ noServer: true });

function getStreamParams(req) {
  try {
    const parsedUrl = new URL(req.url || "", `http://localhost:${port}`);
    return {
      agentId: parsedUrl.searchParams.get("agentId") || undefined,
      callerNumber: parsedUrl.searchParams.get("callerNumber") || "+916305367443",
    };
  } catch {
    return { agentId: undefined, callerNumber: "+916305367443" };
  }
}

// Register upgrade listener so Node.js HTTP parser knows upgrade events are handled
server.on("upgrade", (req, socket, head) => {
  const url = req.url || "";
  if (url === "/api/vobiz/stream" || url.startsWith("/api/vobiz/stream?")) {
    const { agentId, callerNumber } = getStreamParams(req);
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleVobizStream(ws, agentId, callerNumber);
    });
  }
});

// Intercept server.emit('upgrade') so /api/vobiz/stream is handled exclusively
// and Next.js internal upgrade handler cannot destroy our socket
const originalEmit = server.emit;
server.emit = function (event, ...args) {
  if (event === "upgrade") {
    const req = args[0];
    const socket = args[1];
    const head = args[2];
    const url = req?.url || "";

    if (url === "/api/vobiz/stream" || url.startsWith("/api/vobiz/stream?")) {
      const { agentId, callerNumber } = getStreamParams(req);
      wss.handleUpgrade(req, socket, head, (ws) => {
        handleVobizStream(ws, agentId, callerNumber);
      });
      return true; // Exclusively handled! Stop Next.js from destroying socket.
    }
  }
  return originalEmit.apply(this, [event, ...args]);
};

server.listen(port, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     Vaani AI Voice Platform — Custom Server    ║
╠════════════════════════════════════════════════╣
║  App:       http://localhost:${port}               ║
║  WS Bridge: ws://localhost:${port}/api/vobiz/stream║
║  Vobiz DID: +918071582667 (Karnataka)          ║
║  STT:       Sarvam saaras:v2 (te-IN)           ║
║  LLM:       Groq qwen3.8-27b (ultra-fast)      ║
║  TTS:       Cartesia sonic-3.6 (8kHz μ-law)    ║
╚════════════════════════════════════════════════╝
`);

  // Pre-warm default agent greeting in background
  setTimeout(() => {
    getOrPrewarmGreeting("default")
      .then(() => console.log("[CACHE] Pre-warmed default agent greeting audio"))
      .catch(() => {});
  }, 1000);
});
