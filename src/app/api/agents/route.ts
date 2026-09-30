import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { AgentLanguage, AgentStatus } from "@/lib/types/models";
import { syncAgentWithCartesia } from "@/lib/cartesia/sync";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";
import { resolveOrgContext } from "@/lib/auth/orgContext";

export async function GET(req: Request) {
  let dbAgents: any[] = [];
  const activeAgentItems: any[] = [];

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const orgResult = await resolveOrgContext(req);
    let orgFilter: { organizationId?: string } = {};
    if ("error" in orgResult) {
      console.warn(`[AGENTS_GET] Org resolution warning: ${orgResult.error} — using unscoped query (single-org compat)`);
    } else {
      orgFilter = { organizationId: orgResult.organizationId };
    }

    const dbPromise = (async () => {
      try {
        return await prisma.agent.findMany({
          where: orgFilter,
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
            initialMessage: true,
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
      } catch {
        return [];
      }
    })().catch(() => []);

    dbAgents = (await dbPromise) || [];

    for (const dbA of dbAgents) {
      if (dataStore.isAgentDeleted(dbA.id) || (dbA.cartesiaAgentId && dataStore.isAgentDeleted(dbA.cartesiaAgentId))) {
        continue;
      }

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
        instructions: dbA.instructions || dbA.systemPrompt,
        initialMessage: dbA.initialMessage || "",
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
        tools: dbA.tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          isEnabled: t.enabled && t.isEnabled,
        })),
        cartesiaAgentId:
          dbA.id.startsWith("agent_")
            ? dbA.id
            : dbA.cartesiaAgentId && dbA.cartesiaAgentId.startsWith("agent_")
            ? dbA.cartesiaAgentId
            : undefined,
      };

      activeAgentItems.push(agentItem);

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
          enabledTools: agentItem.tools.filter((t: any) => t.isEnabled),
          phoneNumber: agentItem.phoneNumber,
          updatedAt: dbA.updatedAt.toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn("DB query in GET /api/agents fallback:", err);
  }

  // Dynamically sync live Cartesia agents ONLY for agents that exist in DB
  try {
    const cartesiaKey = process.env.CARTESIA_API_KEY || "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
    const cRes = await fetch("https://api.cartesia.ai/agents", {
      headers: {
        "X-API-Key": cartesiaKey,
        "Cartesia-Version": "2025-04-16",
      },
    });
    if (cRes.ok) {
      const cData = await cRes.json();
      const summaries = cData.summaries || cData.data || [];
      for (const ca of summaries) {
        // If agent was explicitly deleted, skip immediately — NEVER recreate
        if (dataStore.isAgentDeleted(ca.id) || (ca.name && dataStore.isAgentDeleted(ca.name))) {
          continue;
        }

        // CRITICAL: Only sync if agent is already registered in DB — never resurrect unmanaged/deleted Cartesia agents
        const existingInDb = dbAgents.some((d: any) => d.id === ca.id || d.cartesiaAgentId === ca.id);
        if (!existingInDb) {
          continue;
        }

        const existing = activeAgentItems.find((a) => a.id === ca.id || a.cartesiaAgentId === ca.id);
        const prompt = ca.llm_system_prompt || ca.llm?.system_prompt || "";
        const intro = ca.llm_introduce || ca.llm?.introduce || "";
        const voiceId = ca.tts_voice || ca.voice?.id || "41508a7d-4839-445f-ba7f-687f620ed0e7";

        if (existing) {
          if (prompt && !existing.instructions) existing.instructions = prompt;
          if (intro && !existing.initialMessage) existing.initialMessage = intro;
          if (voiceId && !existing.cartesiaVoiceId) existing.cartesiaVoiceId = voiceId;
        }
      }
    }
  } catch (cSyncErr) {
    console.warn("[AGENTS_API] Could not sync live Cartesia agents:", cSyncErr);
  }

  // Update in-memory dataStore to strictly match active agents
  dataStore.setAgents(activeAgentItems);

  return NextResponse.json({ success: true, agents: activeAgentItems });
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
        initialMessage: body.initialMessage,
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

    // ── STEP 2: Persist in PostgreSQL (Scoped by organizationId via request context) ──
    const { prisma } = await import("@/lib/db/prisma");
    // ISO-1 fix: use resolveOrgContext instead of findFirst() to correctly scope to calling org
    const orgResult = await resolveOrgContext(req);
    if ("error" in orgResult) {
      return NextResponse.json(
        { success: false, error: `Organization context error: ${orgResult.error}` },
        { status: 400 }
      );
    }
    const orgId = orgResult.organizationId;


    // Assign phone number ONLY if explicitly provided and not already assigned to another agent
    let assignedPhoneNumberId: string | undefined = undefined;
    if (phoneNumber) {
      const phoneRecord = await prisma.phoneNumber.findFirst({
        where: { e164Number: phoneNumber },
        include: { assignedAgent: true },
      });
      if (phoneRecord && !phoneRecord.assignedAgent) {
        assignedPhoneNumberId = phoneRecord.id;
      }
    }

    // Create Business record if provided
    let businessRecord = null;
    if (bizProfile.businessName) {
      businessRecord = await prisma.business.create({
        data: {
          organizationId: orgId,
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
        organizationId: orgId,
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
        phoneNumberId: assignedPhoneNumberId,
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
      phoneNumber: phoneNumber || "+91 80 7158 2667",
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
      organizationId: orgId,
      name: createdAgent.name,
      instructions: agentInstructions,
      businessName: bizProfile.businessName || "QETADOTIN",
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVoiceId: voiceId,
      language: agentLanguage,
      enabledTools: activeToolsList.filter((t: any) => t.isEnabled),
      phoneNumber: phoneNumber || "+91 80 7158 2667",
      updatedAt: createdAgent.updatedAt.toISOString(),
    });

    // Invalidate server.js in-memory greeting and agent metadata cache
    try {
      const port = process.env.PORT || "3000";
      await fetch(`http://127.0.0.1:${port}/api/agent/cache-invalidate?agentId=${encodeURIComponent(createdAgent.id)}`, {
        method: "POST",
      }).catch(() => {});
    } catch {}

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
    const { deleteCartesiaAgent } = await import("@/lib/cartesia/sync");

    // Clean up Cartesia agents
    const currentAgents = dataStore.getAgents();
    for (const a of currentAgents) {
      if (a.cartesiaAgentId) {
        await deleteCartesiaAgent(a.cartesiaAgentId).catch(() => {});
      }
    }

    try {
      await prisma.agent.updateMany({ data: { phoneNumberId: null, businessId: null } });
      await prisma.call.updateMany({ data: { agentId: null } });
      await prisma.campaignLead.deleteMany();
      await prisma.campaign.deleteMany();
      await prisma.agentDeployment.deleteMany();
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
