import { NextResponse } from "next/server";

export async function GET(req: Request) {
  let apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey || apiKey === "sk_car_x7b5kmXE55KpDgAR9Rcc1U") {
    apiKey = "sk_car_5p3YKUikhM6jidJWiELStn";
  }
  const url = new URL(req.url);
  let resolvedAgentId = (url.searchParams.get("agentId") || "").trim();

  if (resolvedAgentId && !resolvedAgentId.startsWith("agent_")) {
    const { prisma } = await import("@/lib/db/prisma");
    const dbA = await prisma.agent.findUnique({
      where: { id: resolvedAgentId },
      select: { cartesiaAgentId: true },
    });
    if (dbA?.cartesiaAgentId) {
      resolvedAgentId = dbA.cartesiaAgentId;
    }
  }

  if ((!resolvedAgentId || resolvedAgentId === "agent_vDCfnuFdJokXJDVxgmHeZx") && process.env.CARTESIA_AGENT_ID) {
    resolvedAgentId = process.env.CARTESIA_AGENT_ID === "agent_vDCfnuFdJokXJDVxgmHeZx" ? "agent_DSSrQj5z4ofsawJ6ZeSvF7" : process.env.CARTESIA_AGENT_ID;
  }
  if (!resolvedAgentId || resolvedAgentId === "agent_vDCfnuFdJokXJDVxgmHeZx") {
    resolvedAgentId = "agent_DSSrQj5z4ofsawJ6ZeSvF7";
  }

  if (!resolvedAgentId) {
    return NextResponse.json({ error: "Valid Cartesia agentId is required" }, { status: 400 });
  }

  try {
    const res = await fetch("https://api.cartesia.ai/v1/agents/" + resolvedAgentId, {
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
        id: d.id,
        name: d.name,
        description: d.description,
        instructions: d.config?.instructions || "",
        initialMessage: d.config?.initial_message || "",
        voiceId: d.config?.audio?.output?.voice_id,
        language: d.config?.language?.primary,
        model: d.config?.model?.id,
        temperature: d.config?.model?.temperature ?? null,
        maxOutputTokens: d.config?.model?.max_output_tokens ?? null,
        noiseSuppression: d.config?.audio?.input?.noise_suppression ?? "auto",
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
  let apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey || apiKey === "sk_car_x7b5kmXE55KpDgAR9Rcc1U") {
    apiKey = "sk_car_5p3YKUikhM6jidJWiELStn";
  }
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
