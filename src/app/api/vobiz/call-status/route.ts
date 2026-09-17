import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { CallStatus } from "@/lib/types/models";

// In-memory set for webhook idempotency
const processedWebhooks = new Set<string>();

/**
 * Handles Vobiz call status webhooks (ring, hangup, etc.)
 * Implements Section 4 (Log Real Hangup Reason) & Section 14 (Webhook Idempotency)
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let data: any = {};
    if (contentType.includes("application/json")) {
      data = await req.json().catch(() => ({}));
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      data = Object.fromEntries(params.entries());
    }

    const providerCallId = data.call_uuid || data.request_uuid || data.CallUUID || data.callUuid || data.id || "unknown";
    const event = data.event || data.status || data.CallStatus || "unknown";
    const hangupCause = data.hangup_cause || data.hangupCause || data.reason || data.HangupCause || "NORMAL_CLEARING";
    const hangupSource = data.hangup_source || data.hangupSource || data.HangupSource || "TELEPHONY_PROVIDER";
    const duration = parseInt(data.duration || data.bill_duration || data.Duration || "0", 10);
    const eventTimestamp = data.timestamp || new Date().toISOString();

    // Section 14: Webhook Idempotency Check
    const idempotencyKey = `${providerCallId}_${event}_${hangupCause}`;
    if (processedWebhooks.has(idempotencyKey)) {
      console.log(`[VOBIZ_WEBHOOK_IDEMPOTENT] Ignoring duplicate webhook event: ${idempotencyKey}`);
      return NextResponse.json({ status: "ok", idempotent: true });
    }
    processedWebhooks.add(idempotencyKey);
    // Limit memory set
    if (processedWebhooks.size > 2000) {
      const oldest = Array.from(processedWebhooks).slice(0, 500);
      oldest.forEach((k) => processedWebhooks.delete(k));
    }

    // Match call in store or database
    const existingCall = dataStore.findCallByProviderId(providerCallId);
    const callId = existingCall?.id || "unknown";
    const agentId = existingCall?.agentId || data.agentId || "unknown";
    const cartesiaAgentId = existingCall?.cartesiaAgentId || "unknown";
    const phoneNumber = existingCall?.callerNumber || data.to || data.To || "unknown";

    // Determine termination reason and source
    let terminationReason = "Normal call completion";
    let hangupSourceResolved = hangupSource;

    if (hangupCause === "NO_ANSWER" || hangupCause === "ORIGINATOR_CANCEL") {
      terminationReason = "Customer did not answer or cancelled";
      hangupSourceResolved = "CUSTOMER";
    } else if (hangupCause === "USER_BUSY") {
      terminationReason = "Customer line busy";
      hangupSourceResolved = "CUSTOMER";
    } else if (hangupCause === "CALL_REJECTED") {
      terminationReason = "Call rejected by customer or carrier";
      hangupSourceResolved = "TELEPHONY_PROVIDER";
    } else if (hangupCause === "INVALID_XML" || hangupCause === "XML_EXECUTION_ERROR") {
      terminationReason = "Telephony provider received invalid XML or webhook was unreachable";
      hangupSourceResolved = "BACKEND";
    } else if (hangupCause === "MEDIA_TIMEOUT" || hangupCause === "SOCKET_ERROR") {
      terminationReason = "Media WebSocket stream disconnected prematurely";
      hangupSourceResolved = "MEDIA_STREAM";
    }

    // Section 4: Log the real hangup reason with all required fields
    console.log(`\n==================================================`);
    console.log(`[CALL_TERMINATION_REPORT]`);
    console.log(`==================================================`);
    console.log(`callId:              ${callId}`);
    console.log(`providerCallId:      ${providerCallId}`);
    console.log(`organizationId:      ${existingCall ? "org_default" : "unknown"}`);
    console.log(`agentId:             ${agentId}`);
    console.log(`cartesiaAgentId:     ${cartesiaAgentId}`);
    console.log(`phoneNumber:         ${phoneNumber}`);
    console.log(`callStatus:          ${existingCall?.status || "ENDED"}`);
    console.log(`providerStatus:      ${event}`);
    console.log(`hangupCause:         ${hangupCause}`);
    console.log(`hangupSource:        ${hangupSourceResolved}`);
    console.log(`terminationReason:   ${terminationReason}`);
    console.log(`lastSuccessfulStage: ${existingCall?.lastSuccessfulStage || existingCall?.stage || "TELEPHONY_CREATED"}`);
    console.log(`mediaConnected:      ${Boolean(existingCall?.mediaConnected)}`);
    console.log(`cartesiaConnected:   ${Boolean(existingCall?.cartesiaConnected)}`);
    console.log(`greetingStarted:     ${Boolean(existingCall?.greetingStarted)}`);
    console.log(`greetingCompleted:   ${Boolean(existingCall?.greetingCompleted)}`);
    console.log(`error:               ${data.error || "none"}`);
    console.log(`timestamp:           ${eventTimestamp}`);
    console.log(`==================================================\n`);

    // Update in-memory dataStore
    dataStore.updateCall(providerCallId, {
      status: CallStatus.COMPLETED,
      stage: "COMPLETED",
      hangupCause,
      hangupSource: hangupSourceResolved,
      terminationReason,
      durationSeconds: duration || existingCall?.durationSeconds || 0,
      endedAt: eventTimestamp,
    });

    // Update Neon PostgreSQL if available
    try {
      const { prisma } = await import("@/lib/db/prisma");
      await prisma.call.updateMany({
        where: { vobizCallId: providerCallId },
        data: {
          status: CallStatus.COMPLETED,
          durationSeconds: duration,
        },
      });
    } catch {}

    return NextResponse.json({
      status: "ok",
      callId,
      providerCallId,
      hangupCause,
      terminationReason,
    });
  } catch (err: any) {
    console.error("[VOBIZ_STATUS_ERROR]", err.message);
    return NextResponse.json({ status: "error", message: err.message });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Vobiz call-status webhook active and healthy",
    timestamp: new Date().toISOString(),
  });
}
