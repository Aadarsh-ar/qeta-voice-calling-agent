import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { AgentLanguage, AgentStatus } from "@/lib/types/models";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";
import { resolveOrgContext } from "@/lib/auth/orgContext";
import { isValidVoiceId, DEFAULT_VOICE_ID, AVAILABLE_VOICES, getVoiceName } from "@/lib/config/voices";
import { compileAgentInstructions, compileAgentGreeting } from "@/lib/agent/promptCompiler";
import { createAgentVersion } from "@/lib/agent/versionService";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  let dbAgents: any[] = [];
  const activeAgentItems: any[] = [];

  try {
    const orgResult = await resolveOrgContext(req);
    let orgFilter: { organizationId?: string } = {};
    if ("error" in orgResult) {
      console.warn(`[AGENTS_GET] Org resolution warning: ${orgResult.error} — using unscoped query (single-org compat)`);
    } else {
      orgFilter = { organizationId: orgResult.organizationId };
    }

    dbAgents = await prisma.agent.findMany({
      where: orgFilter,
      select: {
        id: true,
        organizationId: true,
        name: true,
        description: true,
        instructions: true,
        systemPrompt: true,
        businessContext: true,
        voiceId: true,
        cartesiaVoiceId: true,
        cartesiaAgentId: true,
        cartesiaModel: true,
        ttsModel: true,
        llmModel: true,
        llmProvider: true,
        language: true,
        status: true,
        initialMessage: true,
        currentVersionNum: true,
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

      const effectiveVoiceId = dbA.voiceId || dbA.cartesiaVoiceId || DEFAULT_VOICE_ID;

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
        cartesiaVoiceId: effectiveVoiceId,
        cartesiaVoiceName: getVoiceName(effectiveVoiceId),
        cartesiaModel: dbA.ttsModel || dbA.cartesiaModel || "sonic-3.6",
        llmModel: dbA.llmModel || "gemini-2.5-flash",
        sarvamModel: "saaras:v3-realtime",
        sarvamLanguage: "te-IN",
        phoneNumber: dbA.phoneNumber?.e164Number || "+91 80 7158 2667",
        callsCount: 0,
        totalMinutes: 0,
        estimatedCost: 0,
        lastActive: "Active (DB Authoritative)",
        createdAt: dbA.createdAt.toISOString(),
        currentVersionNum: dbA.currentVersionNum || 1,
        tools: dbA.tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          isEnabled: t.enabled && t.isEnabled,
        })),
        cartesiaAgentId: dbA.cartesiaAgentId || undefined,
      };

      activeAgentItems.push(agentItem);

      // Warm runtime cache
      agentRuntimeCache.invalidate(dbA.id, {
        id: dbA.id,
        organizationId: dbA.organizationId,
        name: dbA.name,
        instructions: dbA.instructions || dbA.systemPrompt,
        businessName: parsedBizProfile?.businessName || "QETADOTIN",
        cartesiaAgentId: agentItem.cartesiaAgentId,
        cartesiaVoiceId: effectiveVoiceId,
        language: dbA.language,
        enabledTools: agentItem.tools.filter((t: any) => t.isEnabled),
        phoneNumber: agentItem.phoneNumber,
        updatedAt: dbA.updatedAt.toISOString(),
      });
    }
  } catch (err) {
    console.warn("DB query in GET /api/agents:", err);
  }

  // Update in-memory dataStore to strictly match DB active agents
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
      initialMessage,
      customGreeting,
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

    const bizProfile = businessProfile || {};
    let voiceId = (cartesiaVoiceId || "").trim();
    if (voiceId) {
      if (!isValidVoiceId(voiceId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid cartesiaVoiceId "${voiceId}". Must be one of the 4 configured Cartesia voices: ${AVAILABLE_VOICES.map((v) => `${v.name} (${v.id})`).join(", ")}`,
          },
          { status: 400 }
        );
      }
    } else {
      voiceId = DEFAULT_VOICE_ID;
    }
    const agentLanguage = language || AgentLanguage.TELUGU_ENGLISH;

    // Resolve organization context
    const orgResult = await resolveOrgContext(req);
    if ("error" in orgResult) {
      return NextResponse.json(
        { success: false, error: `Organization context error: ${orgResult.error}` },
        { status: 400 }
      );
    }
    const orgId = orgResult.organizationId;

    // Compile instructions and greeting locally (zero external latency)
    const compiledInstructions = compileAgentInstructions({
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
      language: agentLanguage,
    });

    const compiledGreeting = compileAgentGreeting({
      agentName: name.trim(),
      businessName: bizProfile.businessName,
      customGreeting: customGreeting || initialMessage || body.initialMessage,
      language: agentLanguage,
    });

    // Assign phone number if available
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

    // Save directly to PostgreSQL (single source of truth)
    const createdAgent = await prisma.agent.create({
      data: {
        organizationId: orgId,
        name: name.trim(),
        description: description || "",
        instructions: agentInstructions,
        systemPrompt: compiledInstructions,
        initialMessage: compiledGreeting,
        voiceId,
        cartesiaVoiceId: voiceId,
        cartesiaAgentId: cartesiaAgentId || null,
        cartesiaModel: "sonic-3.6",
        ttsModel: "sonic-3.6",
        llmModel: "gemini-2.5-flash",
        llmProvider: "groq",
        sttProvider: "deepgram",
        sttModel: "nova-3",
        language: agentLanguage,
        status: AgentStatus.ACTIVE,
        phoneNumberId: assignedPhoneNumberId,
        businessId: businessRecord?.id,
        businessContext: JSON.stringify(bizProfile),
        currentVersionNum: 1,
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

    // Create immutable v1 version snapshot
    await createAgentVersion(createdAgent.id).catch((verErr) => {
      console.warn("[AGENT_VERSION] Warning creating initial version:", verErr);
    });

    // Store in memory store & warm runtime cache
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
      systemPrompt: compiledInstructions,
      instructions: agentInstructions,
      initialMessage: compiledGreeting,
      businessContext: createdAgent.businessContext || "",
      businessProfile: bizProfile,
      cartesiaVoiceId: voiceId,
      cartesiaVoiceName: cartesiaVoiceName || getVoiceName(voiceId),
      cartesiaModel: "sonic-3.6",
      llmModel: "gemini-2.5-flash",
      sarvamModel: "saaras:v3-realtime",
      sarvamLanguage: "te-IN",
      phoneNumber: phoneNumber || "+91 80 7158 2667",
      callsCount: 0,
      totalMinutes: 0,
      estimatedCost: 0,
      lastActive: "Active (DB Authoritative)",
      createdAt: createdAgent.createdAt.toISOString(),
      cartesiaAgentId: createdAgent.cartesiaAgentId || undefined,
      tools: activeToolsList,
    });

    agentRuntimeCache.invalidate(createdAgent.id, {
      id: createdAgent.id,
      organizationId: orgId,
      name: createdAgent.name,
      instructions: compiledInstructions,
      businessName: bizProfile.businessName || "QETADOTIN",
      cartesiaAgentId: createdAgent.cartesiaAgentId || undefined,
      cartesiaVoiceId: voiceId,
      language: agentLanguage,
      enabledTools: activeToolsList.filter((t: any) => t.isEnabled),
      phoneNumber: phoneNumber || "+91 80 7158 2667",
      updatedAt: createdAgent.updatedAt.toISOString(),
    });

    // Invalidate server.js in-memory cache if running
    try {
      const port = process.env.PORT || "3000";
      await fetch(`http://127.0.0.1:${port}/api/agent/cache-invalidate?agentId=${encodeURIComponent(createdAgent.id)}`, {
        method: "POST",
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      agent: finalAgent,
      version: 1,
      synced: true,
      updatedAt: createdAgent.updatedAt.toISOString(),
    });
  } catch (err: unknown) {
    console.error("[AGENTS_POST_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error creating agent" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    try {
      await prisma.agent.updateMany({ data: { phoneNumberId: null, businessId: null } });
      await prisma.call.updateMany({ data: { agentId: null } });
      await prisma.campaignLead.deleteMany();
      await prisma.campaign.deleteMany();
      await prisma.agentVersion.deleteMany();
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
