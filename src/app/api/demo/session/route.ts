import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, AgentDispatchClient } from "livekit-server-sdk";

export async function POST() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || "wss://ai-voice-agent-44qkuva3.livekit.cloud";
  const agentId = process.env.NEXT_PUBLIC_SHOWCASE_AGENT_ID || "agent_vDCfnuFdJokXJDVxgmHeZx";

  if (!apiKey || !apiSecret) {
    console.error("[DemoSession] Missing LiveKit credentials in environment");
    return NextResponse.json(
      { success: false, error: "LiveKit server credentials are not configured." },
      { status: 500 }
    );
  }

  try {
    const livekitHost = livekitUrl.replace(/^wss:\/\//, "https://");
    const roomName = `demo_${Math.random().toString(36).substring(2, 10)}`;
    const participantIdentity = `guest_${Math.random().toString(36).substring(2, 8)}`;

    // 1. Create Room on LiveKit Cloud
    const rsc = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    await rsc.createRoom({
      name: roomName,
      emptyTimeout: 120,
    });

    // 2. Explicitly dispatch QETA voice agent to this room
    try {
      const adc = new AgentDispatchClient(livekitHost, apiKey, apiSecret);
      await adc.createDispatch(roomName, "", {
        metadata: JSON.stringify({
          agentId,
          isDemo: true,
        }),
      });
      console.log(`[DemoSession] Dispatched agent to room ${roomName}`);
    } catch (dispatchErr) {
      console.warn(`[DemoSession] Automatic agent dispatch note:`, dispatchErr);
    }

    // 3. Mint visitor token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: "Website Visitor",
      ttl: "30m",
      metadata: JSON.stringify({
        agentId,
        isDemo: true,
      }),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({
      success: true,
      token,
      livekitUrl,
      roomName,
      participantIdentity,
      agentId,
      greeting: "నమస్తే! I am QETA, your AI voice assistant from QETADOTIN. You can speak to me in Telugu, English, or Tenglish. How can I help you today?",
      samplePrompts: [
        "What is QETADOTIN?",
        "తెలుగులో మాట్లాడండి",
        "Can you book sales appointments?",
        "What are your pricing plans?",
      ],
    });
  } catch (err: unknown) {
    console.error("[DemoSession] Error creating LiveKit session:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
