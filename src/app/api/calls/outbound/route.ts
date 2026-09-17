import { NextResponse } from "next/server";
import { dataStore, CallItem } from "@/lib/db/store";
import { CallDirection, CallStatus, MessageRole } from "@/lib/types/models";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let { to, phoneNumber, number, agentId } = body;
    to = to || phoneNumber || number;

    if (!to) {
      return NextResponse.json(
        { success: false, error: "Recipient phone number is required." },
        { status: 400 }
      );
    }

    // Clean and validate Indian phone number format
    let cleanNumber = to.replace(/[\s\-\(\)]/g, "");
    if (!cleanNumber.startsWith("+")) {
      if (cleanNumber.length === 10) {
        cleanNumber = "+91" + cleanNumber;
      } else if (cleanNumber.startsWith("91") && cleanNumber.length === 12) {
        cleanNumber = "+" + cleanNumber;
      } else if (cleanNumber.startsWith("0") && cleanNumber.length === 11) {
        cleanNumber = "+91" + cleanNumber.slice(1);
      }
    }

    if (!cleanNumber.startsWith("+91") || cleanNumber.length < 13) {
      return NextResponse.json(
        {
          success: false,
          error: "Please enter a valid 10-digit Indian phone number (e.g. +91 98765 43210).",
        },
        { status: 400 }
      );
    }

    let agent = agentId ? dataStore.getAgent(agentId) : undefined;
    if (!agent && agentId) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
        const dbAgent = await prisma.agent.findUnique({
          where: { id: agentId },
          include: { tools: true },
        });
        if (dbAgent) {
          agent = {
            id: dbAgent.id,
            name: dbAgent.name,
            description: dbAgent.description || "",
            language: dbAgent.language as any,
            status: dbAgent.status as any,
            systemPrompt: dbAgent.systemPrompt,
            businessContext: dbAgent.businessContext || "",
            cartesiaAgentId: dbAgent.cartesiaAgentId || undefined,
            cartesiaVoiceId: dbAgent.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
            cartesiaVoiceName: "AD (Cloned Telugu Voice)",
            cartesiaModel: dbAgent.cartesiaModel,
            llmModel: dbAgent.llmModel,
            sarvamModel: dbAgent.sarvamModel,
            sarvamLanguage: dbAgent.sarvamLanguage,
            phoneNumber: "+91 80 7158 2667",
            callsCount: 0,
            totalMinutes: 0,
            estimatedCost: 0,
            lastActive: "Active",
            createdAt: dbAgent.createdAt.toISOString(),
            tools: dbAgent.tools.map((t) => ({
              name: t.name,
              description: t.description,
              isEnabled: t.isEnabled,
            })),
          };
          dataStore.createAgentWithId(agent);
        }
      } catch (dbErr) {
        console.warn("Could not query DB for agent in outbound route:", dbErr);
      }
    }

    // ─── Section 7: Strict Cartesia Agent Verification (No silent fallback!) ───
    if (!agent) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent "${agentId || "unknown"}" not found in database. Cannot place call with unconfigured agent.`,
        },
        { status: 404 }
      );
    }

    const cartesiaApiKey = process.env.CARTESIA_API_KEY || "";
    if (!cartesiaApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Cartesia API key (CARTESIA_API_KEY) is missing from environment. Telephony agent cannot initialize speech runtime.",
        },
        { status: 500 }
      );
    }

    const cartesiaAgentId = agent.cartesiaAgentId || process.env.CARTESIA_AGENT_ID;
    if (!cartesiaAgentId || !cartesiaAgentId.startsWith("agent_")) {
      return NextResponse.json(
        {
          success: false,
          error: `Agent "${agent.name}" has no valid Cartesia Agent ID (found: "${cartesiaAgentId || 'none'}"). Please bind or sync a Cartesia agent first.`,
        },
        { status: 400 }
      );
    }

    const resolvedAgentId = agent.id;
    const agentName = agent.name;
    const outboundCallerId = "+918071582667"; // Purchased Vobiz DID (Karnataka)

    // ─── Vobiz REST API credentials ──────────────────────────────────────
    let vobizAuthId = process.env.VOBIZ_AUTH_ID || "";
    let vobizAuthToken = process.env.VOBIZ_AUTH_TOKEN || "";
    let webhookUrl = process.env.PUBLIC_BASE_URL || process.env.VOBIZ_WEBHOOK_URL || process.env.NEXT_PUBLIC_SERVER_URL || "";
    try {
      const fs = await import("fs");
      const path = await import("path");
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const mBase = envContent.match(/PUBLIC_BASE_URL=([^\r\n]+)/);
        if (mBase && mBase[1]) webhookUrl = mBase[1].replace(/["']/g, "").trim();
        const m = envContent.match(/VOBIZ_WEBHOOK_URL=([^\r\n]+)/);
        if (m && m[1] && !webhookUrl) webhookUrl = m[1].replace(/["']/g, "").trim();
        const mAuth = envContent.match(/VOBIZ_AUTH_ID=([^\r\n]+)/);
        if (mAuth && mAuth[1] && !vobizAuthId) vobizAuthId = mAuth[1].replace(/["']/g, "").trim();
        const mTok = envContent.match(/VOBIZ_AUTH_TOKEN=([^\r\n]+)/);
        if (mTok && mTok[1] && !vobizAuthToken) vobizAuthToken = mTok[1].replace(/["']/g, "").trim();
      }
    } catch {}

    webhookUrl = webhookUrl.replace(/\/+$/, "");

    // ─── Section 12: Pre-Call Readiness Check ─────────────────────────────
    if (!vobizAuthId || !vobizAuthToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Telephony provider credentials (VOBIZ_AUTH_ID / VOBIZ_AUTH_TOKEN) are missing. Cannot dispatch call.",
        },
        { status: 500 }
      );
    }

    if (!webhookUrl || webhookUrl.includes("localhost") || webhookUrl.includes("127.0.0.1") || !webhookUrl.startsWith("http")) {
      return NextResponse.json(
        {
          success: false,
          error: `PUBLIC_BASE_URL is invalid or pointing to localhost (${webhookUrl || 'empty'}). Cloud carrier requires a publicly accessible HTTPS URL.`,
        },
        { status: 500 }
      );
    }

    // Ping the webhook domain to verify reachability and avoid 502 Bad Gateway calls
    try {
      const pingController = new AbortController();
      const pingTimeout = setTimeout(() => pingController.abort(), 2500);
      const pingRes = await fetch(`${webhookUrl}/api/vobiz/call-status`, {
        method: "GET",
        signal: pingController.signal,
      });
      clearTimeout(pingTimeout);
      if (!pingRes.ok && pingRes.status >= 500) {
        return NextResponse.json(
          {
            success: false,
            error: `Public base URL (${webhookUrl}) returned HTTP ${pingRes.status} (Gateway Error). Carrier will not be able to connect audio.`,
          },
          { status: 502 }
        );
      }
    } catch (pingErr: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Public base URL (${webhookUrl}) is unreachable (${pingErr.message}). Verify your public domain or tunnel is running.`,
        },
        { status: 502 }
      );
    }

    const callNumber = `#${Math.floor(10000 + Math.random() * 90000)}`;
    const callId = `call_${Date.now()}`;
    let vobizCallId = `vobiz_${Date.now()}`;
    let telephonyStatus = "INITIATING";
    let telephonyReason = "";
    let telephonyDetails = "";

    // ─── 1. Dispatch outbound call via Vobiz REST API ────────────────────
    // When the callee answers, Vobiz will POST to our answer_url
    // Our answer_url returns XML telling Vobiz to stream audio to our WebSocket
    if (vobizAuthId && vobizAuthToken) {
      try {
        const vobizApiUrl = `https://api.vobiz.ai/api/v1/Account/${vobizAuthId}/Call/`;
        const answerUrl = `${webhookUrl}/api/vobiz/incoming-call?agentId=${encodeURIComponent(resolvedAgentId)}&callerNumber=${encodeURIComponent(cleanNumber)}`;

        console.log(`[VOBIZ API] Calling ${cleanNumber} from ${outboundCallerId} (agent: ${agentName}, id: ${resolvedAgentId})`);
        console.log(`[VOBIZ API] answer_url: ${answerUrl}`);

        const vobizRes = await fetch(vobizApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-ID": vobizAuthId,
            "X-Auth-Token": vobizAuthToken,
          },
          body: JSON.stringify({
            from: outboundCallerId,
            to: cleanNumber,
            answer_url: answerUrl,
            answer_method: "POST",
            hangup_url: `${webhookUrl}/api/vobiz/call-status`,
            hangup_method: "POST",
          }),
        });

        const vobizData = await vobizRes.json();
        console.log(`[VOBIZ API] Response (${vobizRes.status}):`, JSON.stringify(vobizData));

        if (vobizRes.ok && (vobizData.request_uuid || vobizData.call_uuid || vobizData.api_id)) {
          vobizCallId = vobizData.request_uuid || vobizData.call_uuid || vobizCallId;
          telephonyStatus = "RINGING";
          telephonyReason = "Call initiated via Vobiz REST API";
          telephonyDetails = `API response: ${JSON.stringify(vobizData)}`;
        } else {
          telephonyStatus = "FAILED";
          telephonyReason = vobizData.error || vobizData.message || `HTTP ${vobizRes.status}`;
          telephonyDetails = JSON.stringify(vobizData);
          console.error("[VOBIZ API] Call failed:", telephonyReason);
        }
      } catch (apiErr) {
        telephonyStatus = "FAILED";
        telephonyReason = apiErr instanceof Error ? apiErr.message : "Vobiz API error";
        console.error("[VOBIZ API] Error:", telephonyReason);
      }
    } else {
      // Fallback to raw SIP if no API credentials
      try {
        const { dispatchVobizOutboundCall } = await import("@/lib/telephony/vobiz");
        const dispatchResult = await dispatchVobizOutboundCall(cleanNumber, outboundCallerId);
        vobizCallId = dispatchResult.vobizCallId;
        telephonyStatus = dispatchResult.telephonyStatus;
        telephonyReason = dispatchResult.reason || "";
        telephonyDetails = dispatchResult.details || "";
      } catch (sipErr) {
        telephonyStatus = "FAILED";
        telephonyReason = sipErr instanceof Error ? sipErr.message : "SIP dispatch error";
      }
    }

    // ─── 2. Create Call Log in Store & Neon PostgreSQL ────────────────────
    const newCall: CallItem = {
      id: callId,
      callNumber,
      callerNumber: cleanNumber,
      agentId: agent.id,
      agentName,
      direction: CallDirection.OUTBOUND,
      status: telephonyStatus === "FAILED" ? CallStatus.FAILED : CallStatus.INITIALIZING,
      stage: telephonyStatus === "FAILED" ? "FAILED" : "RINGING",
      vobizCallId,
      cartesiaAgentId,
      lastSuccessfulStage: telephonyStatus === "FAILED" ? "FAILED" : "TELEPHONY_CREATED",
      mediaConnected: false,
      cartesiaConnected: false,
      startedAt: new Date().toISOString(),
      durationSeconds: 0,
      language: "Telugu + English",
      estimatedCost: 1.5,
      currency: "INR",
      summary: {
        summary: `రియల్ ఇండియన్ నంబర్ ${cleanNumber} కి అవుట్‌బౌండ్ కాల్ ప్రారంభించబడింది. వాయిస్ ఏజెంట్ ${agentName} సంభాషణకు సిద్ధంగా ఉంది.`,
        customerIntent: "రియల్ కాల్ సంభాషణ",
        outcome: "కాల్ కనెక్ట్ చేయబడింది",
        importantInfo: `కాలర్: ${cleanNumber} • Vobiz: ${outboundCallerId}`,
        followUpRequired: false,
      },
      transcripts: [
        {
          id: `t_${Date.now()}`,
          role: MessageRole.AI,
          content: `నమస్కారం అండి! నేను ${agentName} నుండి మాట్లాడుతున్నాను. మీకు ఏ విధంగా సహాయపడగలను?`,
          normalizedText: `నమస్కారం అండి! నేను ${agentName} నుండి మాట్లాడుతున్నాను. మీకు ఏ విధంగా సహాయపడగలను?`,
          timestampMs: 800,
          ttsLatencyMs: 110,
        },
      ],
      usage: {
        sttAudioSeconds: 0,
        llmInputTokens: 120,
        llmOutputTokens: 45,
        ttsCharacters: 88,
        vobizCost: 1.25,
        sarvamCost: 0.15,
        openaiCost: 0.05,
        cartesiaCost: 0.05,
        infraCost: 0.1,
      },
      isDemo: false,
    };

    dataStore.addCall(newCall);

    // Save into Neon PostgreSQL
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const org = await prisma.organization.findFirst();
      if (org) {
        await prisma.call.create({
          data: {
            organizationId: org.id,
            agentId: agent?.id,
            vobizCallId,
            callerNumber: cleanNumber,
            agentNumber: outboundCallerId,
            direction: CallDirection.OUTBOUND,
            status: CallStatus.ACTIVE,
            durationSeconds: 0,
            totalCost: 1.5,
          },
        });
      }
    } catch (dbErr) {
      console.warn("Could not write call to Postgres, kept in store:", dbErr);
    }

    return NextResponse.json({
      success: telephonyStatus !== "FAILED",
      error: telephonyStatus === "FAILED" ? telephonyReason : undefined,
      call: newCall,
      telephony: {
        outboundNumber: outboundCallerId,
        destinationNumber: cleanNumber,
        status: telephonyStatus,
        vobizCallId,
        reason: telephonyReason,
        details: telephonyDetails,
        publicUrl: webhookUrl,
        carrier: "Vobiz",
      },
      message: telephonyStatus === "FAILED"
        ? `Call failed: ${telephonyReason}`
        : `Placing outbound call to ${cleanNumber} via Vobiz. Agent will greet when call connects.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error initiating outbound call" },
      { status: 500 }
    );
  }
}
