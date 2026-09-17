import { NextResponse } from "next/server";

/**
 * Vobiz Answer URL Webhook
 * Called when an outbound/inbound call is answered.
 * Returns XML instructing Vobiz to establish a bidirectional WebSocket audio stream.
 */
export async function POST(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const agentId = urlObj.searchParams.get("agentId") || "";
    const callerNumber = urlObj.searchParams.get("callerNumber") || "";

    const hostHeader = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    const publicUrl = (hostHeader && !hostHeader.includes("localhost"))
      ? `https://${hostHeader}`
      : (process.env.PUBLIC_BASE_URL || process.env.VOBIZ_WEBHOOK_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000");
    let wsUrl: string;

    if (publicUrl.startsWith("https://")) {
      wsUrl = publicUrl.replace("https://", "wss://") + "/api/vobiz/stream";
    } else if (publicUrl.startsWith("http://")) {
      wsUrl = publicUrl.replace("http://", "ws://") + "/api/vobiz/stream";
    } else {
      wsUrl = `wss://${publicUrl}/api/vobiz/stream`;
    }

    const queryParams = new URLSearchParams();
    if (agentId) queryParams.set("agentId", agentId);
    if (callerNumber) queryParams.set("callerNumber", callerNumber);
    const queryString = queryParams.toString();
    if (queryString) {
      wsUrl += `?${queryString}`;
    }

    console.log(`[LATENCY_TRACE] ANSWERED → Vobiz Answer Webhook received for agent: ${agentId || "default"}, caller: ${callerNumber || "unknown"}`);
    console.log(`[LATENCY_TRACE] MEDIA_CONNECTING → Returning stream XML targeting: ${wsUrl}`);

    // In XML, bare & inside a text node causes fatal "Invalid Answer XML"
    const safeWsUrl = wsUrl.replace(/&/g, "&amp;");

    // Vobiz official bidirectional stream specification:
    // audio/x-mulaw at 8000Hz (telephony standard).
    // Note: audioTrack="inbound" must NOT be set when bidirectional="true" because
    // it can suppress outbound playAudio playback on carrier network.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${safeWsUrl}</Stream>
</Response>`.trim();

    return new NextResponse(xml, {
      status: 200,
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown webhook error";
    console.error(`[ERROR] incoming-call webhook exception: ${message}`);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
      { status: 500, headers: { "Content-Type": "application/xml" } }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
