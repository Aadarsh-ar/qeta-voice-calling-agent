import { NextResponse } from "next/server";
import { agentOrchestrator } from "@/lib/agent/orchestrator";
import { dataStore, AgentItem } from "@/lib/db/store";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      agentId,
      userUtterance,
      conversationHistory = [],
      customerPhone,
      customerName,
      action,
    } = body;

    // 1. Resolve agent from dataStore or Neon PostgreSQL
    let agent: AgentItem | undefined = agentId
      ? dataStore.getAgent(agentId)
      : dataStore.getAgents()[0];

    if (!agent && agentId) {
      try {
        let dbAgent = await prisma.agent.findUnique({
          where: { id: agentId },
          include: { tools: true },
        });
        if (!dbAgent) {
          dbAgent = await prisma.agent.findFirst({
            where: { status: "ACTIVE" },
            include: { tools: true },
          }) || await prisma.agent.findFirst({
            include: { tools: true },
          });
        }
        if (dbAgent) {
          let parsedBizProfile: any = undefined;
          if (dbAgent.businessContext && dbAgent.businessContext.trim().startsWith("{")) {
            try {
              parsedBizProfile = JSON.parse(dbAgent.businessContext);
            } catch {}
          }

          agent = {
            id: dbAgent.id,
            name: dbAgent.name,
            description: dbAgent.description || "",
            language: dbAgent.language as any,
            status: dbAgent.status as any,
            systemPrompt: dbAgent.systemPrompt,
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
              isEnabled: t.isEnabled,
            })),
          };
          dataStore.createAgentWithId(agent);
        }
      } catch {
        // Fallback to default agent
      }
    }

    if (!agent) {
      agent = dataStore.getAgents()[0];
    }

    // 2. Action: Greeting request on call start - Grounded in Agent's Saved Instructions
    if (action === "greeting") {
      const bizName = agent?.businessProfile?.businessName || "QETADOTIN";
      let greeting = "";

      // Generate instruction-grounded greeting via Groq
      const groqKey = process.env.GROQ_API_KEY || "";
      if (groqKey && agent?.systemPrompt) {
        try {
          const greetPrompt = `You are ${agent.name}, representing ${bizName}.
Agent instructions:
${agent.systemPrompt}

Task: Generate the exact opening greeting (strictly 1 short natural sentence, max 15 words) for this live phone call.
Rules:
- If the instructions specify an opening phrase or greeting, speak that exact opening.
- Otherwise, greet warmly in ${agent.language === "ENGLISH" ? "English" : "Telugu / Tenglish"} introducing yourself as ${agent.name}.
- Keep it under 15 words.
- Return ONLY the spoken greeting sentence. No quotes, no markdown.`;

          const gRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: process.env.GROQ_MODEL || "qwen/qwen3.8-27b",
              messages: [{ role: "user", content: greetPrompt }],
              temperature: 0.2,
              max_tokens: 60,
            }),
          });

          if (gRes.ok) {
            const gData = await gRes.json();
            const text = (gData.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
            if (text.length > 5) {
              greeting = text;
            }
          }
        } catch (err) {
          console.warn("[GREETING_LLM_WARN] Fallback to template greeting:", err);
        }
      }

      if (!greeting) {
        if (agent?.language === "ENGLISH") {
          greeting = `Hello! I am ${agent?.name || "Adarsh"} from ${bizName}. How can I help you today?`;
        } else {
          greeting = `నమస్కారం అండి! నేను ${agent?.name || "ఆదర్శ్"}, ${bizName} నుండి మాట్లాడుతున్నాను. నేను మీకు ఎలా సహాయపడగలను?`;
        }
      }

      return NextResponse.json({
        success: true,
        agent: {
          id: agent?.id,
          name: agent?.name,
          voiceId: agent?.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
          language: agent?.language,
          businessName: bizName,
          systemPrompt: agent?.systemPrompt,
        },
        greeting,
      });
    }

    // 3. Process turn with full RAG knowledge, instruction hierarchy, tools, and quality validation
    if (!userUtterance) {
      return NextResponse.json(
        { success: false, error: "userUtterance is required" },
        { status: 400 }
      );
    }

    const turnResult = await agentOrchestrator.generateTurn(
      agent,
      conversationHistory,
      userUtterance,
      {
        agent,
        customerName: customerName || "కస్టమర్ (Caller)",
        customerPhone: customerPhone || "+916305367443",
      }
    );

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        voiceId: agent.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
        language: agent.language,
      },
      rawReply: turnResult.rawText,
      normalizedReply: turnResult.normalizedText,
      retrievedSnippets: turnResult.retrievedSnippets || [],
      toolCalls: turnResult.toolCalls || [],
      qualityValidation: turnResult.qualityValidation,
      shouldEndCall: turnResult.shouldEndCall,
      shouldTransfer: turnResult.shouldTransfer,
      llmLatencyMs: turnResult.llmLatencyMs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Turn processing error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
