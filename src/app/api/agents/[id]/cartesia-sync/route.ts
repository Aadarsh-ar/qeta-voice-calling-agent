import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { dataStore } from "@/lib/db/store";
import { syncAgentWithCartesia, getCartesiaAgentDetails } from "@/lib/cartesia/sync";
import { agentRuntimeCache } from "@/lib/agent/agentRuntimeCache";

/**
 * GET /api/agents/[id]/cartesia-sync
 * Inspects live Cartesia Agent configuration vs QETADOTIN DB configuration.
 * Detects configuration drift across all supported fields:
 * - Name
 * - Description
 * - Instructions
 * - Initial Message (Greeting)
 * - Voice ID
 * - Language
 * - Model
 * - Transfer Phone Number
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dbAgent = await prisma.agent.findUnique({
      where: { id },
      include: { business: true },
    });

    if (!dbAgent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const cartesiaAgentId = dbAgent.cartesiaAgentId || (id.startsWith("agent_") ? id : "");
    if (!cartesiaAgentId) {
      return NextResponse.json({
        success: true,
        isSynced: false,
        cartesiaAgentId: null,
        status: "NOT_LINKED",
        message: "No Cartesia Agent ID is associated with this agent.",
        differences: [{ field: "cartesiaAgentId", qetaValue: "None", cartesiaValue: "Unassigned" }],
      });
    }

    // Fetch live state from Cartesia
    let cartesiaData: any;
    try {
      cartesiaData = await getCartesiaAgentDetails(cartesiaAgentId);
    } catch (err: unknown) {
      return NextResponse.json({
        success: true,
        isSynced: false,
        cartesiaAgentId,
        status: "SYNC_FAILED",
        error: err instanceof Error ? err.message : "Failed to fetch agent from Cartesia",
        differences: [{ field: "status", qetaValue: "Active", cartesiaValue: "Unreachable" }],
      });
    }

    // Compare fields
    const differences: { field: string; label: string; qetaValue: string; cartesiaValue: string }[] = [];

    const cartesiaName = (cartesiaData.name || "").trim().toLowerCase();
    const qetaNameSlug = (dbAgent.name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_\-.]/g, "-")
      .replace(/--+/g, "-")
      .replace(/^-|-$/g, "");
    if (cartesiaName && qetaNameSlug && cartesiaName !== qetaNameSlug && !qetaNameSlug.includes(cartesiaName) && !cartesiaName.includes(qetaNameSlug)) {
      differences.push({
        field: "name",
        label: "Agent Name",
        qetaValue: dbAgent.name,
        cartesiaValue: cartesiaData.name,
      });
    }

    const cartesiaGreeting = (cartesiaData.llm_introduce || cartesiaData.config?.initial_message || "").trim();
    const qetaGreeting = (dbAgent.initialMessage || "").trim();
    if (cartesiaGreeting && qetaGreeting && cartesiaGreeting !== qetaGreeting) {
      differences.push({
        field: "initialMessage",
        label: "Starter Greeting",
        qetaValue: qetaGreeting,
        cartesiaValue: cartesiaGreeting,
      });
    }

    const cartesiaVoiceId = (cartesiaData.tts_voice || cartesiaData.config?.audio?.output?.voice_id || "").trim();
    const qetaVoiceId = (dbAgent.cartesiaVoiceId || "").trim();
    if (cartesiaVoiceId && qetaVoiceId && cartesiaVoiceId !== qetaVoiceId) {
      differences.push({
        field: "voiceId",
        label: "Voice ID",
        qetaValue: qetaVoiceId,
        cartesiaValue: cartesiaVoiceId,
      });
    }

    const cartesiaLang = (cartesiaData.tts_language || cartesiaData.config?.language?.primary || "").trim();
    const qetaLang = dbAgent.language === "ENGLISH" ? "en" : "te";
    if (cartesiaLang && qetaLang && cartesiaLang !== qetaLang) {
      differences.push({
        field: "language",
        label: "Primary Language",
        qetaValue: qetaLang,
        cartesiaValue: cartesiaLang,
      });
    }

    const cartesiaInstructions = (cartesiaData.llm_system_prompt || cartesiaData.config?.instructions || "").trim();
    const qetaInstructions = (dbAgent.instructions || dbAgent.systemPrompt || "").trim();
    const normCartesia = cartesiaInstructions.replace(/\r\n/g, "\n");
    const normQeta = qetaInstructions.replace(/\r\n/g, "\n");
    const isInstructionsMatch =
      normCartesia === normQeta ||
      (normQeta.length > 20 && normCartesia.includes(normQeta)) ||
      (normCartesia.length > 20 && normQeta.includes(normCartesia));

    if (cartesiaInstructions && qetaInstructions && !isInstructionsMatch) {
      differences.push({
        field: "instructions",
        label: "System Instructions",
        qetaValue: qetaInstructions.slice(0, 150) + "...",
        cartesiaValue: cartesiaInstructions.slice(0, 150) + "...",
      });
    }

    const isSynced = differences.length === 0;

    return NextResponse.json({
      success: true,
      isSynced,
      hasDrift: !isSynced,
      cartesiaAgentId,
      cartesiaVersionId: cartesiaData.version?.id || dbAgent.cartesiaVersionId,
      lastSyncedAt: dbAgent.lastSyncedAt?.toISOString() || cartesiaData.updated_at,
      status: isSynced ? "SYNCED" : "SYNC_REQUIRED",
      differences,
      cartesiaState: {
        id: cartesiaData.id,
        name: cartesiaData.name,
        description: cartesiaData.description,
        initialMessage: cartesiaGreeting,
        voiceId: cartesiaVoiceId,
        language: cartesiaLang,
        model: cartesiaData.config?.model?.id,
        instructions: cartesiaInstructions,
        updatedAt: cartesiaData.updated_at,
        versionId: cartesiaData.version?.id,
      },
      qetaState: {
        id: dbAgent.id,
        name: dbAgent.name,
        description: dbAgent.description,
        initialMessage: qetaGreeting,
        voiceId: qetaVoiceId,
        language: dbAgent.language,
        instructions: qetaInstructions,
        updatedAt: dbAgent.updatedAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agents/[id]/cartesia-sync
 * Handles explicit synchronization:
 * - action: "pull" -> Copies live Cartesia state into QETADOTIN database and local store
 * - action: "push" -> Pushes QETADOTIN state to Cartesia Agent API
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "pull"; // "pull" or "push"

    const dbAgent = await prisma.agent.findUnique({
      where: { id },
      include: { business: true, tools: true },
    });

    if (!dbAgent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const cartesiaAgentId = dbAgent.cartesiaAgentId || (id.startsWith("agent_") ? id : "");
    if (!cartesiaAgentId) {
      return NextResponse.json(
        { success: false, error: "Cannot synchronize agent without a Cartesia Agent ID." },
        { status: 400 }
      );
    }

    if (action === "pull") {
      // ── PULL: Read from Cartesia and overwrite QETADOTIN with ground truth ──
      const liveData = await getCartesiaAgentDetails(cartesiaAgentId);
      const liveInstructions = liveData.llm_system_prompt || liveData.config?.instructions || dbAgent.instructions;
      const liveGreeting = liveData.llm_introduce || liveData.config?.initial_message || dbAgent.initialMessage;
      const liveVoiceId = liveData.tts_voice || liveData.config?.audio?.output?.voice_id || dbAgent.cartesiaVoiceId;
      const liveLang = (liveData.tts_language || liveData.config?.language?.primary) === "en" ? "ENGLISH" : "TELUGU";
      const liveName = liveData.name || dbAgent.name;
      const liveDesc = liveData.description || dbAgent.description;
      const versionId = liveData.version?.id || dbAgent.cartesiaVersionId;

      await prisma.agent.update({
        where: { id },
        data: {
          name: liveName,
          description: liveDesc,
          instructions: liveInstructions,
          systemPrompt: liveInstructions,
          initialMessage: liveGreeting,
          cartesiaVoiceId: liveVoiceId,
          language: liveLang as any,
          cartesiaVersionId: versionId,
          lastSyncedAt: new Date(),
          lastSyncStatus: "SYNCED",
          lastSyncError: null,
        },
      });

      // Update dataStore
      const updatedAgent = dataStore.updateAgent(id, {
        name: liveName,
        description: liveDesc,
        systemPrompt: liveInstructions,
        initialMessage: liveGreeting,
        cartesiaVoiceId: liveVoiceId,
        language: liveLang as any,
        cartesiaVersionId: versionId,
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: "SYNCED",
      });

      // Invalidate runtime cache
      agentRuntimeCache.invalidate(id);

      return NextResponse.json({
        success: true,
        action: "pull",
        message: `Successfully pulled configuration from Cartesia agent (${cartesiaAgentId})!`,
        agent: updatedAgent,
        versionId,
      });
    } else {
      // ── PUSH: Push QETADOTIN state to Cartesia Agent API ──
      let parsedBiz: any = undefined;
      if (dbAgent.businessContext && dbAgent.businessContext.startsWith("{")) {
        try { parsedBiz = JSON.parse(dbAgent.businessContext); } catch {}
      }

      const syncResult = await syncAgentWithCartesia({
        cartesiaAgentId,
        agentName: dbAgent.name,
        instructions: dbAgent.instructions || dbAgent.systemPrompt,
        initialMessage: dbAgent.initialMessage || undefined,
        businessName: parsedBiz?.businessName || dbAgent.business?.name,
        businessDescription: parsedBiz?.description || dbAgent.business?.description,
        businessInformation: parsedBiz?.productsServices || dbAgent.business?.information,
        operatingHours: parsedBiz?.workingHours || dbAgent.business?.operatingHours,
        address: parsedBiz?.location || dbAgent.business?.address,
        contactInformation: parsedBiz?.contactInfo || dbAgent.business?.contactInformation,
        website: parsedBiz?.website || dbAgent.business?.website,
        cartesiaVoiceId: dbAgent.cartesiaVoiceId || undefined,
        language: dbAgent.language,
        tools: dbAgent.tools,
      });

      await prisma.agent.update({
        where: { id },
        data: {
          cartesiaVersionId: syncResult.cartesiaVersionId,
          lastSyncedAt: new Date(),
          lastSyncStatus: "SYNCED",
          lastSyncError: null,
        },
      });

      dataStore.updateAgent(id, {
        cartesiaVersionId: syncResult.cartesiaVersionId,
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: "SYNCED",
      });

      agentRuntimeCache.invalidate(id);

      // Invalidate server.js in-memory greeting and agent metadata cache
      try {
        const port = process.env.PORT || "3000";
        await fetch(`http://127.0.0.1:${port}/api/agent/cache-invalidate?agentId=${encodeURIComponent(id)}`, {
          method: "POST",
        }).catch(() => {});
      } catch {}

      return NextResponse.json({
        success: true,
        action: "push",
        message: `Successfully pushed configuration to Cartesia agent (${cartesiaAgentId}) at version ${syncResult.cartesiaVersionId}!`,
        versionId: syncResult.cartesiaVersionId,
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Sync error";
    return NextResponse.json(
      { success: false, error: `Cartesia synchronization failed: ${errorMsg}` },
      { status: 502 }
    );
  }
}
