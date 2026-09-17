import { WebSocketServer, WebSocket } from "ws";
import { sarvamClient } from "../lib/sarvam/client";
import { cartesiaClient } from "../lib/cartesia/client";
import { vobizTelephony } from "../lib/vobiz/telephony";
import { agentOrchestrator } from "../lib/agent/orchestrator";
import { normalizeTeluguText } from "../lib/speech/normalizeTelugu";
import { dataStore } from "../lib/db/store";
import { CallStatus } from "@prisma/client";

export interface RealtimeCallSession {
  streamId: string;
  callSid?: string;
  agentId: string;
  state: CallStatus;
  sarvamWs?: WebSocket;
  isSpeaking: boolean;
  history: { role: "system" | "user" | "assistant" | "tool"; content: string }[];
}

export class RealtimeVoiceEngine {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, RealtimeCallSession> = new Map();

  start(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    console.log(`[Vaani Realtime Engine] WebSocket server listening on port ${port}`);

    this.wss.on("connection", (clientWs: WebSocket) => {
      let currentSession: RealtimeCallSession | null = null;

      clientWs.on("message", async (data: Buffer | string) => {
        try {
          const message = JSON.parse(data.toString());

          // 1. Vobiz Handshake / Start event
          if (message.event === "start") {
            const streamId = message.stream_id || message.streamId || `stream_${Date.now()}`;
            console.log(`[Vaani Engine] Call Stream started: ${streamId}`);

            currentSession = {
              streamId,
              agentId: "agent_telugu_sales",
              state: CallStatus.LISTENING,
              isSpeaking: false,
              history: [],
            };
            this.sessions.set(streamId, currentSession);

            // Connect to Sarvam Saaras Realtime STT if configured
            if (sarvamClient.isConfigured()) {
              this.initializeSarvamStream(currentSession, clientWs);
            }
            return;
          }

          // 2. Inbound Caller Media
          if (message.event === "media" && currentSession) {
            const payloadBase64 = message.media?.payload;
            if (!payloadBase64) return;

            const pcmBuffer = Buffer.from(payloadBase64, "base64");

            // Check for Barge-In: If caller speaks while AI is currently outputting audio
            if (currentSession.isSpeaking) {
              console.log(`[Vaani Engine] Barge-in detected! Stopping TTS playback.`);
              currentSession.isSpeaking = false;
              currentSession.state = CallStatus.INTERRUPTED;

              // Send immediate clearAudio command to Vobiz
              const clearMsg = vobizTelephony.createClearAudioMessage(currentSession.streamId);
              clientWs.send(clearMsg);

              currentSession.state = CallStatus.LISTENING;
            }

            // Forward audio to Sarvam Saaras STT
            if (currentSession.sarvamWs && currentSession.sarvamWs.readyState === WebSocket.OPEN) {
              const sarvamPayload = sarvamClient.formatAudioMessage(pcmBuffer);
              currentSession.sarvamWs.send(sarvamPayload);
            }
          }

          // 3. Stop or Disconnect
          if (message.event === "stop" && currentSession) {
            console.log(`[Vaani Engine] Call stream ended: ${currentSession.streamId}`);
            if (currentSession.sarvamWs) {
              currentSession.sarvamWs.close();
            }
            this.sessions.delete(currentSession.streamId);
          }
        } catch (err) {
          console.error("[Vaani Engine] Error processing message:", err);
        }
      });

      clientWs.on("close", () => {
        if (currentSession) {
          if (currentSession.sarvamWs) currentSession.sarvamWs.close();
          this.sessions.delete(currentSession.streamId);
        }
      });
    });
  }

  private initializeSarvamStream(session: RealtimeCallSession, clientWs: WebSocket) {
    try {
      const url = sarvamClient.getWebSocketUrl();
      const headers = sarvamClient.getHeaders();
      const sarvamWs = new WebSocket(url, { headers });

      session.sarvamWs = sarvamWs;

      sarvamWs.on("open", () => {
        console.log(`[Vaani Engine] Connected to Sarvam Saaras STT for stream ${session.streamId}`);
      });

      sarvamWs.on("message", async (msgData) => {
        try {
          const parsed = JSON.parse(msgData.toString());
          // Check for final transcript turn
          if (parsed.type === "final" || parsed.transcript) {
            const transcript = parsed.transcript?.trim();
            if (!transcript) return;

            console.log(`[Caller Speech]: ${transcript}`);
            await this.handleCallerTurn(session, clientWs, transcript);
          }
        } catch (err) {
          console.error("[Vaani Engine] Sarvam message parse error:", err);
        }
      });

      sarvamWs.on("error", (err) => {
        console.error("[Vaani Engine] Sarvam WebSocket error:", err);
      });
    } catch (err) {
      console.error("[Vaani Engine] Failed to initialize Sarvam stream:", err);
    }
  }

  /**
   * Complete Conversation Loop:
   * Caller transcript -> Agent Prompt -> LLM Generation -> Telugu Normalization -> Cartesia Cloned TTS -> Vobiz playAudio
   */
  async handleCallerTurn(session: RealtimeCallSession, clientWs: WebSocket, transcript: string) {
    session.state = CallStatus.THINKING;

    const agent = dataStore.getAgent(session.agentId) || dataStore.getAgents()[0];
    const systemPrompt = agent?.systemPrompt || "మీరు Vaani AI అసిస్టెంట్. 1-2 వాక్యాల్లో సమాధానం ఇవ్వండి.";

    // 1. LLM Generation
    const turnResult = await agentOrchestrator.generateTurn(
      systemPrompt,
      session.history,
      transcript
    );

    session.history.push({ role: "user", content: transcript });
    session.history.push({ role: "assistant", content: turnResult.rawText });

    // 2. Telugu Normalization
    const normalized = turnResult.normalizedText || normalizeTeluguText(turnResult.rawText);

    // 3. Cartesia Cloned TTS Synthesis
    session.state = CallStatus.SPEAKING;
    session.isSpeaking = true;

    try {
      const voiceId = agent?.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e";
      const audioBuffer = await cartesiaClient.synthesize({
        transcript: normalized,
        voiceId,
        encoding: "pcm_s16le",
        sampleRate: 16000,
      });

      // 4. Send chunks to Vobiz via playAudio
      if (session.isSpeaking && clientWs.readyState === WebSocket.OPEN) {
        const playMsg = vobizTelephony.createPlayAudioMessage(
          session.streamId,
          Buffer.from(audioBuffer),
          16000
        );
        clientWs.send(playMsg);
      }
    } catch (err) {
      console.error("[Vaani Engine] TTS generation failed:", err);
    } finally {
      session.isSpeaking = false;
      session.state = CallStatus.LISTENING;
    }
  }
}

export const realtimeVoiceEngine = new RealtimeVoiceEngine();
