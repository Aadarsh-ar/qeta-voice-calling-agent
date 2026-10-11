import { NextResponse } from "next/server";
import { agentOrchestrator } from "@/lib/agent/orchestrator";
import { cartesiaClient } from "@/lib/cartesia/client";
import { dataStore } from "@/lib/db/store";
import { DEFAULT_VOICE_ID, getVoiceName, isValidVoiceId } from "@/lib/config/voices";

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

    const KNOWN_AGENTS: Record<string, { voiceId: string; voiceName: string; defaultName: string; instructions?: string }> = {
      "agent_vDCfnuFdJokXJDVxgmHeZx": {
        voiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
        voiceName: "Harika (Telugu Faculty Voice)",
        defaultName: "College Attendance Notification",
      },
      "agent_WzcEn6kkRmPxAfBNHzvpa1": {
        voiceId: "480e1f44-cdab-4777-851a-236e06b04672",
        voiceName: "Priya (Telugu Conversational Voice)",
        defaultName: "Priya (AI Voice Assistant · qetadotin)",
        instructions: `# గుర్తింపు & పాత్ర
నువ్వు ప్రియ (Priya), qetadotin యొక్క అధికారిక AI Voice Assistant.
qetadotin అనేది businesses కోసం AI Voice Agents తయారు చేసే ఒక అడ్వాన్స్‌డ్ SaaS ప్లాట్‌ఫామ్. ఇవి customersతో సహజమైన phone conversations మాట్లాడటం, enquiries handle చేయటం, questionsకి సమాధానం ఇవ్వటం, leads qualify చేయటం, మరియు repetitive business phone calls automate చేయటంలో సహాయపడతాయి.
నువ్వు qetadotin యొక్క LIVE PRODUCT DEMO ASSISTANT.
visitor నీతో మాట్లాడుతున్నప్పుడే qetadotin AI Voice Agent ఎంత సహజంగా, fastగా, intelligentగా conversation చేయగలదో వాళ్లకు experience చేయించాలి.

# ప్రారంభ స్వాగతం
Call ప్రారంభమైనప్పుడు సహజంగా ఇలా చెప్పు:
"హలో అండి! నేను ప్రియ, qetadotin యొక్క AI Voice Assistant ని. నాతో మాట్లాడండి — qetadotin ఎలా పనిచేస్తుందో మీరే experience చేయొచ్చు. మీకు ఎలా సహాయం చేయగలను?"
Visitor Englishలో మాట్లాడితే natural Englishలో respond అవ్వాలి.
Visitor Teluguలో మాట్లాడితే natural Telugu లేదా Tenglishలో respond అవ్వాలి.
Visitor Telugu మరియు English mix చేస్తే natural Tenglishలో మాట్లాడవచ్చు.

# మాట్లాడే విధానం
ప్రతి response సాధారణంగా 1 లేదా 2 వాక్యాలు మాత్రమే ఉండాలి.
చాలా సహజంగా, కాన్ఫిడెంట్ గా, స్నేహపూర్వకంగా మరియు professionalగా మాట్లాడాలి.
Robot లాగా అస్సలు మాట్లాడకూడదు.
Customer-support bot లాగా repetitiveగా ఉండకూడదు.
ప్రతి responseలో "How can I help you?" అని అడగకూడదు.
Unnecessary filler words ("That's a great question", "Certainly") ఎక్కువగా ఉపయోగించకూడదు.
Visitor అడిగిన ప్రశ్నకు directగా, వేగంగా answer ఇవ్వాలి.
Visitor మాట్లాడినప్పుడు natural pauses ఇవ్వాలి. Markdown syntax, bullet points, asterisks వాడకూడదు.

# qetadotin గురించి
Visitor "qetadotin అంటే ఏమిటి?" అని అడిగితే:
"qetadotin అనేది businesses కోసం AI Voice Agents build చేసే cutting-edge SaaS ప్లాట్‌ఫామ్. ఇవి customersతో phoneలో సహజంగా మాట్లాడి business calls automate చేయగలవు. మీ business ఏ రకమైనది?"

# నేను ఏమి చేయగలను?
Visitor "నువ్వు ఏం చేయగలవు?" అని అడిగితే:
"నేను customersతో సహజంగా మాట్లాడగలను, questionsకి answer చేయగలను, enquiries handle చేయగలను, అవసరమైన information collect చేయగలను. మీరు కావాలంటే ఇప్పుడే ఒక business scenario try చేద్దాం."

# LIVE DEMO MODE
Visitor demo చేయాలనుకుంటే:
"ఖచ్చితంగా! మీరు customerలా మాట్లాడండి, నేను మీ business voice agentలా respond అవుతాను."
Visitor ఏదైనా business scenario చెబితే, ఆ scenarioకి అనుగుణంగా naturalగా role-play చేయాలి.

# Telugu Voice Style
Telugu చాలా సహజంగా, conversational శైలిలో మాట్లాడాలి. గ్రాంథిక తెలుగు వాడకూడదు. సాధారణంగా ప్రజలు మాట్లాడే Telugu-English blend ఉపయోగించాలి.

# Human లేదా AI?
Visitor "నువ్వు మనిషివా?" అని అడిగితే:
"కాదు, నేను ప్రియ — qetadotin యొక్క AI Voice Assistant ని! కానీ మీతో human-like గా natural conversation చేయడానికి design చేశారు."

# Pricing గురించి
Visitor pricing అడిగితే:
"qetadotin pricing మీ usage మరియు requirements మీద ఆధారపడి ఉంటుంది. Starter plans నెలకు ₹15,000 నుండి ప్రారంభమవుతాయి. మరిన్ని వివరాలు మా sales team తో మాట్లాడవచ్చు."

# ముఖ్యమైన నియమం
చిన్న responses (1-2 sentences). Natural Telugu & Tenglish. Fast response. స్పష్టమైన ఉచ్చారణ. No markdown syntax.`,
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
            const resolvedVoiceId = body.voiceId || body.cartesiaVoiceId || dbAgent.cartesiaVoiceId || known?.voiceId || DEFAULT_VOICE_ID;
            const resolvedVoiceName = getVoiceName(resolvedVoiceId);

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
              cartesiaModel: dbAgent.cartesiaModel || "sonic-3.6",
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

    // Determine target voice ID
    const currentKnown = cleanId ? KNOWN_AGENTS[cleanId] : undefined;
    const requestedVoiceId = body.voiceId || body.cartesiaVoiceId;
    let effectiveVoiceId = requestedVoiceId || agent?.cartesiaVoiceId || currentKnown?.voiceId || DEFAULT_VOICE_ID;

    if (!isValidVoiceId(effectiveVoiceId)) {
      effectiveVoiceId = DEFAULT_VOICE_ID;
    }

    const effectiveVoiceName = getVoiceName(effectiveVoiceId);

    // If agent was found, enforce voice binding
    if (agent) {
      agent.cartesiaVoiceId = effectiveVoiceId;
      agent.cartesiaVoiceName = effectiveVoiceName;
      if (currentKnown?.instructions) {
        agent.systemPrompt = currentKnown.instructions;
        agent.instructions = currentKnown.instructions;
      }
    } else if (cleanId && currentKnown) {
      agent = {
        id: cleanId,
        name: currentKnown.defaultName,
        cartesiaVoiceId: effectiveVoiceId,
        cartesiaVoiceName: effectiveVoiceName,
        cartesiaAgentId: cleanId,
        systemPrompt: currentKnown.instructions || "",
        instructions: currentKnown.instructions || "",
      };
    } else {
      agent = dataStore.getAgents()[0] || {
        id: "priya_default",
        name: "Priya (AI Voice Assistant · qetadotin)",
        cartesiaVoiceId: effectiveVoiceId,
        cartesiaVoiceName: effectiveVoiceName,
        systemPrompt: KNOWN_AGENTS["agent_WzcEn6kkRmPxAfBNHzvpa1"].instructions,
        instructions: KNOWN_AGENTS["agent_WzcEn6kkRmPxAfBNHzvpa1"].instructions,
      };
    }

    // Quick TTS synthesis without LLM orchestration (for greetings, canned prompts, previews)
    if (body.ttsOnly) {
      const textToSynthesize = (body.textToSpeak || userMessage || "").trim();
      let audioBase64: string | null = null;
      let audioBytes = 0;
      let ttsError: string | null = null;

      if (cartesiaClient.isConfigured() && textToSynthesize) {
        try {
          console.log(`[TEST_ROUTE_TTS_ONLY] Synthesizing speech for "${agent?.name || cleanId}" | Voice: ${effectiveVoiceId} (${effectiveVoiceName})`);
          const audioBuffer = await cartesiaClient.synthesize({
            transcript: textToSynthesize,
            voiceId: effectiveVoiceId,
            modelId: "sonic-3.6",
            container: "wav",
            encoding: "pcm_s16le",
            sampleRate: 16000,
          });
          if (audioBuffer && audioBuffer.byteLength > 0) {
            audioBase64 = Buffer.from(audioBuffer).toString("base64");
            audioBytes = audioBuffer.byteLength;
          }
        } catch (e: any) {
          ttsError = e?.message || String(e);
          console.warn("[TEST_ROUTE] ttsOnly Cartesia error:", ttsError);
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
        cartesiaVoiceId: effectiveVoiceId,
        cartesiaVoiceName: effectiveVoiceName,
        sampleRate: 16000,
        ttsError,
      });
    }

    // Direct instructions override if passed in request body
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
          cartesiaVoiceName: effectiveVoiceName,
          cartesiaModel: "sonic-3.6",
          llmModel: "qwen/qwen3.8-27b",
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
          cartesiaVoiceName: effectiveVoiceName,
        };
      }
    }

    const sttLatencyMs = simulatedSttLatency || 195;

    // Run LLM Orchestration with complete agent context, RAG and tools
    const turnResult = await agentOrchestrator.generateTurn(
      agent || "మీరు qetadotin AI వాయిస్ అసిస్టెంట్. 1-2 వాక్యాలలో సహజమైన తెలుగు లేదా టెంగ్లీష్ లో సమాధానం ఇవ్వండి.",
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
    let ttsError: string | null = null;

    if (cartesiaClient.isConfigured()) {
      const ttsStart = Date.now();
      try {
        const textToSynthesize = turnResult.normalizedText || turnResult.rawText || "నమస్కారం అండి, మీకు ఎలా సహాయం చేయగలను?";
        
        console.log(`[TEST_ROUTE_TTS] Synthesizing speech for agent "${agent?.name || agentId}" | Voice: ${effectiveVoiceId} (${effectiveVoiceName}) | Text: "${textToSynthesize.slice(0, 60)}..."`);
        
        const audioBuffer = await cartesiaClient.synthesize({
          transcript: textToSynthesize,
          voiceId: effectiveVoiceId,
          modelId: "sonic-3.6",
          container: "wav",
          encoding: "pcm_s16le",
          sampleRate: 16000,
        });
        ttsLatencyMs = Date.now() - ttsStart;
        audioBytes = audioBuffer ? audioBuffer.byteLength : 0;

        if (audioBytes > 0) {
          audioBase64 = Buffer.from(audioBuffer).toString("base64");
          console.log(`[TEST_ROUTE_TTS] Success: ${audioBytes} audio bytes generated in ${ttsLatencyMs}ms`);
        } else {
          console.warn(`[TEST_ROUTE_TTS] Cartesia returned 0 audio bytes`);
        }
      } catch (err: unknown) {
        ttsError = err instanceof Error ? err.message : String(err);
        console.warn(`[TEST_ROUTE_TTS] Synthesis warning:`, ttsError);
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
      cartesiaVoiceName: effectiveVoiceName,
      audioBase64,
      audioBytes,
      ttsError,
      audioFormat: "audio/wav",
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
