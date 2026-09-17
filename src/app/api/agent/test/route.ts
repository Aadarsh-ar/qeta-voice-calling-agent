import { NextResponse } from "next/server";
import { agentOrchestrator } from "@/lib/agent/orchestrator";
import { cartesiaClient } from "@/lib/cartesia/client";
import { dataStore } from "@/lib/db/store";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentId, userMessage, conversationHistory = [], simulatedSttLatency } = body;

    if (!userMessage) {
      return NextResponse.json(
        { success: false, error: "User message is required." },
        { status: 400 }
      );
    }

    let agent = agentId ? dataStore.getAgent(agentId) : dataStore.getAgents()[0];
    if (!agent) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
        let dbAgent = agentId
          ? await prisma.agent.findUnique({
              where: { id: agentId },
              include: { tools: true, knowledge: true, business: true },
            })
          : null;

        if (!dbAgent) {
          dbAgent = await prisma.agent.findFirst({
            where: { status: "ACTIVE" },
            include: { tools: true, knowledge: true, business: true },
          }) || await prisma.agent.findFirst({
            include: { tools: true, knowledge: true, business: true },
          });
        }

        if (dbAgent) {
          let parsedBizProfile: any = undefined;
          if (dbAgent.businessContext && dbAgent.businessContext.trim().startsWith("{")) {
            try { parsedBizProfile = JSON.parse(dbAgent.businessContext); } catch {}
          }
          agent = {
            id: dbAgent.id,
            name: dbAgent.name,
            description: dbAgent.description || "",
            language: dbAgent.language as any,
            status: dbAgent.status as any,
            systemPrompt: dbAgent.instructions || dbAgent.systemPrompt,
            businessContext: dbAgent.businessContext || "",
            businessProfile: parsedBizProfile,
            cartesiaVoiceId: dbAgent.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
            cartesiaVoiceName: "AD (Cloned Telugu Voice)",
            cartesiaModel: dbAgent.cartesiaModel,
            llmModel: dbAgent.llmModel,
            sarvamModel: dbAgent.sarvamModel,
            sarvamLanguage: dbAgent.sarvamLanguage,
            phoneNumber: "+91 80 7158 2667",
            callsCount: 0,
            totalMinutes: 0,
            estimatedCost: 0,
            lastActive: "Active",
            createdAt: dbAgent.createdAt.toISOString(),
            tools: dbAgent.tools.map((t) => ({
              name: t.name,
              description: t.description,
              isEnabled: t.enabled && t.isEnabled,
            })),
            cartesiaAgentId: dbAgent.cartesiaAgentId || undefined,
          };
        }
      } catch (e) {
        console.warn("Prisma agent lookup failed in test route:", e);
      }
    }

    const sttLatencyMs = simulatedSttLatency || 195; // Realtime Sarvam STT benchmark is ~180-220ms

    // Run LLM Orchestration with complete agent context, RAG and tools
    const turnResult = await agentOrchestrator.generateTurn(
      agent || "మీరు QETADOTIN AI వాయిస్ అసిస్టెంట్. 1-2 వాక్యాలలో సహజమైన తెలుగు లేదా టెంగ్లీష్ లో సమాధానం ఇవ్వండి.",
      conversationHistory,
      userMessage,
      {
        agent,
        customerName: "కస్టమర్ (Caller)",
        customerPhone: "+916305367443",
      }
    );

    // Run Cartesia TTS Synthesis using cloned voice
    let ttsLatencyMs = 120;
    let audioBase64: string | null = null;
    let audioBytes = 0;

    if (cartesiaClient.isConfigured()) {
      const ttsStart = Date.now();
      try {
        const voiceId = agent?.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
        const textToSynthesize = turnResult.normalizedText || turnResult.rawText || "నమస్కారం అండి, మీకు ఎలా సహాయం చేయగలను?";
        
        console.log(`[TEST_ROUTE_TTS] Synthesizing speech for agent "${agent?.name || agentId}" | Voice: ${voiceId} | Text: "${textToSynthesize.slice(0, 60)}..."`);
        
        const audioBuffer = await cartesiaClient.synthesize({
          transcript: textToSynthesize,
          voiceId,
          modelId: "sonic-3.6",
          encoding: "pcm_s16le",
          sampleRate: 16000,
        });
        ttsLatencyMs = Date.now() - ttsStart;
        audioBytes = audioBuffer ? audioBuffer.byteLength : 0;

        if (audioBytes > 0) {
          audioBase64 = Buffer.from(audioBuffer).toString("base64");
          console.log(`[TEST_ROUTE_TTS] Success: ${audioBytes} audio bytes generated in ${ttsLatencyMs}ms`);
        } else {
          console.error(`[TEST_ROUTE_TTS] FAILED: Cartesia returned 0 audio bytes`);
          return NextResponse.json(
            {
              success: false,
              error: "Cartesia TTS generated 0 audio bytes",
              audioBytes: 0,
              agentId: agent?.id,
              rawReply: turnResult.rawText,
            },
            { status: 502 }
          );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[TEST_ROUTE_TTS] Synthesis error:`, errMsg);
        return NextResponse.json(
          {
            success: false,
            error: `Cartesia synthesis error: ${errMsg}`,
            audioBytes: 0,
            agentId: agent?.id,
            rawReply: turnResult.rawText,
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      agentId: agent?.id,
      agentName: agent?.name,
      intent: turnResult.intent || "Conversational Inquiry",
      rawReply: turnResult.rawText,
      normalizedReply: turnResult.normalizedText,
      retrievedSnippets: turnResult.retrievedSnippets || [],
      toolCalls: turnResult.toolCalls || [],
      qualityValidation: turnResult.qualityValidation,
      cartesiaVoiceId: agent?.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID,
      audioBase64,
      audioBytes,
      audioFormat: "audio/x-l16",
      sampleRate: 16000,
      latencies: {
        sttMs: sttLatencyMs,
        llmMs: turnResult.llmLatencyMs,
        ttsMs: ttsLatencyMs,
        totalMs: sttLatencyMs + turnResult.llmLatencyMs + ttsLatencyMs,
      },
      shouldEndCall: turnResult.shouldEndCall,
      shouldTransfer: turnResult.shouldTransfer,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error testing agent" },
      { status: 500 }
    );
  }
}
