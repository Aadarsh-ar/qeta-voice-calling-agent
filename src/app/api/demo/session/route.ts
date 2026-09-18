import { NextResponse } from "next/server";

const FALLBACK_CARTESIA_KEY = "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
const FALLBACK_DEMO_AGENT_ID = "agent_vDCfnuFdJokXJDVxgmHeZx";

export async function POST() {
  const apiKey = process.env.CARTESIA_API_KEY || FALLBACK_CARTESIA_KEY;
  const agentId = process.env.CARTESIA_PUBLIC_DEMO_AGENT_ID || FALLBACK_DEMO_AGENT_ID;

  try {
    const res = await fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Cartesia-Version": "2026-08-14",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grants: { agent: true },
        expires_in: 1800,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[DemoSession] Failed to mint Cartesia access token:", res.status, errText);
      return NextResponse.json(
        { success: false, error: "Failed to generate live session token." },
        { status: res.status }
      );
    }

    const data = await res.json();
    const token = data.access_token || data.token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "No token returned by voice provider." },
        { status: 502 }
      );
    }

    const wsUrl = `wss://api.cartesia.ai/agents/stream/${agentId}?cartesia_version=2026-08-14&access_token=${token}`;

    return NextResponse.json({
      success: true,
      agentId,
      token,
      wsUrl,
      greeting: "నమస్తే! I am QETA, your AI voice assistant from QETADOTIN. You can speak to me in Telugu, English, or Tenglish. How can I help you today?",
      samplePrompts: [
        "What is QETADOTIN?",
        "తెలుగులో మాట్లాడండి",
        "Can you book sales appointments?",
        "What are your pricing plans?",
      ],
    });
  } catch (err: unknown) {
    console.error("[DemoSession] Error creating session:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
