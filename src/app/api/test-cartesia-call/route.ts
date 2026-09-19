import { NextResponse } from "next/server";
import { getTelephonyConfig } from "@/lib/config/telephony";

export async function GET() {
  const telConfig = getTelephonyConfig();
  const cartesiaApiKey = telConfig.cartesiaApiKey;
  const cartesiaAgentId = telConfig.cartesiaAgentId;

  const results: Record<string, any> = {
    cartesiaApiKeyPrefix: cartesiaApiKey ? cartesiaApiKey.slice(0, 10) + "..." : "MISSING",
    cartesiaAgentId,
  };

  try {
    const pnRes = await fetch("https://api.cartesia.ai/agents/phone-numbers", {
      headers: {
        "X-API-Key": cartesiaApiKey,
        "Cartesia-Version": "2025-04-16",
      },
    });
    results.phoneNumbersStatus = pnRes.status;
    results.phoneNumbersBody = await pnRes.json();
  } catch (e: any) {
    results.phoneNumbersError = e?.message;
  }

  try {
    const callRes = await fetch("https://api.cartesia.ai/agents/calls", {
      method: "POST",
      headers: {
        "X-API-Key": cartesiaApiKey,
        "Cartesia-Version": "2025-04-16",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from_number_id: "ap_qXvGsN8xnFH3giNBsQ8QBM",
        agent_id: cartesiaAgentId,
        ringing_timeout_seconds: 30,
        outbound_calls: [{ to_number: "+919999999999" }],
      }),
    });
    results.callResStatus = callRes.status;
    results.callResBody = await callRes.json();
  } catch (e: any) {
    results.callResError = e?.message;
  }

  return NextResponse.json(results);
}
