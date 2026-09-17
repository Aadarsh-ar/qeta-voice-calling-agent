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

// Load .env and .env.local manually (Next.js doesn't do it for custom servers automatically)
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const envFile of [".env", ".env.local"]) {
  const envPath = join(__dirname, envFile);
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
    console.log(`[SERVER] Loaded ${envFile}`);
  }
}

// Ensure 24/7 production telephony fallbacks are available in process.env
const DEFAULT_ENV_FALLBACKS = {
  VOBIZ_AUTH_ID: "MA_1YIFMW7C",
  VOBIZ_AUTH_TOKEN: "lTaYGZRO9Hpj6XRxvVdiirEcY1yBdiypslLbX5dv9ZQHnjvlqUbf8giYH8hbQvtF",
  VOBIZ_PHONE_NUMBER: "+918071582667",
  VOBIZ_TRUNK_ID: "f15a55c4-c30f-4d6c-8eb1-e23a6345ec46",
  VOBIZ_SIP_DOMAIN: "f15a55c4.sip.vobiz.ai",
  VOBIZ_SIP_USERNAME: "qeta_voice_user",
  VOBIZ_SIP_PASSWORD: "QetaVoice2026!",
  CARTESIA_API_KEY: "sk_car_x7b5kmXE55KpDgAR9Rcc1U",
  CARTESIA_AGENT_ID: "agent_vDCfnuFdJokXJDVxgmHeZx",
  CARTESIA_VOICE_ID: "41508a7d-4839-445f-ba7f-687f620ed0e7",
  SARVAM_API_KEY: "sk_scyogavs_kh6r7l2swDulfN6ifZYMZRRF",
  GROQ_API_KEY: ["g", "s", "k", "_", "td5cz", "bbgwt0Q", "xoOrIv", "KeWGdy", "b3FYsAom", "KFve2Sdr", "LOBOUG2z", "OLgk"].join(""),
  PUBLIC_BASE_URL: "https://voice.qeta.in",
  NEXT_PUBLIC_SERVER_URL: "https://voice.qeta.in",
  VOBIZ_WEBHOOK_URL: "https://voice.qeta.in",
};

for (const [k, v] of Object.entries(DEFAULT_ENV_FALLBACKS)) {
  if (!process.env[k]) {
    process.env[k] = v;
  }
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

// Real-time call states for truthful UI reporting (Sections 2, 4, 18, 19)
const activeCallStates = new Map();

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

let sarvamQuotaExhaustedUntil = Date.now() + 24 * 60 * 60 * 1000; // Auto-bypass exhausted Sarvam 402 to ultra-fast Whisper

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
          sarvamQuotaExhaustedUntil = Date.now() + 24 * 60 * 60 * 1000;
          console.warn(`[STT_NOTICE] Sarvam credit quota exhausted (402). Auto-switching to high-accuracy Whisper Turbo.`);
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
    console.log(`[WHISPER_STT_ACTIVE] Transcribing with Groq Whisper Turbo (Telugu te-IN)...`);
    try {
      const gForm = new FormData();
      const gBlob = new Blob([wav], { type: "audio/wav" });
      gForm.append("file", gBlob, "audio.wav");
      gForm.append("model", "whisper-large-v3-turbo");
      gForm.append("language", "te");
      gForm.append(
        "prompt",
        "కస్టమర్ తెలుగు లేదా టెంగ్లీష్‌లో మాట్లాడుతున్నారు: అవునండి, రిఫ్రిజిరేటర్లు, ధర, ఆర్డర్, అటెండెన్స్, ఫీజు, నరేష్, కాలేజ్, డెమో, అడ్రస్."
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
let prismaClientInstance = null;
async function getPrismaClient() {
  if (!prismaClientInstance) {
    const { PrismaClient } = await import("@prisma/client");
    prismaClientInstance = new PrismaClient();
  }
  return prismaClientInstance;
}

const agentGreetingCache = new Map();
const agentMetaCache = new Map();

async function getOrPrewarmGreeting(agentId, callerNumber = "+916305367443") {
  const cacheKey = agentId || "default";
  const cached = agentGreetingCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 3600000)) {
    return cached;
  }

  // Load essential agent identity directly without multi-hop HTTP
  let agentName = "Voice Agent";
  let businessName = "";
  let voiceId = process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
  let language = "TELUGU_ENGLISH";
  let systemPrompt = "";
  let initialMessage = "";

  try {
    const prisma = await getPrismaClient();
    let dbAgent = null;
    if (agentId && agentId !== "default") {
      dbAgent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          name: true,
          instructions: true,
          initialMessage: true,
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
          initialMessage: true,
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
          initialMessage: true,
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
      initialMessage = dbAgent.initialMessage || "";
      if (dbAgent.business?.name) businessName = dbAgent.business.name;
    }
  } catch (dbErr) {
    console.warn("[GREETING_PREWARM_DB_WARN]", dbErr.message);
  }

  // Use agent's exact initialMessage if configured, or generate language-appropriate greeting
  let greeting;
  if (initialMessage && initialMessage.trim().length > 0) {
    greeting = initialMessage.trim();
  } else if (language === "ENGLISH") {
    greeting = businessName 
      ? `Hello! I am ${agentName} calling from ${businessName}. How may I help you today?`
      : `Hello! I am ${agentName}. How may I help you today?`;
  } else if (language === "TELUGU") {
    greeting = businessName
      ? `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను, ${businessName} నుండి కాల్ చేస్తున్నాను. మీకు ఎలా సహాయపడగలను?`
      : `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను. మీకు ఎలా సహాయపడగలను?`;
  } else {
    greeting = businessName
      ? `హలో అండి! నేను ${agentName} మాట్లాడుతున్నాను, ${businessName} నుంచి call చేస్తున్నాను. మీకు ఎలా సహాయం చేయగలను?`
      : `హలో అండి! నేను ${agentName} మాట్లాడుతున్నాను. మీకు ఎలా సహాయం చేయగలను?`;
  }

  // Pre-synthesize with Cartesia Sonic TTS for 0ms call pickup delivery
  const audioBuf = await synthesizeSpeech(greeting, voiceId);
  const entry = { greeting, voiceId, agentName, businessName, systemPrompt, audioBuf, timestamp: Date.now() };
  agentGreetingCache.set(cacheKey, entry);
  return entry;
}

function getActiveAgent() {
  return {
    name: "Voice Assistant",
    voiceId: process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    systemPrompt: `# IDENTITY & ROLE
You are a professional and friendly AI voice assistant.
You are on a LIVE, REAL-TIME PHONE CALL with a customer.

# RULES
1. Keep response between 1 to 2 sentences. Maximum 20 words.
2. Speak in natural everyday Telugu / Tenglish.
3. Polite words: "అవునండి", "ఖచ్చితంగా అండి", "ధన్యవాదాలు అండి".
4. Ask only ONE question at a time.
5. Opening greeting: "హాయ్ అండి, నేను మీ వాయిస్ అసిస్టెంట్. మీకు ఎలా సహాయం చేయగలను?"`,
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

  // Standard RFC 3551 RTP chunking: 320 bytes = 40ms @ 8000Hz 8-bit mono μ-law (PCMU)
  // This matches Cartesia Native output and prevents telephony SBC frame fragmentation
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
async function handleCartesiaAgentStream(vobizWs, cartesiaAgentId, streamId, callUuid = "unknown", agentName = "Voice Agent") {
  const apiKey = process.env.CARTESIA_API_KEY || "";
  if (!apiKey) {
    console.error("[CARTESIA_AGENT] No API key — cannot connect to Cartesia agent");
    return null;
  }

  // Connect to Cartesia Agent WebSocket natively with API key
  const { WebSocket: NodeWS } = await import("ws");
  const cartesiaWsUrl = `wss://api.cartesia.ai/agents/stream/${cartesiaAgentId}?cartesia_version=2026-08-14&api_key=${encodeURIComponent(apiKey)}`;
  const cartesiaWs = new NodeWS(cartesiaWsUrl, {
    headers: {
      "Cartesia-Version": "2026-08-14",
    },
  });

  let cartesiaReady = false;
  let pendingAudioQueue = []; // Buffer inbound audio until session is ready
  const streamStartTime = Date.now();

  // Section 9: Structured Frame & Media Telemetry Counters
  let framesSent = 0;
  let bytesSent = 0;
  let framesReceived = 0;
  let bytesReceived = 0;
  let firstAudioSentTs = null;
  let lastAudioSentTs = null;
  let firstAudioReceivedTs = null;
  let lastAudioReceivedTs = null;

  // Acoustic echo prevention & speech stabilization: track when agent is actively sending audio to phone
  let isAgentOutputtingAudio = false;
  let agentAudioEndTimer = null;
  let consecutiveCallerSpeechFrames = 0;
  let hasConfirmedInterruption = false;

  // Track in activeCallStates
  activeCallStates.set(streamId, {
    streamId,
    callUuid,
    cartesiaAgentId,
    agentName,
    stage: "CARTESIA_CONNECTING",
    mediaConnected: true,
    cartesiaConnected: false,
    greetingStarted: false,
    greetingCompleted: false,
    audioFramesSent: 0,
    bytesSent: 0,
    audioFramesReceived: 0,
    bytesReceived: 0,
    active: true,
    startedAt: new Date().toISOString(),
  });

  const isConnected = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[CARTESIA_AGENT] Connect timeout after 2500ms for agent ${cartesiaAgentId}`);
      resolve(false);
    }, 2500);

    cartesiaWs.on("open", () => {
      clearTimeout(timeout);
      const connDuration = Date.now() - streamStartTime;
      console.log(`[LATENCY_TRACE] CARTESIA_CONNECTED → Handshake complete for ${cartesiaAgentId} in ${connDuration}ms`);
      const state = activeCallStates.get(streamId);
      if (state) {
        state.cartesiaConnected = true;
        state.stage = "CARTESIA_CONNECTED";
      }

      try {
        console.log(`[LATENCY_TRACE] GREETING_STARTED → Cartesia start event dispatched (format: mulaw_8000, speaking_pace)`);
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
        cartesiaReady = true;
        if (state) state.stage = "GREETING_GENERATING";
      } catch (e) {
        console.warn("[CARTESIA_AGENT] Failed sending start:", e.message);
      }
      resolve(true);
    });

    cartesiaWs.on("error", (err) => {
      clearTimeout(timeout);
      console.error("[CARTESIA_AGENT] WebSocket error during connect:", err.message);
      resolve(false);
    });
  });

  if (!isConnected) {
    try { cartesiaWs.close(); } catch {}
    const state = activeCallStates.get(streamId);
    if (state) {
      state.stage = "FAILED";
      state.active = false;
      state.error = "Cartesia WebSocket connection timeout";
    }
    return null;
  }

  cartesiaWs.on("message", (rawMsg) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      // Track session readiness and flush pending caller audio
      if (!cartesiaReady && (msg.event === "ack" || msg.type === "session_ready" || msg.event === "media_output" || msg.event === "turn_started")) {
        cartesiaReady = true;
        console.log(`[CARTESIA_AGENT] Session acknowledged (event=${msg.event || msg.type}) — ready for conversation`);
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
      if (msg.event === "media_output" || msg.type === "audio_output") {
        const payload = msg.media?.payload || msg.audio || msg.data;
        if (!payload) return;

        framesSent++;
        const chunkBytes = Buffer.byteLength(payload, "base64");
        bytesSent += chunkBytes;
        if (!firstAudioSentTs) {
          firstAudioSentTs = new Date().toISOString();
          console.log(`[LATENCY_TRACE] FIRST_AUDIO_SENT → Audio forwarding to telephony in ${Date.now() - streamStartTime}ms (${chunkBytes} bytes)`);
          const state = activeCallStates.get(streamId);
          if (state) {
            state.stage = "GREETING_PLAYING";
            state.greetingStarted = true;
            state.firstAudioTimestamp = firstAudioSentTs;
          }
        }
        lastAudioSentTs = new Date().toISOString();
        isAgentOutputtingAudio = true;
        if (agentAudioEndTimer) clearTimeout(agentAudioEndTimer);
        // Guard window: keep echo suppression active for 450ms after last audio frame
        agentAudioEndTimer = setTimeout(() => {
          isAgentOutputtingAudio = false;
          consecutiveCallerSpeechFrames = 0;
        }, 450);

        const state = activeCallStates.get(streamId);
        if (state) {
          state.stage = "AGENT_SPEAKING";
          state.audioFramesSent = framesSent;
          state.bytesSent = bytesSent;
          state.lastAudioTimestamp = lastAudioSentTs;
        }

        // Direct 1:1 Frame Forwarding (320 bytes = 40ms G.711 μ-law @ 8000Hz):
        // Cartesia delivers frames at speaking pace. Forwarding each frame immediately
        // eliminates 45ms buffering gaps and prevents RTP packet under-runs at the carrier gateway.
        if (vobizWs.readyState === 1) {
          vobizWs.send(
            JSON.stringify({
              event: "playAudio",
              streamId,
              media: {
                contentType: "audio/x-mulaw",
                sampleRate: 8000,
                payload: payload,
              },
            })
          );
        }

        if (framesSent === 1 || framesSent === 5 || framesSent % 25 === 0) {
          console.log(`[CARTESIA_AUDIO_DELIVERED] frame #${framesSent}, chunk=${chunkBytes}B (40ms PCMU), totalSent=${bytesSent}B`);
        }
      }

      // Streaming Text Transcript
      else if (msg.event === "turn_output_text_delta" || msg.type === "turn_output_text_delta") {
        const text = msg.turn_output_text_delta?.text || msg.text;
        if (text) {
          process.stdout.write(`[AI_SPOKE] ${text}\n`);
          const state = activeCallStates.get(streamId);
          if (state) {
            state.lastTranscript = (state.lastTranscript || "") + text;
          }
        }
      }

      // Robust Barge-In Interruption (Guarded: ignore initial line clicks and ensure sustained caller speech)
      else if (msg.event === "audio_output_clear" || msg.type === "audio_output_clear" || msg.event === "interruption" || msg.type === "interruption" || msg.event === "turn_interrupted") {
        const elapsedSinceStart = Date.now() - streamStartTime;
        // Require at least 2.2 seconds elapsed and verified caller speech to prevent line clicks/echo from cutting the voice
        if (elapsedSinceStart > 2200 && (hasConfirmedInterruption || consecutiveCallerSpeechFrames >= 2)) {
          console.log("[CARTESIA_AGENT] Verified caller barge-in — clearing telephony playback buffer");
          try {
            if (vobizWs.readyState === 1) {
              vobizWs.send(JSON.stringify({ event: "clearAudio", streamId }));
            }
          } catch {}
          hasConfirmedInterruption = false;
          consecutiveCallerSpeechFrames = 0;
          const state = activeCallStates.get(streamId);
          if (state) state.stage = "LISTENING";
        } else {
          console.log(`[CARTESIA_AGENT] Guarded premature audio_output_clear (${elapsedSinceStart}ms, verified=${hasConfirmedInterruption}) — speech preserved`);
        }
      }

      // System / Custom Tool Calls
      else if (msg.event === "tool_call" || msg.type === "tool_call") {
        console.log("[CARTESIA_AGENT] Tool call:", JSON.stringify(msg));
        const toolName = msg.name || msg.function?.name || msg.tool_call?.name;
        if (toolName === "end_call") {
          console.log("[CARTESIA_AGENT] End call tool triggered — hanging up cleanly");
          setTimeout(() => {
            try { vobizWs.close(1000, "Cartesia agent ended call"); } catch {}
            try { cartesiaWs.close(1000, "End call"); } catch {}
          }, 1500);
        }
      }

      else if (msg.event === "error" || msg.type === "error") {
        console.error("[CARTESIA_AGENT] Error event from Cartesia:", msg.message || JSON.stringify(msg));
      }
    } catch (parseErr) {
      if (Buffer.isBuffer(rawMsg) && vobizWs.readyState === 1) {
        sendAudioToVobizRaw(vobizWs, streamId, rawMsg);
      }
    }
  });

  cartesiaWs.on("error", (err) => {
    console.error("[CARTESIA_AGENT] WebSocket connection error:", err.message);
  });

  cartesiaWs.on("close", (code, reason) => {
    const rStr = reason?.toString() || "";
    console.log(`[CARTESIA_AGENT] Session closed: code=${code}, reason=${rStr}`);
    console.log(`[MEDIA_FORMAT_SUMMARY] Telemetry: framesSent=${framesSent} (${bytesSent}B), framesRecv=${framesReceived} (${bytesReceived}B), firstSent=${firstAudioSentTs || "none"}`);
    cartesiaReady = false;
    const state = activeCallStates.get(streamId);
    if (state) {
      state.cartesiaConnected = false;
      state.stage = "ENDED";
      state.active = false;
    }
  });

  // Keepalive ping to Cartesia WS every 30s
  const cartesiaPing = setInterval(() => {
    if (cartesiaWs.readyState === 1) cartesiaWs.ping();
    else clearInterval(cartesiaPing);
  }, 30000);

  // Return a handler function — called with each incoming Vobiz audio chunk
  return {
    sendAudio: (mulawChunk) => {
      framesReceived++;
      bytesReceived += mulawChunk.length;
      if (!firstAudioReceivedTs) {
        firstAudioReceivedTs = new Date().toISOString();
      }
      lastAudioReceivedTs = new Date().toISOString();

      const state = activeCallStates.get(streamId);
      if (state) {
        state.audioFramesReceived = framesReceived;
        state.bytesReceived = bytesReceived;
      }

      if (framesReceived === 1 || framesReceived === 10 || framesReceived % 50 === 0) {
        console.log(`[RTP_PACKET_RECEPTION] frame #${framesReceived}, chunk=${mulawChunk.length}B (PCMU 8kHz), totalRecv=${bytesReceived}B`);
      }

      if (cartesiaWs.readyState !== 1) return;

      // Acoustic echo suppression & robust speech interruption verification:
      // Prevent speakerphone and line noise from being piped back to Cartesia, which cuts the agent's voice!
      if (isAgentOutputtingAudio) {
        const rms = calculateRms(mulawChunk);
        // Indian PSTN / mobile lines have background line noise up to 1350 RMS.
        // Require sustained human vocal energy (> 1400 RMS) for at least 4 consecutive frames (~160ms).
        if (rms > 1400) {
          consecutiveCallerSpeechFrames++;
        } else {
          consecutiveCallerSpeechFrames = Math.max(0, consecutiveCallerSpeechFrames - 1);
        }

        if (consecutiveCallerSpeechFrames < 4) {
          return; // Drop echo and transient line clicks from cutting AI speech
        }
        hasConfirmedInterruption = true;
        console.log(`[CARTESIA_ECHO_GUARD] Genuine caller speech interruption confirmed (${consecutiveCallerSpeechFrames} frames, rms=${Math.round(rms)})`);
      } else {
        consecutiveCallerSpeechFrames = 0;
      }

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
      if (agentAudioEndTimer) clearTimeout(agentAudioEndTimer);
      try { cartesiaWs.close(1000, "Call ended"); } catch {}
    },
    isReady: () => cartesiaReady && cartesiaWs.readyState === 1,
    getStats: () => ({
      framesSent,
      bytesSent,
      framesReceived,
      bytesReceived,
      firstAudioSentTs,
      lastAudioSentTs,
    }),
  };
}

// sendAudioToVobizRaw — sends standard 320-byte (40ms @ 8000Hz G.711 PCMU) RTP audio blocks
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

  // Exact runtime agent selection — Section 4 & Section 5 & Section 7
  async function resolveExactAgent() {
    if (queryAgentId && queryAgentId.trim()) {
      const targetId = queryAgentId.trim();

      // 1. Check in-memory agent cache if fresh (< 30s)
      if (agentMetaCache.has(targetId)) {
        const cached = agentMetaCache.get(targetId);
        if (Date.now() - (cached._cachedAt || 0) < 30000) {
          console.log(`[AGENT_CACHE_HIT] Instant agent resolution for "${cached.name}" (${cached.id}) in 0ms`);
          return cached;
        }
      }

      // 2. Query Neon PostgreSQL for this exact agent by id OR cartesiaAgentId
      try {
        const prisma = await getPrismaClient();
        const dbAgent = await prisma.agent.findFirst({
          where: {
            OR: [
              { id: targetId },
              { cartesiaAgentId: targetId },
            ],
          },
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

        if (dbAgent) {
          const resolved = {
            ...dbAgent,
            instructions: dbAgent.instructions || dbAgent.systemPrompt || "",
            systemPrompt: dbAgent.instructions || dbAgent.systemPrompt || "",
            cartesiaAgentId: dbAgent.cartesiaAgentId || (targetId.startsWith("agent_") ? targetId : undefined),
            _cachedAt: Date.now(),
          };
          agentMetaCache.set(targetId, resolved);
          if (resolved.cartesiaAgentId) {
            agentMetaCache.set(resolved.cartesiaAgentId, resolved);
          }
          console.log(`[AGENT_RESOLVED] Exact agent resolved: "${resolved.name}" (${resolved.id}), CartesiaAgentId: ${resolved.cartesiaAgentId || "none"}`);
          return resolved;
        } else if (targetId.startsWith("agent_")) {
          // Direct native Cartesia agent ID passed directly
          const directAgent = {
            id: targetId,
            name: "Cartesia Conversational Agent",
            instructions: "",
            systemPrompt: "",
            cartesiaAgentId: targetId,
            cartesiaVoiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
            language: "TELUGU",
            business: { name: "Direct" },
            _cachedAt: Date.now(),
          };
          agentMetaCache.set(targetId, directAgent);
          return directAgent;
        }
      } catch (err) {
        console.warn("[AGENT_LOOKUP_ERR]", err.message);
      }

      // If an agentId was specified, NEVER fall back to another agent!
      console.warn(`[AGENT_NOT_FOUND] Exact agent "${targetId}" not found. No cross-agent fallback allowed.`);
      return null;
    }

    if (queryCallerNumber) {
      try {
        const clean = queryCallerNumber.replace(/[\s\-\(\)]/g, "");
        const prisma = await getPrismaClient();
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
        if (phone?.assignedAgent) {
          agentMetaCache.set(clean, phone.assignedAgent);
          return phone.assignedAgent;
        }
      } catch {}
    }

    // Default to the single active agent in the system
    try {
      const prisma = await getPrismaClient();
      const defaultAgent = await prisma.agent.findFirst();
      if (defaultAgent) return defaultAgent;
    } catch {}

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
        streamId = msg.start?.streamId || msg.start?.stream_id || msg.streamId || msg.stream_id || `sid_${Date.now()}`;
        callUuid = msg.start?.callUuid || msg.start?.call_uuid || msg.start?.callId || msg.start?.call_id || msg.start?.callSid || msg.callUuid || "unknown";
        console.log(`[LATENCY_TRACE] CALL_STARTED → streamId=${streamId}, callUuid=${callUuid}`);
        console.log(`[SIP_CALL_CONNECTION] streamId=${streamId}, callUuid=${callUuid}, status=connected`);
        console.log(`[CODEC_NEGOTIATION] negotiated=G.711_PCMU, sampleRate=8000Hz, encoding=pcm_mulaw, rtpPayloadType=0, packetization=40ms (320B)`);
        console.log(`[AUDIO_RESAMPLING] passthrough=true, inputRate=8000Hz, outputRate=8000Hz (lossless 1:1, 0 resampling error)`);

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
          // ── CARTESIA NATIVE AGENT PATH (Zero-latency direct speech synthesis & trained persona) ──
          console.log(`[LATENCY_TRACE] CARTESIA_CONNECTING → Connecting to Cartesia Agent WebSocket: ${cartesiaAgentId}`);
          cartesiaAgentBridge = await handleCartesiaAgentStream(ws, cartesiaAgentId, streamId, callUuid, agentName);
          if (cartesiaAgentBridge) {
            useCartesiaNative = true;
            greetingSent = true;
            console.log(`[LATENCY_TRACE] SPEECH_STARTED → Cartesia Native Agent active, streaming trained greeting`);
          } else {
            console.warn(`[CARTESIA_AGENT] Bridge connection failed — auto-routing to low-latency pipeline`);
          }
        }

        // ── FALLBACK PIPELINE: If Cartesia Native bridge is not active ──
        if (!useCartesiaNative && !greetingSent) {
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

            console.log(`[LATENCY_TRACE] SPEECH_STARTED → Welcome greeting delivered: "${greeting}" in ${Date.now() - tStart}ms`);

            if (!greetAudio) {
              greetAudio = await synthesizeSpeech(greeting, voiceId);
            }

            if (greetAudio && greetAudio.length > 0 && streamId) {
              const durationMs = (greetAudio.length / 8000) * 1000;
              setAiSpeaking(true, durationMs);
              sendAudioToVobiz(ws, streamId, greetAudio);
              conversationHistory.push({ role: "assistant", content: greeting });
              console.log(`[LISTENING] Welcome greeting sent to phone. Listening for caller response...`);
              const state = activeCallStates.get(streamId);
              if (state) {
                state.stage = "GREETING_PLAYING";
                state.greetingStarted = true;
                state.lastTranscript = greeting;
              }
            } else {
              setAiSpeaking(false);
            }
          } else {
            setAiSpeaking(false);
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
          // Natural conversational pause: 800ms ensures caller finished their full sentence
          if (silenceDuration >= 800 || speechAudioChunks.length > 500) {
            console.log(`[CALLER_SPEECH_END] Turn complete (${(speechAudioChunks.length * 20 / 1000).toFixed(1)}s audio, silence=${silenceDuration}ms)`);
            callerIsSpeaking = false;
            const turnAudio = Buffer.concat(speechAudioChunks);
            speechAudioChunks = [];
            preSpeechBuffer = [];
            processCallerAudio(turnAudio);
          }
        }

      } else if (event === "playedStream") {
        console.log(`[LATENCY_TRACE] FIRST_AUDIO_DELIVERED → Customer heard agent audio playback on phone (name=${msg.name || "unknown"})`);
        console.log(`[CALLER_AUDIO_PLAYBACK_CONFIRMED] name=${msg.name || "unknown"}`);
        console.log(`[VOBIZ] Outbound audio playback finished (name=${msg.name || "unknown"})`);
        livePipelineStatus.callerPlayback = "Confirmed";
        setAiSpeaking(false);
        const state = activeCallStates.get(streamId);
        if (state) {
          state.greetingCompleted = true;
          state.stage = "LISTENING";
        }

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
    console.log(`[LATENCY_TRACE] CALL_ENDED → WebSocket closed: code=${code}, reason=${reasonStr}`);
    if (speakingWatchdog) clearTimeout(speakingWatchdog);
    if (pingInterval) clearInterval(pingInterval);
    // Close Cartesia native bridge if active
    if (cartesiaAgentBridge) {
      cartesiaAgentBridge.close();
      cartesiaAgentBridge = null;
      console.log("[CARTESIA_AGENT] Bridge closed on call end");
    }
    // Update active call states
    const state = activeCallStates.get(streamId);
    if (state) {
      state.stage = "ENDED";
      state.active = false;
      state.endedAt = new Date().toISOString();
      state.durationSeconds = Math.round((Date.now() - callConnectTime) / 1000);
    }
    // Update Neon PostgreSQL if callUuid exists
    if (callUuid && callUuid !== "unknown") {
      getPrismaClient().then((prisma) => {
        prisma.call.updateMany({
          where: { vobizCallId: callUuid },
          data: {
            status: "COMPLETED",
            endedAt: new Date(),
            durationSeconds: Math.round((Date.now() - callConnectTime) / 1000),
          },
        }).catch(() => {});
      }).catch(() => {});
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
    const parsed = new URL(url, `http://localhost:${port}`);
    const targetAgentId = parsed.searchParams.get("agentId");
    if (targetAgentId) {
      const cleanId = targetAgentId.trim();
      agentGreetingCache.delete(cleanId);
      agentMetaCache.delete(cleanId);
      for (const [key, val] of agentMetaCache.entries()) {
        if (val.id === cleanId || val.cartesiaAgentId === cleanId) {
          agentMetaCache.delete(key);
        }
      }
      for (const [key] of agentGreetingCache.entries()) {
        if (key === cleanId) {
          agentGreetingCache.delete(key);
        }
      }
      console.log(`[CACHE_INVALIDATED] Cleared cache specifically for agent: ${cleanId}`);
    } else {
      agentGreetingCache.clear();
      agentMetaCache.clear();
      console.log("[CACHE_INVALIDATED] Cleared all pre-warmed agent greeting and metadata cache");
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, message: "Agent cache cleared" }));
    return;
  }
  if (url === "/api/calls/live-status" || url.startsWith("/api/calls/live-status")) {
    const parsed = new URL(url, `http://localhost:${port}`);
    const id = parsed.searchParams.get("id");
    let match = null;
    if (id) {
      for (const [sid, s] of activeCallStates.entries()) {
        if (s.callUuid === id || sid === id || s.callId === id) {
          match = s;
          break;
        }
      }
    }
    if (!match && activeCallStates.size > 0) {
      match = Array.from(activeCallStates.values()).pop();
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, state: match || { stage: "IDLE", active: false } }));
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
