/**
 * Vobiz Bidirectional WebSocket Voice Bridge
 *
 * Architecture:
 *  1. Vobiz calls POST /api/vobiz/incoming-call → returns XML with WebSocket URL
 *  2. Vobiz connects to this WebSocket at /api/vobiz/stream
 *  3. This handler:
 *     a. Receives binary audio chunks from caller (PCM/μ-law 8kHz)
 *     b. Streams caller audio → Sarvam STT (real-time transcription)
 *     c. On final transcript → Groq LLM (ultra-fast inference)
 *     d. LLM response → Cartesia TTS (PCM audio synthesis)
 *     e. Sends synthesized audio back over WebSocket → caller hears agent voice
 */

import { AgentOrchestrator, ConversationTurn } from "@/lib/agent/orchestrator";
import { buildAgentSystemPrompt } from "@/lib/agent/prompt";
import { CartesiaClient } from "@/lib/cartesia/client";
import { dataStore } from "@/lib/db/store";

// Force Node.js runtime (WebSocket requires native net)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─── Cartesia TTS synthesis (server-side) ────────────────────────────────────
async function synthesizeSpeech(text: string, voiceId: string): Promise<Buffer | null> {
  const cartesia = new CartesiaClient();
  if (!cartesia.isConfigured()) {
    console.warn("[TTS] Cartesia not configured, skipping synthesis");
    return null;
  }

  try {
    const buf = await cartesia.synthesize({
      transcript: text,
      voiceId,
      modelId: "sonic-3.6",
      sampleRate: 8000,        // Vobiz expects 8kHz for telephony
      encoding: "pcm_mulaw",   // μ-law = G.711 PCMU (standard telephony codec)
    });
    return Buffer.from(buf);
  } catch (err) {
    console.error("[TTS] Cartesia synthesis error:", err);
    return null;
  }
}

// ─── Sarvam STT – batch transcription via REST (no ws in edge fn) ────────────
async function transcribeWithSarvam(pcmBuffer: Buffer): Promise<string | null> {
  const apiKey = process.env.SARVAM_API_KEY || "";
  if (!apiKey) return null;

  try {
    const wavHeader = createWavHeader(pcmBuffer.length, 8000, 1, 16);
    const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const form = new FormData();
    form.append("file", blob, "audio.wav");
    form.append("model", "saaras:v2");
    form.append("language_code", "te-IN");
    form.append("with_timestamps", "false");

    const res = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: form,
    });

    if (res.ok) {
      const data = await res.json();
      return data.transcript || null;
    }
    return null;
  } catch (err) {
    console.error("[STT] Sarvam transcription error:", err);
    return null;
  }
}

// ─── Build minimal WAV header ─────────────────────────────────────────────────
function createWavHeader(dataLength: number, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
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

// ─── Generate greetings via Cartesia TTS ─────────────────────────────────────
async function sendGreeting(ws: import("ws").WebSocket, streamId: string, agentName: string, voiceId: string) {
  const greeting = `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను. మీకు ఏ విధంగా సహాయపడగలను?`;
  console.log(`[AGENT] Greeting: ${greeting}`);

  const audioBuf = await synthesizeSpeech(greeting, voiceId);
  if (audioBuf) {
    const msg = JSON.stringify({
      event: "playAudio",
      streamId,
      media: {
        contentType: "audio/x-l16;rate=8000",
        sampleRate: 8000,
        payload: audioBuf.toString("base64"),
      },
    });
    ws.send(msg);
    console.log(`[AGENT] Sent greeting audio (${audioBuf.length} bytes)`);
  }
}

// ─── Main WebSocket handler ───────────────────────────────────────────────────
export async function GET(req: Request) {
  const { WebSocketServer } = await import("ws");
  const upgrade = req.headers.get("upgrade") || "";

  if (upgrade.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }

  // Get the underlying Node.js socket from the request
  const upgradeHeader = req.headers.get("upgrade");
  if (!upgradeHeader) {
    return new Response("No upgrade header", { status: 400 });
  }

  return new Response(null, {
    status: 101,
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
    },
  });
}

// ─── Session state for each connected call ────────────────────────────────────
interface CallSession {
  streamId: string;
  conversationHistory: ConversationTurn[];
  systemPrompt: string;
  voiceId: string;
  agentName: string;
  audioAccumulator: Buffer[];
  silenceTimer: NodeJS.Timeout | null;
  isSpeaking: boolean;
  orchestrator: AgentOrchestrator;
  totalAudioMs: number;
}

// Export the WebSocket handler for Next.js custom server
export function createVobizStreamHandler() {
  const activeSessions = new Map<string, CallSession>();

  async function handleConnection(ws: import("ws").WebSocket) {
    let session: CallSession | null = null;
    console.log("[STREAM] New Vobiz WebSocket connection");

    ws.on("message", async (rawMsg: Buffer | string) => {
      try {
        // Parse Vobiz message
        const msg = JSON.parse(rawMsg.toString());
        const event = msg.event;

        // ── 1. CALL STARTED ────────────────────────────────────────────────
        if (event === "start") {
          const streamId = msg.streamId || msg.start?.streamId || `stream_${Date.now()}`;
          const callSid = msg.start?.callSid || "unknown";

          // Load the active agent
          const agents = dataStore.getAgents();
          const agent = agents.find(a => a.status === "ACTIVE") || agents[0];
          const voiceId = agent?.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "ff480e6e-3e79-4307-9889-d1d9feb8e20e";
          const agentName = agent?.name || "Vaani AI";
          const systemPrompt = agent?.systemPrompt || buildAgentSystemPrompt({
            agentName,
            businessName: "Vaani Enterprises",
            businessDescription: "AI Voice Automation Platform for Regional Languages",
            productsServices: "Telugu AI calling agents, automated lead qualification, customer service bots",
            languageMode: "TELUGU_ENGLISH",
          });

          session = {
            streamId,
            conversationHistory: [],
            systemPrompt,
            voiceId,
            agentName,
            audioAccumulator: [],
            silenceTimer: null,
            isSpeaking: false,
            orchestrator: new AgentOrchestrator(),
            totalAudioMs: 0,
          };

          activeSessions.set(streamId, session);
          console.log(`[STREAM] Call started: ${callSid}, Agent: ${agentName}, Voice: ${voiceId}`);

          // Send greeting immediately
          await sendGreeting(ws, streamId, agentName, voiceId);
        }

        // ── 2. AUDIO FROM CALLER ───────────────────────────────────────────
        else if (event === "media" && session) {
          const payload = msg.media?.payload;
          if (!payload) return;

          const audioChunk = Buffer.from(payload, "base64");
          session.audioAccumulator.push(audioChunk);
          session.totalAudioMs += (audioChunk.length / 8); // 8kHz → ms

          // Accumulate 2 seconds of audio before transcribing (speech detection)
          if (session.silenceTimer) {
            clearTimeout(session.silenceTimer);
          }

          // Process after 1.5s of silence (user stopped talking)
          session.silenceTimer = setTimeout(async () => {
            if (!session || session.audioAccumulator.length === 0) return;

            const totalAudio = Buffer.concat(session.audioAccumulator);
            session.audioAccumulator = [];
            session.totalAudioMs = 0;

            // Skip if too short (< 300ms of audio = noise/silence)
            if (totalAudio.length < 2400) return;

            console.log(`[STT] Transcribing ${totalAudio.length} bytes of caller audio...`);

            // Transcribe with Sarvam STT
            const transcript = await transcribeWithSarvam(totalAudio);
            if (!transcript || transcript.trim().length < 2) {
              console.log("[STT] Empty or very short transcript, skipping");
              return;
            }

            console.log(`[STT] Transcript: "${transcript}"`);

            // Add to conversation history
            session.conversationHistory.push({ role: "user", content: transcript });

            // Get LLM response
            try {
              session.isSpeaking = true;
              const result = await session.orchestrator.generateTurn(
                session.systemPrompt,
                session.conversationHistory.slice(-8), // Keep last 8 turns for context
                transcript
              );

              const agentReply = result.rawText;
              console.log(`[LLM] Agent reply (${result.llmLatencyMs}ms): "${agentReply}"`);

              // Add to conversation history
              session.conversationHistory.push({ role: "assistant", content: agentReply });

              // Synthesize TTS
              const audioBuf = await synthesizeSpeech(agentReply, session.voiceId);
              if (audioBuf) {
                // Stop any currently playing audio (barge-in support)
                ws.send(JSON.stringify({ event: "clearAudio", streamId: session.streamId }));

                // Send synthesized agent voice
                const playMsg = JSON.stringify({
                  event: "playAudio",
                  streamId: session.streamId,
                  media: {
                    contentType: "audio/x-l16;rate=8000",
                    sampleRate: 8000,
                    payload: audioBuf.toString("base64"),
                  },
                });
                ws.send(playMsg);
                console.log(`[TTS] Sent ${audioBuf.length} bytes of agent voice`);
              }

              // Handle end-call signal from LLM
              if (result.shouldEndCall) {
                setTimeout(() => {
                  ws.close();
                  console.log("[STREAM] Agent ended the call");
                }, 3000);
              }

              session.isSpeaking = false;
            } catch (llmErr) {
              console.error("[LLM] Error generating response:", llmErr);
              session.isSpeaking = false;
            }
          }, 1500);
        }

        // ── 3. CALL ENDED ──────────────────────────────────────────────────
        else if (event === "stop" && session) {
          console.log(`[STREAM] Call ended: ${session.streamId}`);
          if (session.silenceTimer) clearTimeout(session.silenceTimer);
          activeSessions.delete(session.streamId);
          session = null;
        }

        // ── 4. DTMF / MARKS ────────────────────────────────────────────────
        else if (event === "dtmf" && session) {
          const digit = msg.dtmf?.digit;
          console.log(`[DTMF] Digit pressed: ${digit}`);
        }

      } catch (parseErr) {
        // Could be binary audio, not JSON
        if (session && Buffer.isBuffer(rawMsg)) {
          session.audioAccumulator.push(rawMsg);
        }
      }
    });

    ws.on("close", () => {
      console.log("[STREAM] WebSocket connection closed");
      if (session) {
        if (session.silenceTimer) clearTimeout(session.silenceTimer);
        activeSessions.delete(session.streamId);
      }
    });

    ws.on("error", (err) => {
      console.error("[STREAM] WebSocket error:", err.message);
    });
  }

  return handleConnection;
}
