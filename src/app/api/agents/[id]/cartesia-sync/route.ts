import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { dataStore } from "@/lib/db/store";
import { createAgentVersion } from "@/lib/agent/versionService";

/**
 * GET /api/agents/[id]/cartesia-sync
 * Kept for UI compatibility.
 * Reports that the Database is the single authoritative source of truth.
 * All runtime agents execute locally via LiveKit + Cartesia TTS without external agent drift.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dbAgent = await prisma.agent.findFirst({
      where: {
        OR: [{ id }, { cartesiaAgentId: id }],
      },
      include: { business: true },
    });

    if (!dbAgent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    const voiceId = dbAgent.voiceId || dbAgent.cartesiaVoiceId || "41508a7d-4839-445f-ba7f-687f620ed0e7";
    const greeting = dbAgent.initialMessage || "";
    const instructions = dbAgent.instructions || dbAgent.systemPrompt || "";

    return NextResponse.json({
      success: true,
      isSynced: true,
      hasDrift: false,
      status: "SYNCED",
      cartesiaAgentId: dbAgent.cartesiaAgentId || null,
      lastSyncedAt: dbAgent.updatedAt.toISOString(),
      differences: [],
      message: "Database is the single source of truth. Calls run via LiveKit with Cartesia TTS.",
      cartesiaState: {
        id: dbAgent.id,
        name: dbAgent.name,
        description: dbAgent.description,
        initialMessage: greeting,
        voiceId,
        language: dbAgent.language === "ENGLISH" ? "en" : "te",
        model: "sonic-3.6",
        instructions,
        updatedAt: dbAgent.updatedAt.toISOString(),
        versionId: `v${dbAgent.currentVersionNum}`,
      },
      qetaState: {
        id: dbAgent.id,
        name: dbAgent.name,
        description: dbAgent.description,
        initialMessage: greeting,
        voiceId,
        language: dbAgent.language,
        instructions,
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
 * Kept for UI compatibility.
 * Re-snapshots current agent configuration in DB as an immutable version.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const dbAgent = await prisma.agent.findFirst({
      where: {
        OR: [{ id }, { cartesiaAgentId: id }],
      },
    });

    if (!dbAgent) {
      return NextResponse.json({ success: false, error: "Agent not found" }, { status: 404 });
    }

    // Create a new version snapshot
    let version = null;
    try {
      version = await createAgentVersion(dbAgent.id);
    } catch {}

    return NextResponse.json({
      success: true,
      isSynced: true,
      hasDrift: false,
      message: "Agent is synchronized in PostgreSQL database.",
      agent: {
        id: dbAgent.id,
        name: dbAgent.name,
        instructions: dbAgent.instructions || dbAgent.systemPrompt,
        initialMessage: dbAgent.initialMessage,
        cartesiaVoiceId: dbAgent.voiceId || dbAgent.cartesiaVoiceId,
        language: dbAgent.language,
      },
      version: version?.versionNumber || dbAgent.currentVersionNum,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
