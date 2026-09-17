import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") || process.env.CARTESIA_AGENT_ID || "agent_GaiYMgB9Bj9kaKW1tUgqSQ";
  try {
    const res = await fetch("https://api.cartesia.ai/v1/agents/" + agentId, {
      headers: {
        Authorization: "Bearer " + apiKey,
        "X-API-Key": apiKey,
        "Cartesia-Version": "2026-08-14",
      },
    });
    if (!res.ok) { const e = await res.text(); return NextResponse.json({ error: e }, { status: res.status }); }
    const d = await res.json();
    return NextResponse.json({
      success: true,
      agent: {
        id: d.id, name: d.name, description: d.description,
        voiceId: d.config?.audio?.output?.voice_id,
        language: d.config?.language?.primary,
        model: d.config?.model?.id,
        initialMessage: d.config?.initial_message,
        hasBackgroundSound: Boolean(d.config?.audio?.output?.background_sound?.file_id),
        backgroundSoundVolume: d.config?.audio?.output?.background_sound?.volume ?? null,
        systemTools: d.config?.system_tools ?? {},
        versionId: d.version?.id,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}

export async function POST() {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
  try {
    const res = await fetch("https://api.cartesia.ai/v1/agents", {
      headers: { Authorization: "Bearer " + apiKey, "Cartesia-Version": "2026-08-14" },
    });
    if (!res.ok) { const e = await res.text(); return NextResponse.json({ error: e }, { status: res.status }); }
    const d = await res.json();
    return NextResponse.json({
      success: true,
      agents: (d.data ?? []).map((a: Record<string, unknown>) => ({ id: a.id, name: a.name, versionId: a.version_id })),
      hasMore: d.has_more,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
