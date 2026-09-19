import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey || apiKey === "sk_car_x7b5kmXE55KpDgAR9Rcc1U") {
    apiKey = "sk_car_5p3YKUikhM6jidJWiELStn";
  }
  try {
    const body = await req.json().catch(() => ({}));
    const requestedId: string = (body.agentId || "").trim();
    let resolvedCartesiaAgentId = "";

    if (requestedId.startsWith("agent_") && requestedId !== "agent_vDCfnuFdJokXJDVxgmHeZx") {
      resolvedCartesiaAgentId = requestedId;
    } else if (requestedId && requestedId !== "agent_vDCfnuFdJokXJDVxgmHeZx") {
      const { prisma } = await import("@/lib/db/prisma");
      const dbAgent = await prisma.agent.findUnique({
        where: { id: requestedId },
        select: { cartesiaAgentId: true },
      });
      if (dbAgent?.cartesiaAgentId && dbAgent.cartesiaAgentId !== "agent_vDCfnuFdJokXJDVxgmHeZx") {
        resolvedCartesiaAgentId = dbAgent.cartesiaAgentId;
      }
    }

    if (!resolvedCartesiaAgentId && process.env.CARTESIA_AGENT_ID && process.env.CARTESIA_AGENT_ID !== "agent_vDCfnuFdJokXJDVxgmHeZx") {
      resolvedCartesiaAgentId = process.env.CARTESIA_AGENT_ID;
    }
    if (!resolvedCartesiaAgentId) {
      resolvedCartesiaAgentId = "agent_DSSrQj5z4ofsawJ6ZeSvF7";
    }

    if (!resolvedCartesiaAgentId) {
      return NextResponse.json(
        { success: false, error: "Valid Cartesia Agent ID is required to generate connection token." },
        { status: 400 }
      );
    }

    const res = await fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Cartesia-Version": "2026-08-14",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grants: { "websocket:connect": { agent_id: resolvedCartesiaAgentId } },
        expires_in: 1800,
      }),
    });
    if (!res.ok) { const e = await res.text(); return NextResponse.json({ error: e }, { status: res.status }); }
    const d = await res.json();
    return NextResponse.json({
      success: true,
      accessToken: d.access_token || d.token,
      agentId: resolvedCartesiaAgentId,
      expiresIn: 1800,
      cartesiaVersion: "2026-08-14",
      wsUrl: `wss://api.cartesia.ai/agents/stream/${resolvedCartesiaAgentId}?cartesia_version=2026-08-14&token=${d.access_token || d.token}`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
