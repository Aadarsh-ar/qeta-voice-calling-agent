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

    if (!userMessage && !body.textToSpeak) {
      return NextResponse.json(
        { success: false, error: "User message or textToSpeak is required." },
        { status: 400 }
      );
    }

    const KNOWN_AGENTS: Record<string, { voiceId: string; voiceName: string; defaultName: string }> = {
      "agent_vDCfnuFdJokXJDVxgmHeZx": {
        voiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
        voiceName: "Harika (Telugu Faculty Voice)",
        defaultName: "College Attendance Notification",
      },
    };

    let agent: any = undefined;
    const cleanId = (agentId && typeof agentId === "string") ? agentId.trim() : "";

    if (cleanId) {
      agent = dataStore.getAgent(cleanId);

      if (!agent) {
        try {
          const { prisma } = await import("@/lib/db/prisma");
          const dbAgent = await prisma.agent.findFirst({
            where: {
              OR: [
                { id: cleanId },
                { cartesiaAgentId: cleanId },
              ],
            },
            include: { tools: true, knowledge: true, business: true },
          });

          if (dbAgent) {
            let parsedBizProfile: any = undefined;
            if (dbAgent.businessContext && dbAgent.businessContext.trim().startsWith("{")) {
              try { parsedBizProfile = JSON.parse(dbAgent.businessContext); } catch {}
            }
            const exactInstructions = (dbAgent.instructions || dbAgent.systemPrompt || "").trim();
            const known = KNOWN_AGENTS[dbAgent.id] || KNOWN_AGENTS[dbAgent.cartesiaAgentId || ""];
            const resolvedVoiceId = body.voiceId || body.cartesiaVoiceId || dbAgent.cartesiaVoiceId || known?.voiceId || "41508a7d-4839-445f-ba7f-687f620ed0e7";
            const resolvedVoiceName = "Harika (Telugu Faculty Voice)";

            agent = {
              id: dbAgent.id,
              name: dbAgent.name,
              description: dbAgent.description || "",
              language: dbAgent.language as any,
              status: dbAgent.status as any,
              systemPrompt: exactInstructions,
              instructions: exactInstructions,
              initialMessage: dbAgent.initialMessage || undefined,
              businessContext: dbAgent.businessContext || "",
              businessProfile: parsedBizProfile,
              cartesiaVoiceId: resolvedVoiceId,
              cartesiaVoiceName: resolvedVoiceName,
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
            dataStore.createAgentWithId(agent);
          }
        } catch (e) {
          console.warn("Prisma agent lookup failed in test route:", e);
        }
      }
    }

    // If agent was found, enforce voice binding based on known agent or request
    if (agent) {
      const known = KNOWN_AGENTS[agent.id] || KNOWN_AGENTS[agent.cartesiaAgentId || ""];
      if (body.voiceId || body.cartesiaVoiceId) {
        agent.cartesiaVoiceId = body.voiceId || body.cartesiaVoiceId;
      } else if (known?.voiceId) {
        agent.cartesiaVoiceId = known.voiceId;
      }
      agent.cartesiaVoiceName = "Harika (Telugu Faculty Voice)";
    } else if (cleanId && KNOWN_AGENTS[cleanId]) {
      const known = KNOWN_AGENTS[cleanId];
      agent = {
        id: cleanId,
        name: known.defaultName,
        cartesiaVoiceId: known.voiceId,
        cartesiaVoiceName: known.voiceName,
        cartesiaAgentId: cleanId,
      };
    } else {
      agent = dataStore.getAgents()[0];
    }

    // Determine exact target voice
    const effectiveVoiceId =
      body.voiceId ||
      body.cartesiaVoiceId ||
      agent?.cartesiaVoiceId ||
      "41508a7d-4839-445f-ba7f-687f620ed0e7";

    if (agent) {
      agent.cartesiaVoiceId = effectiveVoiceId;
      agent.cartesiaVoiceName = "Harika (Telugu Faculty Voice)";
    }

    // Quick TTS synthesis without LLM orchestration (for greetings, canned prompts, etc.)
    if (body.ttsOnly) {
      const textToSynthesize = (body.textToSpeak || userMessage || "").trim();
      let audioBase64: string | null = null;
      let audioBytes = 0;
      if (cartesiaClient.isConfigured() && textToSynthesize) {
        try {
          console.log(`[TEST_ROUTE_TTS_ONLY] Synthesizing for "${agent?.name || cleanId}" | Voice: ${effectiveVoiceId} (${effectiveVoiceId === "89907713-42ce-4ddd-8ff5-301211c564c1" ? "Harika" : "AD"})`);
          const audioBuffer = await cartesiaClient.synthesize({
            transcript: textToSynthesize,
            voiceId: effectiveVoiceId,
            modelId: "sonic-3.6",
            encoding: "pcm_s16le",
            sampleRate: 16000,
          });
          if (audioBuffer && audioBuffer.byteLength > 0) {
            audioBase64 = Buffer.from(audioBuffer).toString("base64");
            audioBytes = audioBuffer.byteLength;
          }
        } catch (e: any) {
          console.warn("[TEST_ROUTE] ttsOnly Cartesia error:", e.message);
        }
      }
      return NextResponse.json({
        success: true,
        normalizedReply: textToSynthesize,
        rawReply: textToSynthesize,
        audioBase64,
        audioBytes,
        agentId: agent?.id,
        agentName: agent?.name,
      });
    }

    // Direct instructions override if passed in request body (e.g. testing templates or unsaved site edits)
    const customPrompt = (body.instructions || body.systemPrompt || "").trim();
    if (customPrompt) {
      if (!agent) {
        agent = {
          id: `test_${Date.now()}`,
          name: body.agentName || "Custom Voice Agent",
          description: "Browser Test Agent",
          language: "TELUGU_ENGLISH",
          status: "ACTIVE",
          systemPrompt: customPrompt,
          instructions: customPrompt,
          cartesiaVoiceId: effectiveVoiceId,
          cartesiaVoiceName: effectiveVoiceId === "89907713-42ce-4ddd-8ff5-301211c564c1" ? "Harika (Telugu Faculty Voice)" : "AD (Cloned Telugu Voice)",
          cartesiaModel: "sonic-3.6",
          llmModel: "gemini-2.5-flash",
          sarvamModel: "saaras:v3-realtime",
          sarvamLanguage: "te-IN",
          callsCount: 0,
          totalMinutes: 0,
          estimatedCost: 0,
          lastActive: "Just now",
          createdAt: new Date().toISOString(),
          tools: [],
        };
      } else {
        agent = {
          ...agent,
          systemPrompt: customPrompt,
          instructions: customPrompt,
          cartesiaVoiceId: effectiveVoiceId,
          cartesiaVoiceName: effectiveVoiceId === "89907713-42ce-4ddd-8ff5-301211c564c1" ? "Harika (Telugu Faculty Voice)" : "AD (Cloned Telugu Voice)",
        };
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
        const voiceId = effectiveVoiceId;
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
          console.warn(`[TEST_ROUTE_TTS] Cartesia returned 0 audio bytes, continuing in text fallback mode`);
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[TEST_ROUTE_TTS] Synthesis warning (continuing turn):`, errMsg);
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
      cartesiaVoiceId: effectiveVoiceId,
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
