import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { dispatchOutboundCall } from "@/lib/telephony/outboundDialer";
import { getTelephonyConfig, resolveWebhookBaseUrl } from "@/lib/config/telephony";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { to, phoneNumber, number, agentId, businessContext, dynamicVariables } = body;
    to = to || phoneNumber || number;

    if (!to) {
      return NextResponse.json(
        { success: false, error: "Recipient phone number is required." },
        { status: 400 }
      );
    }

    const telConfig = getTelephonyConfig();
    const outboundCallerId = telConfig.vobizPhoneNumber || "+918071582667";
    const webhookUrl = resolveWebhookBaseUrl(req);

    // Dispatch outbound call via unified LiveKit SIP dialer
    const dialerResult = await dispatchOutboundCall({
      to,
      agentId,
      businessContext,
      dynamicVariables,
      req,
    });

    if (!dialerResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: dialerResult.error || dialerResult.telephonyReason,
          telephonyStatus: dialerResult.telephonyStatus,
          reason: dialerResult.telephonyReason,
        },
        { status: 400 }
      );
    }

    const savedCall = dataStore.getCall(dialerResult.callId);

    return NextResponse.json({
      success: true,
      call: savedCall,
      telephony: {
        outboundNumber: outboundCallerId,
        destinationNumber: to,
        status: dialerResult.telephonyStatus,
        vobizCallId: dialerResult.vobizCallId,
        reason: dialerResult.telephonyReason,
        publicUrl: webhookUrl,
        carrier: "LiveKit Cloud SIP (Vobiz Trunk)",
        trunkId: telConfig.vobizTrunkId,
        domain: telConfig.vobizSipDomain,
      },
      message: `Placing outbound call to ${to} via LiveKit SIP. Agent will greet when call connects.`,
    });
  } catch (err: unknown) {
    console.error("[CALLS_OUTBOUND_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error initiating outbound call" },
      { status: 500 }
    );
  }
}
