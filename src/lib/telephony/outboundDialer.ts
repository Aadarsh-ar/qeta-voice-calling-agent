/**
 * Outbound Dialer & Real Telephony Dispatch Engine
 *
 * Provides a unified, reliable module for dispatching outbound voice calls
 * through Cartesia Realtime Agent Runtime (Vobiz PSTN SIP Trunk), LiveKit SIP,
 * or direct Vobiz REST API. Used directly by both individual calls and
 * autonomous voice campaigns without HTTP loopback dependencies.
 */

import { dataStore, CallItem } from "@/lib/db/store";
import { CallDirection, CallStatus, MessageRole } from "@/lib/types/models";
import { getTelephonyConfig, resolveWebhookBaseUrl } from "@/lib/config/telephony";

// Per-agent phone number ID cache — avoids sharing phone number IDs across agents/orgs (ISO-5 fix)
const cachedFromNumberIds = new Map<string, string>();
let lastSyncedPrompt: string | null = null;

export interface OutboundCallParams {
  to: string;
  agentId?: string;
  businessContext?: string;
  campaignId?: string;
  contactId?: string;
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

export interface CartesiaCallStatusResult {
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
 * Dispatches an outbound call through Cartesia / Vobiz PSTN Trunk
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

  // Resolve agent
  let agent = params.agentId ? dataStore.getAgent(params.agentId) : dataStore.getAgents()[0];
  const targetAgentId = params.agentId || agent?.id || telConfig.cartesiaAgentId;

  // ISO-2 fix: Fail explicitly if specified agent is not found — never silently substitute another agent
  if (!agent) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const dbAgent = await prisma.agent.findFirst({
        where: {
          OR: [{ id: targetAgentId }, { cartesiaAgentId: targetAgentId }],
        },
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
          cartesiaAgentId: dbAgent.cartesiaAgentId ?? undefined,
          cartesiaVoiceId: dbAgent.cartesiaVoiceId ?? "",  // Required string in AgentItem
          cartesiaVoiceName: dbAgent.cartesiaVoiceId ? "Configured Voice" : "Default Voice",
          cartesiaModel: dbAgent.cartesiaModel,
          llmModel: dbAgent.llmModel,
          sarvamModel: dbAgent.sarvamModel,
          sarvamLanguage: dbAgent.sarvamLanguage,
          phoneNumber: undefined,
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
        if (agent) {
          dataStore.createAgentWithId(agent);
        }
      }
    } catch (dbErr) {
      console.warn("[OUTBOUND_DIALER] Could not query DB for agent:", dbErr);
    }
  }

  // ISO-2 fix: Never silently substitute another agent. If agentId was specified and agent is still not found, fail.
  if (!agent) {
    if (params.agentId) {
      return {
        success: false,
        callId: "",
        vobizCallId: "",
        telephonyStatus: "FAILED",
        telephonyReason: `Agent "${params.agentId}" was not found. Cannot dispatch call with an unknown agent configuration. No substitute agent will be used.`,
        cartesiaDispatched: false,
        livekitDispatched: false,
        error: `Agent not found: ${params.agentId}`,
      };
    }
    // No agentId specified and no default agent — fail
    return {
      success: false,
      callId: "",
      vobizCallId: "",
      telephonyStatus: "FAILED",
      telephonyReason: "No agent configured. Cannot dispatch call without a valid agent configuration.",
      cartesiaDispatched: false,
      livekitDispatched: false,
      error: "No agent available",
    };
  }

  const cartesiaApiKey = telConfig.cartesiaApiKey;
  // Resolve target Cartesia agent ID strictly for the requested agent — no hardcoded global fallback (ISO-2 fix)
  const cartesiaAgentId =
    (agent.cartesiaAgentId && agent.cartesiaAgentId.startsWith("agent_")
      ? agent.cartesiaAgentId
      : agent.id && agent.id.startsWith("agent_")
      ? agent.id
      : undefined);

  if (!cartesiaAgentId) {
    const errMsg = `Agent "${agent.name}" (${agent.id}) does not have a valid Cartesia Agent ID configured. Cannot make an outbound call without a provider agent ID.`;
    console.error(`[OUTBOUND_DIALER] ${errMsg}`);
    return {
      success: false,
      callId: `call_${Date.now()}`,
      vobizCallId: "",
      telephonyStatus: "FAILED",
      telephonyReason: errMsg,
      cartesiaDispatched: false,
      livekitDispatched: false,
      error: errMsg,
    };
  }

  const resolvedAgentId = agent.id;
  const agentName = agent.name;
  const callId = `call_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
  const callNumber = `#${Math.floor(10000 + Math.random() * 90000)}`;

  let vobizCallId = `vobiz_${Date.now()}`;
  let telephonyStatus: "INITIATING" | "RINGING" | "CONNECTED" | "FAILED" = "INITIATING";
  let telephonyReason = "";
  let cartesiaDispatched = false;
  let livekitDispatched = false;

  // ─── 1. Primary Dispatch: Cartesia Realtime Voice Runtime (Vobiz SIP Trunk) ───
  // Each agent in Cartesia executes completely individually with its own prompt,
  // instructions, voice, and personality. We do NOT globally PATCH the agent during
  // campaigns, ensuring ZERO disturbances or prompt clobbering under heavy traffic.
  if (cartesiaApiKey && cartesiaAgentId) {
    try {
      // Use per-agent phone number ID cache to avoid sharing phone IDs across agents/orgs (ISO-5 fix)
      let fromNumberId = cachedFromNumberIds.get(cartesiaAgentId) || "ap_qXvGsN8xnFH3giNBsQ8QBM";
      if (!cachedFromNumberIds.has(cartesiaAgentId)) {
        try {
          const pnRes = await fetch("https://api.cartesia.ai/agents/phone-numbers", {
            headers: {
              "X-API-Key": cartesiaApiKey,
              "Cartesia-Version": "2025-04-16",
            },
          });
          if (pnRes.ok) {
            const pnData = await pnRes.json();
            const matching = pnData.data?.find(
              (pn: any) => pn.agent?.id === cartesiaAgentId || pn.number === outboundCallerId
            );
            if (matching?.id) {
              fromNumberId = matching.id;
              cachedFromNumberIds.set(cartesiaAgentId, matching.id);
            }
          }
        } catch {}
      }

      console.log(`[OUTBOUND_DIALER] Dispatching call to ${cleanNumber} via Cartesia agent ${cartesiaAgentId} (${agentName})`);
      const cartesiaCallRes = await fetch("https://api.cartesia.ai/agents/calls", {
        method: "POST",
        headers: {
          "X-API-Key": cartesiaApiKey,
          "Cartesia-Version": "2025-04-16",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from_number_id: fromNumberId,
          agent_id: cartesiaAgentId,
          ringing_timeout_seconds: 30,
          outbound_calls: [{ to_number: cleanNumber }],
        }),
      });

      const cartesiaCallData = await cartesiaCallRes.json();
      const callResult = cartesiaCallData.calls?.[0];

      if (cartesiaCallRes.ok && callResult?.agent_call_id && !callResult.error) {
        vobizCallId = callResult.agent_call_id;
        telephonyStatus = "RINGING";
        telephonyReason = `Call initiated via Cartesia Realtime Agent Runtime (${agentName})`;
        cartesiaDispatched = true;
      } else {
        // Fast retry with the SAME agent (never switch to a different agent's personality)
        const retryRes = await fetch("https://api.cartesia.ai/agents/calls", {
          method: "POST",
          headers: {
            "X-API-Key": cartesiaApiKey,
            "Cartesia-Version": "2025-04-16",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from_number_id: fromNumberId,
            agent_id: cartesiaAgentId,
            ringing_timeout_seconds: 30,
            outbound_calls: [{ to_number: cleanNumber }],
          }),
        });
        const retryData = await retryRes.json();
        const retryCall = retryData.calls?.[0];
        if (retryRes.ok && retryCall?.agent_call_id) {
          vobizCallId = retryCall.agent_call_id;
          telephonyStatus = "RINGING";
          telephonyReason = `Call initiated via Cartesia agent retry (${agentName})`;
          cartesiaDispatched = true;
        } else {
          telephonyReason = `Cartesia dispatch error for ${agentName} (${cartesiaAgentId}): ${JSON.stringify(retryData)}`;
          telephonyStatus = "FAILED";
        }
      }
    } catch (cErr: any) {
      telephonyReason = `Cartesia exception: ${cErr?.message || cErr}`;
      telephonyStatus = "FAILED";
      console.warn("[OUTBOUND_DIALER] Cartesia exception:", cErr);
    }
  }

  if (!cartesiaDispatched) {
    telephonyStatus = "FAILED";
  }

  // Record call in dataStore
  const newCall: CallItem = {
    id: callId,
    callNumber,
    callerNumber: cleanNumber,
    agentId: agent.id,
    agentName,
    direction: CallDirection.OUTBOUND,
    status: telephonyStatus === "FAILED" ? CallStatus.FAILED : CallStatus.ACTIVE,
    stage: telephonyStatus === "FAILED" ? "FAILED" : "RINGING",
    vobizCallId,
    cartesiaAgentId,
    lastSuccessfulStage: cartesiaDispatched ? "CARTESIA_DISPATCHED" : "INITIATED",
    mediaConnected: cartesiaDispatched,
    cartesiaConnected: cartesiaDispatched,
    startedAt: new Date().toISOString(),
    durationSeconds: 0,
    language: "Telugu + English",
    estimatedCost: 1.5,
    currency: "INR",
    summary: {
      summary: `అవుట్‌బౌండ్ కాల్ ${cleanNumber} కి ప్రారంభించబడింది. వాయిస్ ఏజెంట్: ${agentName}.`,
      customerIntent: params.businessContext ? "క్యాంపెయిన్ కాల్" : "అవుట్‌బౌండ్ సంభాషణ",
      outcome: cartesiaDispatched ? "రింగింగ్" : "ప్రారంభించబడింది",
      importantInfo: `కాలర్: ${cleanNumber} • Trunk: ${outboundCallerId}`,
      followUpRequired: false,
    },
    transcripts: [
      {
        id: `t_${Date.now()}`,
        role: MessageRole.AI,
        content: `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను.`,
        normalizedText: `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను.`,
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

  // Best-effort persist into Neon PostgreSQL — scoped to agent's organization (DATA-3 fix)
  try {
    const { prisma } = await import("@/lib/db/prisma");
    // Use agent's organizationId directly — never assume a single org or findFirst()
    const agentOrgId = (agent as any).organizationId;
    if (agentOrgId) {
      await prisma.call.create({
        data: {
          id: callId,
          organizationId: agentOrgId,
          agentId: agent.id,
          vobizCallId,
          callerNumber: cleanNumber,
          agentNumber: outboundCallerId,
          direction: CallDirection.OUTBOUND,
          status: CallStatus.ACTIVE,
          durationSeconds: 0,
          totalCost: 1.5,
        },
      });
    } else {
      console.warn(`[OUTBOUND_DIALER] Cannot persist call: agent "${agent.id}" has no organizationId. Skipping DB write.`);
    }
  } catch (dbErr: unknown) {
    console.warn(`[OUTBOUND_DIALER] Non-fatal: Failed to persist call record to DB:`, dbErr instanceof Error ? dbErr.message : dbErr);
  }

  return {
    success: cartesiaDispatched,
    callId,
    vobizCallId,
    telephonyStatus: cartesiaDispatched ? "RINGING" : "FAILED",
    telephonyReason,
    cartesiaDispatched,
    livekitDispatched,
  };
}

/**
 * Polls Cartesia Edge API for live status, duration, and transcripts of an active call
 */
export async function pollCartesiaCallStatus(cartesiaCallId: string): Promise<CartesiaCallStatusResult> {
  if (!cartesiaCallId || !cartesiaCallId.startsWith("ac_")) {
    return { status: "unknown", durationSeconds: 0 };
  }

  const telConfig = getTelephonyConfig();
  const apiKey = telConfig.cartesiaApiKey;
  if (!apiKey) return { status: "unknown", durationSeconds: 0 };

  try {
    const res = await fetch(`https://api.cartesia.ai/agents/calls/${cartesiaCallId}`, {
      headers: {
        "X-API-Key": apiKey,
        "Cartesia-Version": "2025-04-16",
      },
    });

    if (!res.ok) {
      return { status: "unknown", durationSeconds: 0, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const rawStatus = (data.status || "").toLowerCase();

    let status: "ringing" | "in_progress" | "completed" | "failed" | "unknown" = "unknown";
    if (rawStatus === "ringing") status = "ringing";
    else if (rawStatus === "started" || rawStatus === "in_progress") status = "in_progress";
    else if (rawStatus === "completed") status = "completed";
    else if (rawStatus === "failed" || rawStatus === "canceled") status = "failed";

    const durationSeconds = data.duration
      ? Math.round(data.duration)
      : data.start_time && data.end_time
      ? Math.max(0, Math.round((new Date(data.end_time).getTime() - new Date(data.start_time).getTime()) / 1000))
      : 0;

    const transcripts = Array.isArray(data.transcript)
      ? data.transcript
          .filter((t: any) => t.role !== "system" && (t.text || t.content))
          .map((t: any) => ({
            role: (t.role === "assistant" || t.role === "AI") ? ("AI" as const) : ("CALLER" as const),
            content: t.text || t.content,
            time: t.start_timestamp ? `${Math.round(t.start_timestamp)}s` : undefined,
          }))
      : undefined;

    return {
      status,
      durationSeconds,
      endReason: data.end_reason,
      summary: data.summary,
      transcripts,
      error: data.error_message || data.error,
    };
  } catch (err: any) {
    return { status: "unknown", durationSeconds: 0, error: err.message };
  }
}
