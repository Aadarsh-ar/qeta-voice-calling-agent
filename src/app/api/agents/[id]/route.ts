import { NextResponse } from "next/server";
import { dataStore, AgentItem } from "@/lib/db/store";
import { prisma } from "@/lib/db/prisma";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";
import { isValidVoiceId, DEFAULT_VOICE_ID, AVAILABLE_VOICES, getVoiceName } from "@/lib/config/voices";
import { compileAgentInstructions, compileAgentGreeting } from "@/lib/agent/promptCompiler";
import { createAgentVersion } from "@/lib/agent/versionService";
import { resolveOrgContext } from "@/lib/auth/orgContext";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let dbAgent: any = null;
  try {
    dbAgent = await prisma.agent.findFirst({
      where: {
        OR: [
          { id },
          { cartesiaAgentId: id },
        ],
      },
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
        knowledge: {
          select: { title: true, content: true },
        },
      },
    });
  } catch (err) {
    console.warn("DB agent retrieval exception in GET /api/agents/[id]:", err);
  }

  if (dataStore.isAgentDeleted(id)) {
    return NextResponse.json({ success: false, error: "Agent has been permanently deleted" }, { status: 404 });
  }

  const existingStoreAgent = dataStore.getAgent(id);

  if (!dbAgent && !existingStoreAgent) {
    return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
  }

  let parsedBizProfile: any = undefined;
  if (dbAgent?.businessContext && dbAgent.businessContext.trim().startsWith("{")) {
    try {
      parsedBizProfile = JSON.parse(dbAgent.businessContext);
    } catch {}
  }

  if (!parsedBizProfile && dbAgent?.business) {
    parsedBizProfile = {
      businessName: dbAgent.business.name,
      description: dbAgent.business.description || "",
      productsServices: dbAgent.business.information || "",
      workingHours: dbAgent.business.operatingHours || "",
      location: dbAgent.business.address || "",
      contactInfo: dbAgent.business.contactInformation || "",
      website: dbAgent.business.website || "",
      faqs: (dbAgent.knowledge || []).map((k: any) => ({ question: k.title, answer: k.content })),
    };
  }

  const agentIdResolved = dbAgent?.id || id;
  const effectiveVoiceId = dbAgent?.voiceId || dbAgent?.cartesiaVoiceId || existingStoreAgent?.cartesiaVoiceId || DEFAULT_VOICE_ID;
  const liveInstructions = dbAgent?.instructions || dbAgent?.systemPrompt || existingStoreAgent?.instructions || existingStoreAgent?.systemPrompt || "";
  const liveGreeting = dbAgent?.initialMessage || existingStoreAgent?.initialMessage || "";

  const agentItem: AgentItem = {
    id: agentIdResolved,
    name: dbAgent?.name || existingStoreAgent?.name || "Agent",
    description: dbAgent?.description || existingStoreAgent?.description || "",
    language: (dbAgent?.language || existingStoreAgent?.language || "TELUGU_ENGLISH") as any,
    status: (dbAgent?.status || existingStoreAgent?.status || "ACTIVE") as any,
    systemPrompt: liveInstructions,
    instructions: liveInstructions,
    initialMessage: liveGreeting,
    businessContext: dbAgent?.businessContext || existingStoreAgent?.businessContext || "",
    businessProfile: parsedBizProfile || existingStoreAgent?.businessProfile,
    cartesiaVoiceId: effectiveVoiceId,
    cartesiaVoiceName: getVoiceName(effectiveVoiceId),
    cartesiaModel: dbAgent?.ttsModel || dbAgent?.cartesiaModel || "sonic-3.6",
    llmModel: dbAgent?.llmModel || "gemini-2.5-flash",
    sarvamModel: "saaras:v3-realtime",
    sarvamLanguage: "te-IN",
    phoneNumber: dbAgent?.phoneNumber?.e164Number || existingStoreAgent?.phoneNumber || "+91 80 7158 2667",
    callsCount: existingStoreAgent?.callsCount || 0,
    totalMinutes: existingStoreAgent?.totalMinutes || 0,
    estimatedCost: existingStoreAgent?.estimatedCost || 0,
    lastActive: "Active (DB Authoritative)",
    createdAt: dbAgent?.createdAt?.toISOString() || existingStoreAgent?.createdAt || new Date().toISOString(),
    tools: dbAgent?.tools
      ? dbAgent.tools.map((t: any) => ({ name: t.name, description: t.description, isEnabled: t.enabled && t.isEnabled }))
      : existingStoreAgent?.tools || [],
    cartesiaAgentId: dbAgent?.cartesiaAgentId || existingStoreAgent?.cartesiaAgentId || undefined,
  };

  dataStore.createAgentWithId(agentItem);

  return NextResponse.json({
    success: true,
    agent: agentItem,
    version: dbAgent?.currentVersionNum || 1,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const currentAgent = dataStore.getAgent(id);

    // Look up in DB
    const dbAgent = await prisma.agent.findFirst({
      where: {
        OR: [{ id }, { cartesiaAgentId: id }],
      },
      include: {
        business: true,
        tools: true,
        knowledge: true,
      },
    });

    if (!dbAgent && !currentAgent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const orgResult = await resolveOrgContext(req);
    if (!("error" in orgResult) && dbAgent?.organizationId && dbAgent.organizationId !== orgResult.organizationId) {
      return NextResponse.json({ success: false, error: "Unauthorized: Access denied for this organization" }, { status: 403 });
    }

    const resolvedId = dbAgent?.id || id;
    const agentName = body.name || dbAgent?.name || currentAgent?.name || "Agent";
    const agentInstructions = (body.instructions || body.systemPrompt || dbAgent?.instructions || dbAgent?.systemPrompt || "").trim();

    if (!agentName) {
      return NextResponse.json({ success: false, error: "Agent name cannot be empty." }, { status: 400 });
    }

    let voiceId = (body.cartesiaVoiceId || dbAgent?.voiceId || dbAgent?.cartesiaVoiceId || currentAgent?.cartesiaVoiceId || DEFAULT_VOICE_ID).trim();
    if (!isValidVoiceId(voiceId)) {
      voiceId = DEFAULT_VOICE_ID;
    }

    const language = body.language || dbAgent?.language || currentAgent?.language || "TELUGU_ENGLISH";
    const bizProfile = body.businessProfile || (dbAgent?.businessContext && dbAgent.businessContext.trim().startsWith("{") ? JSON.parse(dbAgent.businessContext) : {});

    // Compile dynamic instructions and greeting locally
    const compiledInstructions = compileAgentInstructions({
      agentName,
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
      tools: body.tools || dbAgent?.tools || [],
      language,
    });

    const compiledGreeting = compileAgentGreeting({
      agentName,
      businessName: bizProfile.businessName,
      customGreeting: body.customGreeting || body.initialMessage,
      language,
    });

    // ── Update PostgreSQL (Single source of truth) ───────────────────────────
    let businessRecord = null;
    if (bizProfile.businessName && dbAgent?.organizationId) {
      if (dbAgent.businessId) {
        businessRecord = await prisma.business.update({
          where: { id: dbAgent.businessId },
          data: {
            name: bizProfile.businessName,
            description: bizProfile.description || "",
            information: bizProfile.productsServices || "",
            operatingHours: bizProfile.workingHours || "",
            address: bizProfile.location || "",
            contactInformation: bizProfile.contactInfo || "",
            website: bizProfile.website || "",
          },
        }).catch(() => null);
      } else {
        businessRecord = await prisma.business.create({
          data: {
            organizationId: dbAgent.organizationId,
            name: bizProfile.businessName,
            description: bizProfile.description || "",
            information: bizProfile.productsServices || "",
            operatingHours: bizProfile.workingHours || "",
            address: bizProfile.location || "",
            contactInformation: bizProfile.contactInfo || "",
            website: bizProfile.website || "",
          },
        }).catch(() => null);
      }
    }

    // Update the Agent record
    const updatedDbAgent = await prisma.agent.update({
      where: { id: resolvedId },
      data: {
        name: agentName,
        description: body.description !== undefined ? body.description : undefined,
        instructions: agentInstructions,
        systemPrompt: compiledInstructions,
        initialMessage: compiledGreeting,
        voiceId,
        cartesiaVoiceId: voiceId,
        language: language as any,
        status: body.status !== undefined ? body.status : undefined,
        businessId: businessRecord?.id || undefined,
        businessContext: JSON.stringify(bizProfile),
        updatedAt: new Date(),
      },
    });

    // Update Tools if provided
    if (body.tools && Array.isArray(body.tools)) {
      await prisma.agentTool.deleteMany({ where: { agentId: resolvedId } });
      await prisma.agentTool.createMany({
        data: body.tools.map((t: { name: string; description: string; isEnabled?: boolean; enabled?: boolean }) => ({
          agentId: resolvedId,
          name: t.name,
          description: t.description,
          enabled: t.isEnabled !== false && t.enabled !== false,
          isEnabled: t.isEnabled !== false && t.enabled !== false,
        })),
        skipDuplicates: true,
      });
    }

    // Update Knowledge items (FAQs) if provided
    if (bizProfile.faqs && Array.isArray(bizProfile.faqs)) {
      await prisma.agentKnowledge.deleteMany({ where: { agentId: resolvedId } });
      const knowledgeRows = bizProfile.faqs
        .filter((f: { question: string; answer: string }) => f.question && f.answer)
        .map((f: { question: string; answer: string }) => ({
          agentId: resolvedId,
          title: f.question,
          content: f.answer,
          metadata: { type: "faq" },
        }));

      if (knowledgeRows.length > 0) {
        await prisma.agentKnowledge.createMany({ data: knowledgeRows });
      }
    }

    // Create an immutable version snapshot of the new config!
    let versionSnapshot = null;
    try {
      versionSnapshot = await createAgentVersion(resolvedId);
    } catch (verErr) {
      console.warn("[AGENT_VERSION] Warning creating version snapshot:", verErr);
    }

    // Update in-memory dataStore & warm runtime cache
    const updated = dataStore.updateAgent(resolvedId, {
      ...body,
      name: agentName,
      instructions: agentInstructions,
      systemPrompt: compiledInstructions,
      initialMessage: compiledGreeting,
      cartesiaVoiceId: voiceId,
      cartesiaVoiceName: getVoiceName(voiceId),
      businessProfile: bizProfile,
      lastActive: "Active (DB Authoritative)",
    });

    agentRuntimeCache.invalidate(resolvedId, {
      id: resolvedId,
      organizationId: updatedDbAgent.organizationId,
      name: agentName,
      instructions: compiledInstructions,
      businessName: bizProfile.businessName || "QETADOTIN",
      cartesiaAgentId: updatedDbAgent.cartesiaAgentId || undefined,
      cartesiaVoiceId: voiceId,
      language,
      enabledTools: (body.tools || []).filter((t: any) => t.isEnabled !== false && t.enabled !== false),
      phoneNumber: body.phoneNumber || currentAgent?.phoneNumber,
      updatedAt: new Date().toISOString(),
    });

    // Invalidate server.js cache
    try {
      const port = process.env.PORT || "3000";
      await fetch(`http://127.0.0.1:${port}/api/agent/cache-invalidate?agentId=${encodeURIComponent(resolvedId)}`, {
        method: "POST",
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      agent: updated,
      version: versionSnapshot?.versionNumber || updatedDbAgent.currentVersionNum,
      updatedAt: updatedDbAgent.updatedAt.toISOString(),
      instructions: agentInstructions,
      systemPrompt: compiledInstructions,
      initialMessage: compiledGreeting,
    });
  } catch (err: unknown) {
    console.error("[AGENTS_PUT_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error updating agent" },
      { status: 500 }
    );
  }
}

export const PATCH = PUT;

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = id.trim();

    let resolvedDbId: string = cleanId;

    try {
      const dbAgent = await prisma.agent.findFirst({
        where: {
          OR: [{ id: cleanId }, { cartesiaAgentId: cleanId }],
        },
        select: { id: true, cartesiaAgentId: true, organizationId: true },
      });
      if (dbAgent) {
        resolvedDbId = dbAgent.id;
        const orgResult = await resolveOrgContext(_req);
        if (!("error" in orgResult) && dbAgent.organizationId && dbAgent.organizationId !== orgResult.organizationId) {
          return NextResponse.json({ success: false, error: "Unauthorized: Access denied for this organization" }, { status: 403 });
        }
      }
    } catch (lookupErr: any) {
      if (lookupErr?.status === 403) throw lookupErr;
      console.warn("[AGENT_DELETE] DB lookup warning:", lookupErr);
    }

    // Mark deleted in DataStore and runtime cache
    dataStore.deleteAgent(resolvedDbId);
    dataStore.markAgentDeleted(resolvedDbId);
    agentRuntimeCache.invalidate(resolvedDbId);

    // Clean up all DB records
    try {
      await prisma.agent.updateMany({
        where: { id: resolvedDbId },
        data: { phoneNumberId: null, businessId: null },
      });

      await prisma.call.updateMany({
        where: { agentId: resolvedDbId },
        data: { agentId: null },
      });

      const campaigns = await prisma.campaign.findMany({
        where: { agentId: resolvedDbId },
        select: { id: true },
      });
      for (const camp of campaigns) {
        await prisma.campaignLead.deleteMany({ where: { campaignId: camp.id } }).catch(() => {});
        await prisma.campaign.delete({ where: { id: camp.id } }).catch(() => {});
      }

      await prisma.agentVersion.deleteMany({ where: { agentId: resolvedDbId } }).catch(() => {});
      await prisma.agentKnowledge.deleteMany({ where: { agentId: resolvedDbId } }).catch(() => {});
      await prisma.agentTool.deleteMany({ where: { agentId: resolvedDbId } }).catch(() => {});

      await prisma.agent.delete({ where: { id: resolvedDbId } });
    } catch (dbErr) {
      console.error("[AGENT_DELETE_DB_ERROR]", dbErr);
      throw dbErr;
    }

    return NextResponse.json({ success: true, deleted: true, id: cleanId });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error deleting agent" },
      { status: 500 }
    );
  }
}
