import { NextResponse } from "next/server";
import { campaignManager } from "@/lib/campaigns/campaignManager";
import { dataStore } from "@/lib/db/store";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_VOICE_ID, getVoiceName } from "@/lib/config/voices";

export async function GET() {
  try {
    const rawCampaigns = campaignManager.getCampaigns();
    // Memory and payload optimization for 1K+ contacts:
    // Strip heavy transcripts from list view so polling is instant
    const campaigns = rawCampaigns.map((c) => ({
      ...c,
      contacts: c.contacts.slice(0, 10).map((cnt) => ({
        ...cnt,
        transcripts: undefined,
      })),
      totalContactsCount: c.contacts.length,
    }));
    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { name, description, agentId, concurrency, maxRetries, retryDelaySeconds, callDelaySeconds, contacts } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Campaign name is required." },
        { status: 400 }
      );
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one valid contact is required to create a campaign." },
        { status: 400 }
      );
    }

    // Resolve agent: if not in in-memory dataStore, fetch from Postgres DB
    let targetAgentId = agentId;
    if (!dataStore.getAgent(targetAgentId)) {
      try {
        const dbA = await prisma.agent.findFirst({
          where: targetAgentId
            ? { OR: [{ id: targetAgentId }, { cartesiaAgentId: targetAgentId }] }
            : { status: "ACTIVE" },
          include: { business: true, tools: true },
          orderBy: { createdAt: "desc" },
        });

        if (dbA) {
          const effectiveVoiceId = dbA.voiceId || dbA.cartesiaVoiceId || DEFAULT_VOICE_ID;
          dataStore.createAgentWithId({
            id: dbA.id,
            name: dbA.name,
            description: dbA.description || "",
            language: dbA.language as any,
            status: dbA.status as any,
            systemPrompt: dbA.instructions || dbA.systemPrompt,
            instructions: dbA.instructions || dbA.systemPrompt,
            initialMessage: dbA.initialMessage || "",
            businessContext: dbA.businessContext || "",
            cartesiaVoiceId: effectiveVoiceId,
            cartesiaVoiceName: getVoiceName(effectiveVoiceId),
            cartesiaModel: dbA.ttsModel || dbA.cartesiaModel || "sonic-3.6",
            llmModel: dbA.llmModel || "gemini-2.5-flash",
            sarvamModel: "saaras:v3-realtime",
            sarvamLanguage: "te-IN",
            phoneNumber: "+91 80 7158 2667",
            callsCount: 0,
            totalMinutes: 0,
            estimatedCost: 0,
            lastActive: "Active (DB Authoritative)",
            createdAt: dbA.createdAt.toISOString(),
            tools: dbA.tools.map((t: any) => ({
              name: t.name,
              description: t.description,
              isEnabled: t.enabled && t.isEnabled,
            })),
            cartesiaAgentId: dbA.cartesiaAgentId || undefined,
          });
          targetAgentId = dbA.id;
        }
      } catch (dbErr) {
        console.warn("[CAMPAIGNS_POST] Agent DB lookup error:", dbErr);
      }
    }

    const campaign = campaignManager.createCampaign({
      name,
      description,
      agentId: targetAgentId,
      concurrency: Number(concurrency) || 2,
      maxRetries: Number(maxRetries) ?? 2,
      retryDelaySeconds: Number(retryDelaySeconds) || 30,
      callDelaySeconds: Number(callDelaySeconds) || 2,
      contacts,
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}
