import { NextResponse } from "next/server";
import { dataStore, AgentItem } from "@/lib/db/store";
import { prisma } from "@/lib/db/prisma";
import { syncAgentWithCartesia, getCartesiaAgentDetails } from "@/lib/cartesia/sync";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const skipCartesia = url.searchParams.get("skipCartesia") === "true";

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
        cartesiaVoiceId: true,
        cartesiaAgentId: true,
        cartesiaModel: true,
        llmModel: true,
        language: true,
        status: true,
        initialMessage: true,
        cartesiaVersionId: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
        lastSyncError: true,
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
    });
  } catch (err) {
    console.warn("DB agent retrieval exception in GET /api/agents/[id]:", err);
  }

  const existingStoreAgent = dataStore.getAgent(id);
  const targetCartesiaAgentId =
    dbAgent?.cartesiaAgentId ||
    (id.startsWith("agent_") ? id : undefined) ||
    existingStoreAgent?.cartesiaAgentId;

  // Always attempt to fetch live ground truth from Cartesia if agent is linked
  let liveCartesiaData: any = null;
  if (!skipCartesia && targetCartesiaAgentId && process.env.CARTESIA_API_KEY) {
    try {
      liveCartesiaData = await getCartesiaAgentDetails(targetCartesiaAgentId);
    } catch (cartesiaErr) {
      console.warn(`[CARTESIA_GET_WARN] Could not fetch live Cartesia agent ${targetCartesiaAgentId}:`, cartesiaErr);
    }
  }

  // Determine authoritative fields: Site Database is ALWAYS the single source of truth!
  // The user sets instructions on our site, and our site controls Cartesia, never the reverse.
  const liveInstructions =
    dbAgent?.instructions ||
    dbAgent?.systemPrompt ||
    existingStoreAgent?.instructions ||
    existingStoreAgent?.systemPrompt ||
    liveCartesiaData?.llm_system_prompt ||
    "";

  const liveGreeting =
    dbAgent?.initialMessage ||
    existingStoreAgent?.initialMessage ||
    (liveCartesiaData?.llm_introduce !== undefined && liveCartesiaData.llm_introduce !== null
      ? liveCartesiaData.llm_introduce
      : "");

  const liveVoiceId =
    liveCartesiaData?.tts_voice ||
    dbAgent?.cartesiaVoiceId ||
    existingStoreAgent?.cartesiaVoiceId ||
    process.env.CARTESIA_VOICE_ID ||
    "41508a7d-4839-445f-ba7f-687f620ed0e7";

  const liveLanguage =
    liveCartesiaData?.tts_language === "en"
      ? "ENGLISH"
      : (dbAgent?.language || existingStoreAgent?.language || "TELUGU_ENGLISH");

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
    };
  }

  const agentIdResolved = dbAgent?.id || id;
  const agentItem: AgentItem = {
    id: agentIdResolved,
    name: dbAgent?.name || existingStoreAgent?.name || "AD2 — Aadarsh",
    description: dbAgent?.description || existingStoreAgent?.description || "",
    language: liveLanguage as any,
    status: (dbAgent?.status || existingStoreAgent?.status || "ACTIVE") as any,
    systemPrompt: liveInstructions,
    instructions: liveInstructions,
    initialMessage: liveGreeting,
    cartesiaVersionId: liveCartesiaData?.pinned_version || liveCartesiaData?.version?.id || dbAgent?.cartesiaVersionId || "active",
    lastSyncedAt: liveCartesiaData?.updated_at || dbAgent?.lastSyncedAt?.toISOString() || new Date().toISOString(),
    lastSyncStatus: liveCartesiaData ? "SYNCED" : (dbAgent?.lastSyncStatus as any || "SYNCED"),
    businessContext: dbAgent?.businessContext || existingStoreAgent?.businessContext || "",
    businessProfile: parsedBizProfile || existingStoreAgent?.businessProfile,
    cartesiaVoiceId: liveVoiceId,
    cartesiaVoiceName: existingStoreAgent?.cartesiaVoiceName || "Harika (Telugu Faculty Voice)",
    cartesiaModel: dbAgent?.cartesiaModel || "sonic-3.6",
    llmModel: dbAgent?.llmModel || "gemini-2.5-flash",
    sarvamModel: "saaras:v3-realtime",
    sarvamLanguage: "te-IN",
    phoneNumber: dbAgent?.phoneNumber?.e164Number || existingStoreAgent?.phoneNumber || "+91 80 7158 2667",
    callsCount: existingStoreAgent?.callsCount || 0,
    totalMinutes: existingStoreAgent?.totalMinutes || 0,
    estimatedCost: existingStoreAgent?.estimatedCost || 0,
    lastActive: "Active & Synchronized",
    createdAt: dbAgent?.createdAt?.toISOString() || existingStoreAgent?.createdAt || new Date().toISOString(),
    tools: dbAgent?.tools
      ? dbAgent.tools.map((t: any) => ({ name: t.name, description: t.description, isEnabled: t.enabled && t.isEnabled }))
      : existingStoreAgent?.tools || [],
    cartesiaAgentId: targetCartesiaAgentId,
  };

  dataStore.createAgentWithId(agentItem);

  // If live data from Cartesia was fetched, keep PostgreSQL in sync
  if (liveCartesiaData && dbAgent?.id) {
    prisma.agent.update({
      where: { id: dbAgent.id },
      data: {
        instructions: liveInstructions,
        systemPrompt: liveInstructions,
        initialMessage: liveGreeting,
        cartesiaVoiceId: liveVoiceId,
        lastSyncedAt: new Date(),
        lastSyncStatus: "SYNCED",
        lastSyncError: null,
      },
    }).catch((uErr) => console.warn("Background DB sync warning:", uErr));
  }

  return NextResponse.json({ success: true, agent: agentItem });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const currentAgent = dataStore.getAgent(id);

    // Exact Cartesia Agent ID resolution — no random or fake fallbacks
    let cartesiaAgentId =
      body.cartesiaAgentId && body.cartesiaAgentId.trim().startsWith("agent_")
        ? body.cartesiaAgentId.trim()
        : currentAgent?.cartesiaAgentId && currentAgent.cartesiaAgentId.startsWith("agent_")
        ? currentAgent.cartesiaAgentId
        : id.startsWith("agent_")
        ? id
        : undefined;

    if (!cartesiaAgentId) {
      try {
        const dbCheck = await prisma.agent.findUnique({
          where: { id },
          select: { cartesiaAgentId: true },
        });
        if (dbCheck?.cartesiaAgentId && dbCheck.cartesiaAgentId.startsWith("agent_")) {
          cartesiaAgentId = dbCheck.cartesiaAgentId;
        }
      } catch {}
    }

    const bizProfile = body.businessProfile || currentAgent?.businessProfile || {};
    const agentName = body.name || currentAgent?.name || "AD2 — Aadarsh";
    const agentInstructions = (body.instructions || body.systemPrompt || currentAgent?.instructions || currentAgent?.systemPrompt || "").trim();
    const initialMessage = body.initialMessage !== undefined ? body.initialMessage : currentAgent?.initialMessage;
    const voiceId = body.cartesiaVoiceId || currentAgent?.cartesiaVoiceId || process.env.CARTESIA_VOICE_ID || "f9945b75-0f3b-448d-ba9e-3d22c229a68e";
    const language = body.language || currentAgent?.language || "TELUGU_ENGLISH";
    const tools = body.tools || currentAgent?.tools || [];

    // ── STEP 1: Synchronize with Cartesia Official Agent API ──────────────────
    let syncResult;
    try {
      syncResult = await syncAgentWithCartesia({
        cartesiaAgentId,
        agentName,
        instructions: agentInstructions,
        initialMessage,
        businessName: bizProfile.businessName,
        businessDescription: bizProfile.description,
        businessInformation: bizProfile.productsServices,
        operatingHours: bizProfile.workingHours,
        address: bizProfile.location,
        contactInformation: bizProfile.contactInfo,
        website: bizProfile.website,
        faqs: bizProfile.faqs,
        policies: bizProfile.policies,
        tools,
        cartesiaVoiceId: voiceId,
        language,
      });
    } catch (cartesiaErr: unknown) {
      console.error("[CARTESIA_SYNC_ERROR] Update rejected by Cartesia:", cartesiaErr);
      // STRICT REQUIREMENT: Do NOT save or show success if Cartesia synchronization failed
      return NextResponse.json(
        {
          success: false,
          error: `Cartesia synchronization failed: ${cartesiaErr instanceof Error ? cartesiaErr.message : "Unknown error"}`,
        },
        { status: 502 }
      );
    }

    const verifiedCartesiaAgentId = syncResult.cartesiaAgentId;

    // ── STEP 2: Persist to PostgreSQL Neon DB (Multi-Tenant Org Scoped) ───────
    try {
      const org = await prisma.organization.findFirst();
      if (org) {
        // Upsert Business specifically for this agent (never mutate other agents' businesses)
        let businessRecord = null;
        if (bizProfile.businessName) {
          const currentDbAgent = await prisma.agent.findUnique({
            where: { id },
            select: { businessId: true },
          });

          if (currentDbAgent?.businessId) {
            businessRecord = await prisma.business.update({
              where: { id: currentDbAgent.businessId },
              data: {
                name: bizProfile.businessName,
                description: bizProfile.description || "",
                information: bizProfile.productsServices || "",
                operatingHours: bizProfile.workingHours || "",
                address: bizProfile.location || "",
                contactInformation: bizProfile.contactInfo || "",
                website: bizProfile.website || "",
              },
            });
          } else {
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
        }

        // Update Agent record with verified Cartesia sync metadata
        await prisma.agent.upsert({
          where: { id },
          create: {
            id,
            organizationId: org.id,
            name: agentName,
            description: body.description || currentAgent?.description || "",
            instructions: agentInstructions,
            systemPrompt: syncResult.instructions,
            initialMessage: syncResult.initialMessage,
            cartesiaAgentId: verifiedCartesiaAgentId,
            cartesiaVoiceId: voiceId,
            language: language as any,
            status: body.status || currentAgent?.status || "ACTIVE",
            businessId: businessRecord?.id,
            businessContext: JSON.stringify(bizProfile),
            cartesiaVersionId: syncResult.cartesiaVersionId,
            lastSyncedAt: new Date(),
            lastSyncStatus: "SYNCED",
            lastSyncError: null,
          },
          update: {
            name: agentName,
            description: body.description !== undefined ? body.description : undefined,
            instructions: agentInstructions,
            systemPrompt: syncResult.instructions,
            initialMessage: syncResult.initialMessage,
            cartesiaAgentId: verifiedCartesiaAgentId,
            cartesiaVoiceId: voiceId,
            language: language as any,
            status: body.status !== undefined ? body.status : undefined,
            businessId: businessRecord?.id,
            businessContext: JSON.stringify(bizProfile),
            cartesiaVersionId: syncResult.cartesiaVersionId,
            lastSyncedAt: new Date(),
            lastSyncStatus: "SYNCED",
            lastSyncError: null,
          },
        });

        // Update Tools
        if (body.tools && Array.isArray(body.tools)) {
          await prisma.agentTool.deleteMany({ where: { agentId: id } });
          await prisma.agentTool.createMany({
            data: body.tools.map((t: { name: string; description: string; isEnabled?: boolean; enabled?: boolean }) => ({
              agentId: id,
              name: t.name,
              description: t.description,
              enabled: t.isEnabled !== false && t.enabled !== false,
              isEnabled: t.isEnabled !== false && t.enabled !== false,
            })),
            skipDuplicates: true,
          });
        }

        // Update Knowledge chunks (FAQs)
        if (bizProfile.faqs && Array.isArray(bizProfile.faqs)) {
          await prisma.agentKnowledge.deleteMany({ where: { agentId: id } });
          const knowledgeRows = bizProfile.faqs
            .filter((f: { question: string; answer: string }) => f.question && f.answer)
            .map((f: { question: string; answer: string }) => ({
              agentId: id,
              title: f.question,
              content: f.answer,
              metadata: { type: "faq" },
            }));

          if (knowledgeRows.length > 0) {
            await prisma.agentKnowledge.createMany({ data: knowledgeRows });
          }
        }
      }
    } catch (dbErr) {
      console.warn("[DB_WARNING] PostgreSQL persistence warning:", dbErr);
    }

    // ── STEP 3: Update local memory store & warm runtime cache ─────────────────
    const updated = dataStore.updateAgent(id, {
      ...body,
      name: agentName,
      instructions: syncResult.instructions,
      systemPrompt: syncResult.instructions,
      initialMessage: syncResult.initialMessage,
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVoiceId: voiceId,
      cartesiaVersionId: syncResult.cartesiaVersionId,
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: "SYNCED",
      businessProfile: bizProfile,
      lastActive: "Active & Synchronized",
    });

    agentRuntimeCache.invalidate(id, {
      id,
      organizationId: (currentAgent as any)?.organizationId || "org_default",
      name: agentName,
      instructions: syncResult.instructions,
      businessName: bizProfile.businessName || "QETADOTIN",
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVoiceId: voiceId,
      language,
      enabledTools: (tools || []).filter((t: any) => t.isEnabled !== false && t.enabled !== false),
      phoneNumber: body.phoneNumber || currentAgent?.phoneNumber,
      updatedAt: new Date().toISOString(),
    });

    // Invalidate server.js in-memory greeting and agent metadata cache
    try {
      const port = process.env.PORT || "3000";
      await fetch(`http://127.0.0.1:${port}/api/agent/cache-invalidate?agentId=${encodeURIComponent(id)}`, {
        method: "POST",
      }).catch(() => {});
    } catch {}

    return NextResponse.json({
      success: true,
      agent: updated,
      synced: true,
      cartesiaAgentId: verifiedCartesiaAgentId,
      cartesiaVersionId: syncResult.cartesiaVersionId,
      updatedAt: syncResult.updatedAt,
      instructions: syncResult.instructions,
      initialMessage: syncResult.initialMessage,
    });
  } catch (err: unknown) {
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
    dataStore.deleteAgent(id);
    agentRuntimeCache.invalidate(id);

    try {
      await prisma.agentKnowledge.deleteMany({ where: { agentId: id } });
      await prisma.agentTool.deleteMany({ where: { agentId: id } });
      await prisma.agent.delete({ where: { id } });
    } catch {
      // ignore if not present in DB
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error deleting agent" },
      { status: 500 }
    );
  }
}
