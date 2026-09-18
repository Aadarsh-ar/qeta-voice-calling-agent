import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, AgentDispatchClient } from "livekit-server-sdk";

// Verified Production Credentials & Fallbacks
const DEFAULT_LIVEKIT_URL = "wss://ai-voice-agent-44qkuva3.livekit.cloud";
const DEFAULT_LIVEKIT_KEY = "API6S2vyxFt6xvW";
const DEFAULT_LIVEKIT_SECRET = "eaFWRJKuO7ifHaLDwUeNZZ8TCyHfecYwHhnvHCxkwDSG";

// Exact designated landing page live agent & voice ID requested by user
export const EXACT_LANDING_AGENT_ID = "agent_WzcEn6kkRmPxAfBNHzvpa1";
export const EXACT_LANDING_VOICE_ID = "41508a7d-4839-445f-ba7f-687f620ed0e7";

export async function POST() {
  const apiKey = process.env.LIVEKIT_API_KEY || DEFAULT_LIVEKIT_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET || DEFAULT_LIVEKIT_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL || DEFAULT_LIVEKIT_URL;
  const agentId = EXACT_LANDING_AGENT_ID;
  const voiceId = EXACT_LANDING_VOICE_ID;

  try {
    const livekitHost = livekitUrl.replace(/^wss:\/\//, "https://");
    const roomName = `demo_${Math.random().toString(36).substring(2, 10)}`;
    const participantIdentity = `guest_${Math.random().toString(36).substring(2, 8)}`;

    // 1. Create isolated room on LiveKit Cloud
    const rsc = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    await rsc.createRoom({
      name: roomName,
      emptyTimeout: 120,
    });

    // 2. Explicitly dispatch QETA voice agent to this room with exact agent ID & voice ID
    try {
      const adc = new AgentDispatchClient(livekitHost, apiKey, apiSecret);
      await adc.createDispatch(roomName, "", {
        metadata: JSON.stringify({
          agentId,
          voiceId,
          isDemo: true,
        }),
      });
      console.log(`[DemoSession] Dispatched agent ${agentId} (voice: ${voiceId}) to room ${roomName}`);
    } catch (dispatchErr) {
      console.warn(`[DemoSession] Automatic agent dispatch note:`, dispatchErr);
    }

    // 3. Mint visitor token scoped strictly to this room
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      name: "Website Visitor",
      ttl: "30m",
      metadata: JSON.stringify({
        agentId,
        voiceId,
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
      voiceId,
      greeting: "హాయ్! నేను సామ్, qwetadotin యొక్క AI Voice Agent. నాతో ఏదైనా మాట్లాడండి — qwetadotin ఎలా పనిచేస్తుందో మీరే experience చేయొచ్చు.",
      samplePrompts: [
        "qwetadotin అంటే ఏమిటి?",
        "నువ్వు ఏం చేయగలవు?",
        "ఒక business scenario try చేద్దాం",
        "నేను ఒక restaurant owner",
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
