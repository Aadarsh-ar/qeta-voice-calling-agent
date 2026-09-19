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

    // Vercel Serverless Check: Vercel does NOT support persistent WebSockets.
    // If wsUrl points to Vercel/qeta.in without a dedicated WS server, returning <Stream>
    // causes Vobiz to fail the WS handshake with 404 and hang up after 1s (4010 End Of XML Instructions).
    const isVercel = hostHeader.includes("qeta.in") || hostHeader.includes("vercel.app") || !!process.env.VERCEL;
    const hasExternalWs = !!(process.env.PUBLIC_WS_URL || process.env.VOBIZ_STREAM_URL);

    let xml: string;
    if (isVercel && !hasExternalWs) {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Speak voice="Polly.Aditi" language="te-IN">నమస్కారం అండి! AI వాయిస్ ఏజెంట్ లైన్ లో ఉంది.</Speak>
</Response>`.trim();
    } else {
      xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${safeWsUrl}</Stream>
</Response>`.trim();
    }

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
