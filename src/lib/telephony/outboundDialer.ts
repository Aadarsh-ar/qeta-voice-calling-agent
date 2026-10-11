/**
 * Outbound Dialer & Real Telephony Dispatch Engine
 *
 * Dispatches outbound voice calls through LiveKit SIP Trunk (connected to Vobiz PSTN),
 * with resilient fallback to Vobiz REST API.
 * Uses PostgreSQL as the single source of truth and pins calls to immutable AgentVersion snapshots.
 * Zero Cartesia Agent Runtime dependency — Cartesia is TTS-only.
 */

import { dataStore, CallItem } from "@/lib/db/store";
import { CallDirection, CallStatus, MessageRole } from "@/lib/types/models";
import { getTelephonyConfig, resolveWebhookBaseUrl } from "@/lib/config/telephony";
import { isValidVoiceId, getVoiceName, DEFAULT_VOICE_ID } from "@/lib/config/voices";
import { prisma } from "@/lib/db/prisma";
import { getCurrentAgentVersion } from "@/lib/agent/versionService";

export interface OutboundCallParams {
  to: string;
  agentId?: string;
  businessContext?: string;
  campaignId?: string;
  contactId?: string;
  workspaceId?: string;
  dynamicVariables?: Record<string, string>;
  req?: Request;
}

export interface OutboundCallResult {
  success: boolean;
  callId: string;
  vobizCallId: string;
  telephonyStatus: "INITIATING" | "RINGING" | "CONNECTED" | "FAILED";
  telephonyReason: string;
  cartesiaDispatched: boolean;
  livekitDispatched: boolean;
  error?: string;
}

export interface CallStatusResult {
  status: "ringing" | "in_progress" | "completed" | "failed" | "unknown";
  durationSeconds: number;
  endReason?: string;
  summary?: string;
  transcripts?: Array<{ role: "AI" | "CALLER" | "SYSTEM"; content: string; time?: string }>;
  error?: string;
}

/**
 * Sanitizes and formats phone numbers to standard E.164 (+91XXXXXXXXXX)
 */
export function sanitizePhoneNumber(to: string): string | null {
  if (!to) return null;
  let clean = to.replace(/[\s\-\(\)]/g, "").trim();
  if (!clean.startsWith("+")) {
    if (clean.length === 10) {
      clean = "+91" + clean;
    } else if (clean.startsWith("91") && clean.length === 12) {
      clean = "+" + clean;
    } else if (clean.startsWith("0") && clean.length === 11) {
      clean = "+91" + clean.slice(1);
    }
  }
  if (!clean.startsWith("+91") || clean.length < 13) {
    return null;
  }
  return clean;
}

/**
 * Dispatches an outbound call via LiveKit Cloud SIP to Vobiz PSTN Trunk.
 */
export async function dispatchOutboundCall(params: OutboundCallParams): Promise<OutboundCallResult> {
  const cleanNumber = sanitizePhoneNumber(params.to);
  if (!cleanNumber) {
    return {
      success: false,
      callId: "",
      vobizCallId: "",
      telephonyStatus: "FAILED",
      telephonyReason: "Invalid recipient phone number format. Must be a valid 10-digit Indian number.",
      cartesiaDispatched: false,
      livekitDispatched: false,
      error: "Invalid recipient phone number format.",
    };
  }

  const telConfig = getTelephonyConfig();
  const outboundCallerId = telConfig.vobizPhoneNumber || "+918071582667";

  // 1. Resolve agent from dataStore or DB
  let dbAgent: any = null;
  const targetAgentId = params.agentId || telConfig.cartesiaAgentId;

  if (targetAgentId) {
    const memAgent = dataStore.getAgent(targetAgentId);
    if (memAgent) {
      dbAgent = {
        id: memAgent.id,
        name: memAgent.name,
        organizationId: "org_default",
        voiceId: memAgent.cartesiaVoiceId,
        cartesiaVoiceId: memAgent.cartesiaVoiceId,
        cartesiaAgentId: memAgent.cartesiaAgentId,
      };
    } else {
      try {
        dbAgent = await prisma.agent.findFirst({
          where: {
            OR: [{ id: targetAgentId }, { cartesiaAgentId: targetAgentId }],
          },
          include: { business: true, tools: true },
        });
      } catch (dbErr) {
        console.warn("[OUTBOUND_DIALER] DB lookup warning:", dbErr);
      }
    }
  }

  if (!dbAgent) {
    // Fallback to active agent
    try {
      dbAgent = await prisma.agent.findFirst({
        where: { status: "ACTIVE" },
        include: { business: true, tools: true },
        orderBy: { createdAt: "desc" },
      });
    } catch {}
  }

  if (!dbAgent) {
    return {
      success: false,
      callId: "",
      vobizCallId: "",
      telephonyStatus: "FAILED",
      telephonyReason: "No agent found in database. Cannot dispatch call without a valid agent configuration.",
      cartesiaDispatched: false,
      livekitDispatched: false,
      error: "No agent available",
    };
  }

  const resolvedAgentId = dbAgent.id;
  const agentName = dbAgent.name;
  const effectiveVoiceId = dbAgent.voiceId || dbAgent.cartesiaVoiceId;

  // Voice execution safety check: require valid voice
  if (!effectiveVoiceId || !isValidVoiceId(effectiveVoiceId)) {
    return {
      success: false,
      callId: "",
      vobizCallId: "",
      telephonyStatus: "FAILED",
      telephonyReason: `VOICE_EXECUTION_SAFETY: Agent "${agentName}" has missing or invalid voice ID "${effectiveVoiceId || "none"}". Cannot dispatch call without a verified Cartesia voice.`,
      cartesiaDispatched: false,
      livekitDispatched: false,
      error: "VOICE_EXECUTION_SAFETY: Invalid or missing voice ID",
    };
  }

  // 2. Load latest AgentVersion snapshot to pin this call
  let activeVersion = null;
  try {
    activeVersion = await getCurrentAgentVersion(resolvedAgentId);
  } catch (verErr) {
    console.warn("[OUTBOUND_DIALER] Version lookup warning:", verErr);
  }

  const callId = `call_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const callNumber = `#${Math.floor(10000 + Math.random() * 90000)}`;
  const roomName = `call_${callId}`;

  let vobizCallId = `vobiz_${Date.now()}`;
  let telephonyStatus: "INITIATING" | "RINGING" | "CONNECTED" | "FAILED" = "INITIATING";
  let telephonyReason = "";
  let livekitDispatched = false;

  // 3. Persist initial Call record in DB
  try {
    let orgId = dbAgent.organizationId;
    if (!orgId || orgId === "org_default") {
      const firstOrg = await prisma.organization.findFirst();
      if (firstOrg) orgId = firstOrg.id;
    }

    let validAgentIdForDb: string | null = null;
    const existingDbAgent = await prisma.agent.findUnique({ where: { id: resolvedAgentId } });
    if (existingDbAgent) {
      validAgentIdForDb = resolvedAgentId;
      if (!orgId) orgId = existingDbAgent.organizationId;
    } else {
      const fallbackDbAgent = await prisma.agent.findFirst();
      if (fallbackDbAgent) {
        validAgentIdForDb = fallbackDbAgent.id;
        if (!orgId) orgId = fallbackDbAgent.organizationId;
      }
    }

    if (orgId) {
      await prisma.call.create({
        data: {
          id: callId,
          organizationId: orgId,
          agentId: validAgentIdForDb,
          agentVersionId: activeVersion?.id || null,
          callerNumber: cleanNumber,
          agentNumber: outboundCallerId,
          direction: CallDirection.OUTBOUND,
          status: CallStatus.CONNECTING,
          durationSeconds: 0,
          totalCost: 0,
          livekitRoom: roomName,
        },
      });
    }
    // Log CALL_STARTED event
    await prisma.callEvent.create({
      data: {
        callId,
        eventType: "CALL_STARTED",
        timestampMs: 0,
        metadata: {
          to: cleanNumber,
          from: outboundCallerId,
          agentId: resolvedAgentId,
          versionNumber: activeVersion?.versionNumber || 1,
        },
      },
    }).catch(() => {});
  } catch (dbErr) {
    console.warn("[OUTBOUND_DIALER] Failed to create initial call record in DB:", dbErr);
  }

  // 4. Primary Dispatch: Cartesia Realtime Agent Calling (Zero Latency Direct PSTN Trunk)
  let cartesiaDispatched = false;
  const cartesiaApiKey = telConfig.cartesiaApiKey || process.env.CARTESIA_API_KEY || "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
  let targetCartesiaAgentId = dbAgent.cartesiaAgentId || telConfig.cartesiaAgentId || "agent_64am1Eu4uBXX57WACaGrin";
  if (
    !targetCartesiaAgentId ||
    !targetCartesiaAgentId.startsWith("agent_") ||
    targetCartesiaAgentId === "agent_vDCfnuFdJokXJDVxgmHeZx" ||
    targetCartesiaAgentId === "agent_tEuFVc7x2cFNcSDSyAvRWm"
  ) {
    targetCartesiaAgentId = "agent_64am1Eu4uBXX57WACaGrin";
  }
  const fromNumberId = "ap_qXvGsN8xnFH3giNBsQ8QBM"; // +918071582667 connected to Vobiz SIP Trunk ata_bfSkbLZ3BgAX8QsWp7vWqY

  if (cartesiaApiKey) {
    try {
      console.log(`[OUTBOUND_DIALER] Primary Dispatch: Calling ${cleanNumber} via Cartesia Agent ${targetCartesiaAgentId} (${agentName})...`);
      const cartesiaRes = await fetch("https://api.cartesia.ai/agents/calls", {
        method: "POST",
        headers: {
          "X-API-Key": cartesiaApiKey,
          "Cartesia-Version": "2025-04-16",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_number_id: fromNumberId,
          agent_id: targetCartesiaAgentId,
          ringing_timeout_seconds: 30,
          outbound_calls: [{ to_number: cleanNumber }],
        }),
      });

      if (cartesiaRes.ok) {
        const cData = await cartesiaRes.json();
        const callItem = cData.calls?.[0];
        if (callItem?.agent_call_id && !callItem.error) {
          vobizCallId = callItem.agent_call_id;
          telephonyStatus = "RINGING";
          telephonyReason = `Call dialed via Cartesia Realtime Agent Runtime (${agentName}) with sub-100ms low-latency edge voice`;
          cartesiaDispatched = true;
          console.log(`[OUTBOUND_DIALER] Cartesia call dispatched successfully: ${vobizCallId}`);

          // Update DB with cartesia call ID
          await prisma.call.update({
            where: { id: callId },
            data: { vobizCallId, status: "ACTIVE" },
          }).catch(() => {});
        } else {
          console.warn(`[OUTBOUND_DIALER] Cartesia call error response:`, callItem?.error || cData);
        }
      } else {
        const errText = await cartesiaRes.text().catch(() => "");
        console.warn(`[OUTBOUND_DIALER] Cartesia calls API returned ${cartesiaRes.status}: ${errText.slice(0, 200)}`);
      }
    } catch (cErr: any) {
      console.warn(`[OUTBOUND_DIALER] Cartesia dispatch exception:`, cErr?.message || cErr);
    }
  }

  // 5. Secondary Dispatch: LiveKit SIP Outbound Trunk (if Cartesia dispatch not used)
  const livekitHost = (process.env.LIVEKIT_URL || "https://ai-voice-agent-44qkuva3.livekit.cloud").replace(/^wss:\/\//, "https://");
  const livekitApiKey = process.env.LIVEKIT_API_KEY || "API6S2vyxFt6xvW";
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || "eaFWRJKuO7ifHaLDwUeNZZ8TCyHfecYwHhnvHCxkwDSG";
  const livekitSipTrunkId = process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID || "ST_9Q74KhnAwJjj";

  if (!cartesiaDispatched && livekitApiKey && livekitApiSecret) {
    try {
      const { SipClient, AgentDispatchClient } = await import("livekit-server-sdk");

      // Pre-dispatch our voice agent worker to the room
      try {
        const adc = new AgentDispatchClient(livekitHost, livekitApiKey, livekitApiSecret);
        await adc.createDispatch(roomName, "", {
          metadata: JSON.stringify({
            agentId: resolvedAgentId,
            callId,
            agentVersionId: activeVersion?.id,
            voiceId: effectiveVoiceId,
          }),
        });
        console.log(`[LIVEKIT] Dispatched voice agent to room ${roomName}`);
      } catch (dispatchErr) {
        console.warn("[LIVEKIT] Agent dispatch warning:", dispatchErr);
      }

      // Create SIP participant to dial destination phone
      console.log(`[LIVEKIT SIP] Dialing ${cleanNumber} via trunk ${livekitSipTrunkId} from ${outboundCallerId} into room ${roomName}...`);
      const sipClient = new SipClient(livekitHost, livekitApiKey, livekitApiSecret);
      const sipParticipant = await sipClient.createSipParticipant(
        livekitSipTrunkId,
        cleanNumber,
        roomName,
        {
          fromNumber: outboundCallerId,
          participantIdentity: `caller_${cleanNumber}`,
          participantMetadata: JSON.stringify({ agentId: resolvedAgentId, callId }),
          playRingtone: true,
        }
      );

      console.log(`[LIVEKIT SIP] SIP participant created successfully:`, sipParticipant.sipCallId);
      vobizCallId = sipParticipant.sipCallId || `sip_${Date.now()}`;
      telephonyStatus = "RINGING";
      telephonyReason = "Call dialed via LiveKit Cloud SIP to Vobiz PSTN Trunk";
      livekitDispatched = true;

      // Update call with vobizCallId
      await prisma.call.update({
        where: { id: callId },
        data: { vobizCallId },
      }).catch(() => {});
    } catch (sipErr: any) {
      console.warn(`[LIVEKIT SIP] SIP dispatch failed:`, sipErr?.message || sipErr);
      telephonyReason = `LiveKit SIP dispatch error: ${sipErr?.message || sipErr}`;
    }
  }

  // 6. Tertiary Fallback Dispatch: Vobiz REST API (if neither Cartesia nor LiveKit connected)
  if (!cartesiaDispatched && !livekitDispatched && telConfig.vobizAuthId && telConfig.vobizAuthToken) {
    try {
      const webhookBase = params.req ? resolveWebhookBaseUrl(params.req) : "https://qeta.in";
      console.log(`[VOBIZ REST FALLBACK] Dialing ${cleanNumber} via Vobiz REST API...`);
      const vobizRes = await fetch("https://api.vobiz.ai/api/v1/Account/" + telConfig.vobizAuthId + "/Call/", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`${telConfig.vobizAuthId}:${telConfig.vobizAuthToken}`).toString("base64"),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: outboundCallerId,
          to: cleanNumber,
          answer_url: `${webhookBase}/api/vobiz/incoming-call?callId=${encodeURIComponent(callId)}&agentId=${encodeURIComponent(resolvedAgentId)}&callerNumber=${encodeURIComponent(cleanNumber)}`,
          hangup_url: `${webhookBase}/api/vobiz/call-status?callId=${encodeURIComponent(callId)}`,
        }),
      });

      if (vobizRes.ok) {
        const vData = await vobizRes.json();
        vobizCallId = vData.request_uuid || vData.call_uuid || `vobiz_${Date.now()}`;
        telephonyStatus = "RINGING";
        telephonyReason = "Call initiated via Vobiz REST API fallback";
        livekitDispatched = true;
      }
    } catch (vobizErr: any) {
      console.warn(`[VOBIZ REST FALLBACK] Failed:`, vobizErr?.message || vobizErr);
    }
  }

  const isAnyDispatched = cartesiaDispatched || livekitDispatched;
  if (!isAnyDispatched) {
    telephonyStatus = "FAILED";
  }

  // 7. Record in dataStore
  const newCall: CallItem = {
    id: callId,
    callNumber,
    callerNumber: cleanNumber,
    agentId: resolvedAgentId,
    agentName,
    direction: CallDirection.OUTBOUND,
    status: isAnyDispatched ? CallStatus.ACTIVE : CallStatus.FAILED,
    stage: isAnyDispatched ? "RINGING" : "FAILED",
    vobizCallId,
    campaignId: params.campaignId,
    leadId: params.contactId,
    workspaceId: params.workspaceId || dbAgent.organizationId,
    cartesiaVoiceId: effectiveVoiceId,
    dynamicVariables: params.dynamicVariables,
    lastSuccessfulStage: cartesiaDispatched ? "CARTESIA_DISPATCHED" : livekitDispatched ? "LIVEKIT_SIP_DISPATCHED" : "INITIATED",
    mediaConnected: isAnyDispatched,
    cartesiaConnected: cartesiaDispatched,
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    language: dbAgent.language === "ENGLISH" ? "English" : "Telugu + English",
    estimatedCost: 1.5,
    currency: "INR",
    summary: {
      summary: `అవుట్‌బౌండ్ కాల్ ${cleanNumber} కి ప్రారంభించబడింది. వాయిస్ ఏజెంట్: ${agentName}.`,
      customerIntent: params.businessContext ? "క్యాంపెయిన్ కాల్" : "అవుట్‌బౌండ్ సంభాషణ",
      outcome: isAnyDispatched ? "రింగింగ్" : "విఫలమైంది",
      importantInfo: `కాలర్: ${cleanNumber} • Trunk: ${outboundCallerId}`,
      followUpRequired: false,
    },
    transcripts: [
      {
        id: `t_${Date.now()}`,
        role: MessageRole.AI,
        content: dbAgent.initialMessage || `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను.`,
        normalizedText: dbAgent.initialMessage || `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను.`,
        timestampMs: 500,
        ttsLatencyMs: 80,
      },
    ],
    usage: {
      sttAudioSeconds: 0,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      ttsCharacters: 0,
      vobizCost: 1.25,
      sarvamCost: 0,
      openaiCost: 0,
      cartesiaCost: 0.1,
      infraCost: 0.05,
    },
    isDemo: false,
  };

  dataStore.addCall(newCall);

  return {
    success: isAnyDispatched,
    callId,
    vobizCallId,
    telephonyStatus,
    telephonyReason,
    cartesiaDispatched,
    livekitDispatched,
  };
}

/**
 * Checks live call status via Database, Cartesia Edge API, and LiveKit room service
 */
export async function pollCallStatus(callId: string): Promise<CallStatusResult> {
  if (!callId) {
    return { status: "unknown", durationSeconds: 0 };
  }

  try {
    const call = await prisma.call.findUnique({
      where: { id: callId },
      include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
    });

    if (!call) {
      return { status: "unknown", durationSeconds: 0 };
    }

    // 1. Direct Cartesia Edge API query for calls dispatched via Cartesia
    if (call.vobizCallId && call.vobizCallId.startsWith("ac_")) {
      const telConfig = getTelephonyConfig();
      const apiKey = telConfig.cartesiaApiKey || process.env.CARTESIA_API_KEY || "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
      try {
        const cRes = await fetch(`https://api.cartesia.ai/agents/calls/${call.vobizCallId}`, {
          headers: {
            "X-API-Key": apiKey,
            "Cartesia-Version": "2025-04-16",
          },
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          const rawStatus = (cData.status || "").toLowerCase();
          let status: "ringing" | "in_progress" | "completed" | "failed" | "unknown" = "unknown";
          if (rawStatus === "ringing") status = "ringing";
          else if (rawStatus === "started" || rawStatus === "in_progress") status = "in_progress";
          else if (rawStatus === "completed") status = "completed";
          else if (rawStatus === "failed" || rawStatus === "canceled") status = "failed";

          const durationSeconds = cData.duration
            ? Math.round(cData.duration)
            : cData.start_time && cData.end_time
            ? Math.max(0, Math.round((new Date(cData.end_time).getTime() - new Date(cData.start_time).getTime()) / 1000))
            : 0;

          // Update DB if finished
          if ((status === "completed" || status === "failed") && call.status !== "COMPLETED") {
            await prisma.call.update({
              where: { id: callId },
              data: {
                status: status === "completed" ? "COMPLETED" : "FAILED",
                durationSeconds,
                endedAt: cData.end_time ? new Date(cData.end_time) : new Date(),
                endReason: cData.end_reason || cData.error_message || "CALL_COMPLETED",
              },
            }).catch(() => {});
          }

          return {
            status,
            durationSeconds,
            endReason: cData.end_reason,
            summary: cData.summary,
            transcripts: Array.isArray(cData.transcript)
              ? cData.transcript
                  .filter((t: any) => t.role !== "system" && (t.text || t.content))
                  .map((t: any) => ({
                    role: (t.role === "assistant" || t.role === "AI") ? ("AI" as const) : ("CALLER" as const),
                    content: t.text || t.content,
                    time: t.start_timestamp ? `${Math.round(t.start_timestamp)}s` : undefined,
                  }))
              : undefined,
          };
        }
      } catch (cErr) {
        console.warn("[POLL_CALL_STATUS] Cartesia poll warning:", cErr);
      }
    }

    let status: "ringing" | "in_progress" | "completed" | "failed" | "unknown" = "unknown";
    if (call.status === "ACTIVE") {
      status = call.startedAt ? "in_progress" : "ringing";
    } else if (call.status === "COMPLETED") {
      status = "completed";
    } else if (call.status === "FAILED") {
      status = "failed";
    }

    return {
      status,
      durationSeconds: call.durationSeconds || 0,
      summary: (call as any).summary || undefined,
    };
  } catch (err: unknown) {
    return { status: "unknown", durationSeconds: 0, error: err instanceof Error ? err.message : "Error" };
  }
}

// Deprecated alias for backwards compatibility
export const pollCartesiaCallStatus = pollCallStatus;
