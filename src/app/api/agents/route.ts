import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { AgentLanguage, AgentStatus } from "@/lib/types/models";
import { syncAgentWithCartesia } from "@/lib/cartesia/sync";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";

export async function GET() {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    const org = await prisma.organization.findFirst({ select: { id: true } });
    const organizationId = org?.id;

    // Use selective query (no SELECT *) scoped by organization
    const dbAgents = await prisma.agent.findMany({
      where: organizationId ? { organizationId } : undefined,
      select: {
        id: true,
        organizationId: true,
        name: true,
        description: true,
        instructions: true,
        systemPrompt: true,
        businessContext: true,
        cartesiaVoiceId: true,
        cartesiaAgentId: true,
        cartesiaModel: true,
        llmModel: true,
        language: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        phoneNumber: { select: { e164Number: true } },
        business: {
          select: {
            name: true,
            description: true,
            information: true,
            operatingHours: true,
            address: true,
            contactInformation: true,
            website: true,
          },
        },
        tools: {
          select: { name: true, description: true, isEnabled: true, enabled: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    for (const dbA of dbAgents) {
      let parsedBizProfile: any = undefined;
      if (dbA.businessContext && dbA.businessContext.trim().startsWith("{")) {
        try {
          parsedBizProfile = JSON.parse(dbA.businessContext);
        } catch {}
      }

      if (!parsedBizProfile && dbA.business) {
        parsedBizProfile = {
          businessName: dbA.business.name,
          description: dbA.business.description || "",
          productsServices: dbA.business.information || "",
          workingHours: dbA.business.operatingHours || "",
          location: dbA.business.address || "",
          contactInfo: dbA.business.contactInformation || "",
          website: dbA.business.website || "",
        };
      }

      const agentItem = {
        id: dbA.id,
        name: dbA.name,
        description: dbA.description || "",
        language: dbA.language as any,
        status: dbA.status as any,
        systemPrompt: dbA.instructions || dbA.systemPrompt,
        businessContext: dbA.businessContext || "",
        businessProfile: parsedBizProfile,
        cartesiaVoiceId: dbA.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
        cartesiaVoiceName: "AD (Cloned Telugu Voice)",
        cartesiaModel: dbA.cartesiaModel,
        llmModel: dbA.llmModel,
        sarvamModel: "saaras:v3-realtime",
        sarvamLanguage: "te-IN",
        phoneNumber: dbA.phoneNumber?.e164Number || "+91 80 7158 2667",
        callsCount: 0,
        totalMinutes: 0,
        estimatedCost: 0,
        lastActive: "Active",
        createdAt: dbA.createdAt.toISOString(),
        tools: dbA.tools.map((t) => ({
          name: t.name,
          description: t.description,
          isEnabled: t.enabled && t.isEnabled,
        })),
        cartesiaAgentId: dbA.cartesiaAgentId || (dbA.id.startsWith("agent_") ? dbA.id : undefined),
      };

      dataStore.createAgentWithId(agentItem);

      // Warm runtime cache
      if (agentItem.cartesiaAgentId) {
        agentRuntimeCache.invalidate(dbA.id, {
          id: dbA.id,
          organizationId: dbA.organizationId,
          name: dbA.name,
          instructions: dbA.instructions || dbA.systemPrompt,
          businessName: parsedBizProfile?.businessName || "QETADOTIN",
          cartesiaAgentId: agentItem.cartesiaAgentId,
          cartesiaVoiceId: agentItem.cartesiaVoiceId,
          language: dbA.language,
          enabledTools: agentItem.tools.filter((t) => t.isEnabled),
          phoneNumber: agentItem.phoneNumber,
          updatedAt: dbA.updatedAt.toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn("DB query in GET /api/agents fallback:", err);
  }

  const agents = dataStore.getAgents();
  return NextResponse.json({ success: true, agents });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      description,
      language,
      systemPrompt,
      instructions,
      businessContext,
      cartesiaVoiceId,
      cartesiaVoiceName,
      cartesiaAgentId,
      phoneNumber,
      tools,
      businessProfile,
    } = body;

    const agentInstructions = (instructions || systemPrompt || "").trim();
    if (!name || !agentInstructions) {
      return NextResponse.json(
        { success: false, error: "Agent name and instructions are required." },
        { status: 400 }
      );
    }

    // Strict Cartesia Agent ID resolution — no random or fake fallbacks
    const targetCartesiaAgentId =
      cartesiaAgentId && cartesiaAgentId.trim().startsWith("agent_")
        ? cartesiaAgentId.trim()
        : body.id && body.id.startsWith("agent_")
        ? body.id
        : undefined;

    const bizProfile = businessProfile || {};
    const voiceId = cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
    const agentLanguage = language || AgentLanguage.TELUGU_ENGLISH;

    // ── STEP 1: Synchronize with Cartesia Official Agent API ──────────────────
    let syncResult;
    try {
      syncResult = await syncAgentWithCartesia({
        cartesiaAgentId: targetCartesiaAgentId,
        agentName: name.trim(),
        instructions: agentInstructions,
        businessName: bizProfile.businessName,
        businessDescription: bizProfile.description,
        businessInformation: bizProfile.productsServices,
        operatingHours: bizProfile.workingHours,
        address: bizProfile.location,
        contactInformation: bizProfile.contactInfo,
        website: bizProfile.website,
        faqs: bizProfile.faqs,
        policies: bizProfile.policies,
        tools: tools || [],
        cartesiaVoiceId: voiceId,
        language: agentLanguage,
      });
    } catch (cartesiaErr: unknown) {
      console.error("[CARTESIA_SYNC_FAILED] Agent creation rejected by Cartesia:", cartesiaErr);
      return NextResponse.json(
        {
          success: false,
          error: `Cartesia synchronization failed: ${cartesiaErr instanceof Error ? cartesiaErr.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    const verifiedCartesiaAgentId = syncResult.cartesiaAgentId;

    // ── STEP 2: Persist in PostgreSQL (Scoped by organizationId) ──────────────
    const { prisma } = await import("@/lib/db/prisma");
    const org = await prisma.organization.findFirst();
    if (!org) {
      return NextResponse.json({ success: false, error: "No organization found" }, { status: 400 });
    }

    // Find phone number record if provided
    const phoneToAssign = phoneNumber || "+91 80 7158 2667";
    const phoneRecord = await prisma.phoneNumber.findFirst({
      where: { e164Number: phoneToAssign },
    });

    // Create Business record if provided
    let businessRecord = null;
    if (bizProfile.businessName) {
      businessRecord = await prisma.business.create({
        data: {
          organizationId: org.id,
          name: bizProfile.businessName,
          description: bizProfile.description || "",
          information: bizProfile.productsServices || "",
          operatingHours: bizProfile.workingHours || "",
          address: bizProfile.location || "",
          contactInformation: bizProfile.contactInfo || "",
          website: bizProfile.website || "",
        },
      });
    }

    const createdAgent = await prisma.agent.create({
      data: {
        organizationId: org.id,
        name: name.trim(),
        description: description || "",
        instructions: agentInstructions,
        systemPrompt: syncResult.instructions,
        cartesiaAgentId: verifiedCartesiaAgentId,
        cartesiaVoiceId: voiceId,
        cartesiaModel: "sonic-3.6",
        llmModel: "gemini-2.5-flash",
        sarvamModel: "saaras:v3-realtime",
        sarvamLanguage: "te-IN",
        language: agentLanguage,
        status: AgentStatus.ACTIVE,
        phoneNumberId: phoneRecord?.id,
        businessId: businessRecord?.id,
        businessContext: JSON.stringify(bizProfile),
        tools: {
          create: (tools || [
            { name: "end_call", description: "End call politely", isEnabled: true },
            { name: "transfer_call", description: "Transfer call to human manager", isEnabled: true },
            { name: "capture_customer_details", description: "Save caller details", isEnabled: true },
          ]).map((t: { name: string; description: string; isEnabled?: boolean; enabled?: boolean }) => ({
            name: t.name,
            description: t.description,
            enabled: t.isEnabled !== false && t.enabled !== false,
            isEnabled: t.isEnabled !== false && t.enabled !== false,
          })),
        },
      },
    });

    // Add Knowledge items (FAQs)
    if (bizProfile.faqs && Array.isArray(bizProfile.faqs)) {
      const knowledgeRows = bizProfile.faqs
        .filter((f: { question: string; answer: string }) => f.question && f.answer)
        .map((f: { question: string; answer: string }) => ({
          agentId: createdAgent.id,
          title: f.question,
          content: f.answer,
          metadata: { type: "faq" },
        }));
      if (knowledgeRows.length > 0) {
        await prisma.agentKnowledge.createMany({ data: knowledgeRows });
      }
    }

    // ── STEP 3: Store in memory store & warm ultra-fast runtime cache ──────────
    const activeToolsList = (tools || []).map((t: any) => ({
      name: t.name,
      description: t.description,
      isEnabled: t.isEnabled !== false && t.enabled !== false,
    }));

    const finalAgent = dataStore.createAgentWithId({
      id: createdAgent.id,
      name: createdAgent.name,
      description: createdAgent.description || "",
      language: createdAgent.language as any,
      status: createdAgent.status as any,
      systemPrompt: syncResult.instructions,
      businessContext: createdAgent.businessContext || "",
      businessProfile: bizProfile,
      cartesiaVoiceId: voiceId,
      cartesiaVoiceName: cartesiaVoiceName || "AD (Cloned Telugu Voice)",
      cartesiaModel: "sonic-3.6",
      llmModel: "gemini-2.5-flash",
      sarvamModel: "saaras:v3-realtime",
      sarvamLanguage: "te-IN",
      phoneNumber: phoneToAssign,
      callsCount: 0,
      totalMinutes: 0,
      estimatedCost: 0,
      lastActive: "Active & Synchronized",
      createdAt: createdAgent.createdAt.toISOString(),
      cartesiaAgentId: verifiedCartesiaAgentId,
      tools: activeToolsList,
    });

    agentRuntimeCache.invalidate(createdAgent.id, {
      id: createdAgent.id,
      organizationId: org.id,
      name: createdAgent.name,
      instructions: agentInstructions,
      businessName: bizProfile.businessName || "QETADOTIN",
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVoiceId: voiceId,
      language: agentLanguage,
      enabledTools: activeToolsList.filter((t: any) => t.isEnabled),
      phoneNumber: phoneToAssign,
      updatedAt: createdAgent.updatedAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      agent: finalAgent,
      synced: true,
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVersionId: syncResult.cartesiaVersionId,
      updatedAt: syncResult.updatedAt,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const { prisma } = await import("@/lib/db/prisma");
    try {
      await prisma.agentKnowledge.deleteMany();
      await prisma.agentTool.deleteMany();
      await prisma.agent.deleteMany();
    } catch (dbErr) {
      console.warn("DB agent deletion warning:", dbErr);
    }
    dataStore.clearAllAgents();
    agentRuntimeCache.clear();
    return NextResponse.json({ success: true, message: "All agents removed", agents: [] });
  } catch (err: unknown) {
    dataStore.clearAllAgents();
    agentRuntimeCache.clear();
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
