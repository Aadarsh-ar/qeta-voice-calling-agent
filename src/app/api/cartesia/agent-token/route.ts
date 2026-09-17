import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });
  try {
    const body = await req.json().catch(() => ({}));
    const agentId: string = body.agentId || process.env.CARTESIA_AGENT_ID || "agent_GaiYMgB9Bj9kaKW1tUgqSQ";
    const res = await fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Cartesia-Version": "2026-08-14",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grants: { "websocket:connect": { agent_id: agentId } },
        expires_in: 1800,
      }),
    });
    if (!res.ok) { const e = await res.text(); return NextResponse.json({ error: e }, { status: res.status }); }
    const d = await res.json();
    return NextResponse.json({
      success: true,
      accessToken: d.access_token || d.token,
      agentId,
      expiresIn: 1800,
      cartesiaVersion: "2026-08-14",
      wsUrl: "wss://api.cartesia.ai/agents/stream/" + agentId + "?cartesia_version=2026-08-14",
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "error" }, { status: 500 });
  }
}
