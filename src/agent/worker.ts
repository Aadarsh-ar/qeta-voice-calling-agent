import "dotenv/config";
import { cli, defineAgent, initializeLogger, ServerOptions, voice, llm, JobContext } from "@livekit/agents";
import * as deepgram from "@livekit/agents-plugin-deepgram";
import * as cartesia from "@livekit/agents-plugin-cartesia";
import * as silero from "@livekit/agents-plugin-silero";
import * as openai from "@livekit/agents-plugin-openai";
import { fileURLToPath } from "node:url";
import { prisma } from "../lib/db/prisma.js";
import { compileAgentVoicePrompt, compileAgentGreeting } from "./prompt.js";
import { AGENT_TOOLS, executeToolCall } from "../lib/agent/tools.js";

// Initialize LiveKit logger
initializeLogger({ level: "info", pretty: true });

let loadedVad: any = null;
async function getVad() {
  if (!loadedVad) {
    loadedVad = await silero.VAD.load();
  }
  return loadedVad;
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    console.log(`[QETA LiveKit Agent] Connecting to room: ${ctx.room.name}...`);
    await ctx.connect();
    console.log(`[QETA LiveKit Agent] Connected to room: ${ctx.room.name}`);

    const roomName = ctx.room.name || "";
    let callId: string | null = null;
    let agentId: string | null = null;
    let isDemo = false;

    if (roomName.startsWith("call_")) {
      callId = roomName.replace(/^call_/, "");
    } else if (roomName.startsWith("demo_")) {
      isDemo = true;
    }

    // Inspect job metadata if provided
    if (ctx.job?.metadata) {
      try {
        const parsed = JSON.parse(ctx.job.metadata);
        if (parsed.agentId) agentId = parsed.agentId;
        if (parsed.callId) callId = parsed.callId;
        if (parsed.isDemo) isDemo = true;
      } catch {}
    }

    // Inspect participant metadata
    for (const p of ctx.room.remoteParticipants.values()) {
      if (p.metadata) {
        try {
          const parsed = JSON.parse(p.metadata);
          if (parsed.agentId) agentId = parsed.agentId;
          if (parsed.callId) callId = parsed.callId;
          if (parsed.isDemo) isDemo = true;
        } catch {}
      }
    }

    // 1. Fetch Call Record & Agent Details
    let callRecord: any = null;
    if (callId) {
      try {
        callRecord = await prisma.call.findUnique({
          where: { id: callId },
          include: {
            agent: {
              include: {
                business: true,
                knowledge: true,
                tools: true,
              },
            },
          },
        });
        if (callRecord?.agent) {
          agentId = callRecord.agent.id;
        }
      } catch (err) {
        console.warn(`[QETA Worker] Failed to fetch Call record ${callId}:`, err);
      }
    }

    let agentData = callRecord?.agent;
    if (!agentData) {
      const targetAgentId = agentId || process.env.NEXT_PUBLIC_SHOWCASE_AGENT_ID;
      if (targetAgentId) {
        try {
          agentData = await prisma.agent.findUnique({
            where: { id: targetAgentId },
            include: {
              business: true,
              knowledge: true,
              tools: true,
            },
          });
        } catch (err) {
          console.warn(`[QETA Worker] Failed to fetch Agent ${targetAgentId}:`, err);
        }
      }

      if (!agentData) {
        try {
          agentData = await prisma.agent.findFirst({
            where: { status: "ACTIVE" },
            include: {
              business: true,
              knowledge: true,
              tools: true,
            },
          });
        } catch {}
      }
    }

    const agentName = agentData?.name || "Harika";
    const businessName = agentData?.business?.name || "QETADOTIN Technologies";
    const language = (agentData?.language as any) || "TELUGU_ENGLISH";
    const voiceId =
      agentData?.cartesiaVoiceId ||
      process.env.CARTESIA_VOICE_ID ||
      "41508a7d-4839-445f-ba7f-687f620ed0e7"; // Harika cloned voice

    const knowledgeSnippets = agentData?.knowledge?.map((k: any) => `${k.title}: ${k.content}`) || [];

    // 2. Compile System Prompt & Greeting
    const instructions = compileAgentVoicePrompt({
      agentName,
      businessName,
      instructions: agentData?.instructions || agentData?.systemPrompt,
      businessContext: agentData?.businessContext || agentData?.business?.information,
      language,
      knowledgeSnippets,
    });

    const greeting = compileAgentGreeting({
      agentName,
      businessName,
      customGreeting: agentData?.initialMessage,
      language,
    });

    // 3. Bind executable tools
    const livekitTools = AGENT_TOOLS.map((t) => {
      return llm.tool({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters as any,
        execute: async (args: Record<string, unknown>) => {
          console.log(`[QETA Tool Call] Executing ${t.function.name}:`, args);
          const result = await executeToolCall(t.function.name, args);
          if (t.function.name === "end_call") {
            setTimeout(async () => {
              try {
                await ctx.room.disconnect();
              } catch {}
            }, 3000);
          }
          return JSON.stringify(result);
        },
      });
    });

    // 4. Instantiate VAD, STT, TTS, LLM
    const vad = await getVad();

    const stt = new deepgram.STT({
      apiKey: process.env.DEEPGRAM_API_KEY,
      model: "nova-3",
      language: language === "TELUGU" ? "te" : language === "ENGLISH" ? "en" : "multi",
    });

    const tts = new cartesia.TTS({
      apiKey: process.env.CARTESIA_API_KEY,
      voice: voiceId,
      model: "sonic-3.6",
    });

    const llmModel = new openai.LLM({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: process.env.GROQ_API_KEY,
      model: "qwen/qwen3.8-27b",
    });

    // 5. Construct Voice Agent & Session
    const voiceAgent = new voice.Agent({
      instructions,
      tools: livekitTools,
      allowInterruptions: true,
    });

    const session = new voice.AgentSession({
      stt,
      tts,
      llm: llmModel,
      vad,
    });

    // 6. Persist initial Call State
    const startTime = new Date();
    if (callId) {
      try {
        await prisma.call.update({
          where: { id: callId },
          data: {
            status: "ACTIVE",
            livekitRoom: ctx.room.name,
            startedAt: startTime,
          },
        });
      } catch (err) {
        console.warn(`[QETA Worker] Failed to set call active for ${callId}:`, err);
      }
    }

    // 7. Lifecycle tracking & Transcripts
    const transcriptEntries: { role: string; text: string; time: Date }[] = [];

    // Record greeting in transcript
    transcriptEntries.push({ role: "AI", text: greeting, time: new Date() });

    // Handle user transcription
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event: any) => {
      if (event?.transcript?.trim()) {
        const text = event.transcript.trim();
        console.log(`[QETA Caller Speech]: "${text}"`);
        transcriptEntries.push({ role: "CALLER", text, time: new Date() });
      }
    });

    // Handle agent speech response
    session.on(voice.AgentSessionEventTypes.SpeechCreated, (event: any) => {
      if (event?.text?.trim()) {
        const text = event.text.trim();
        console.log(`[QETA Agent Speech]: "${text}"`);
        transcriptEntries.push({ role: "AI", text, time: new Date() });
      }
    });

    // Cleanup on close / disconnect
    const cleanupCall = async () => {
      if (callId) {
        try {
          const endTime = new Date();
          const duration = Math.max(1, Math.round((endTime.getTime() - startTime.getTime()) / 1000));
          const transcriptText = transcriptEntries
            .map((e) => `${e.role === "AI" ? agentName : "Caller"}: ${e.text}`)
            .join("\n");

          await prisma.call.update({
            where: { id: callId },
            data: {
              status: "COMPLETED",
              endedAt: endTime,
              durationSeconds: duration,
            },
          });
          console.log(`[QETA Call ${callId}] Persisted completed call (duration: ${duration}s)`);
        } catch (err) {
          console.warn(`[QETA Worker] Failed to update completed call ${callId}:`, err);
        }
      }
    };

    session.on(voice.AgentSessionEventTypes.Close, cleanupCall);
    ctx.room.on("disconnected", cleanupCall);

    // 8. Start Session in Room
    console.log(`[QETA LiveKit Agent] Starting voice session in room ${ctx.room.name}...`);
    await session.start({
      agent: voiceAgent,
      room: ctx.room,
    });

    // 9. Speak Initial Greeting Immediately
    console.log(`[QETA LiveKit Agent] Speaking initial greeting: "${greeting}"`);
    try {
      session.say(greeting, { allowInterruptions: true });
    } catch (err) {
      console.error(`[QETA LiveKit Agent] Error speaking greeting:`, err);
    }
  },
});

// Run LiveKit agent CLI worker
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    wsURL: process.env.LIVEKIT_URL,
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
  })
);
