import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { CallStatus, MessageRole } from "@/lib/types/models";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let call = dataStore.getCall(id);
  if (!call) {
    try {
      const { prisma } = await import("@/lib/db/prisma");
      const dbCall = await prisma.call.findFirst({
        where: {
          OR: [{ id }, { vobizCallId: id }],
        },
        include: {
          agent: true,
          agentVersion: true,
          summary: true,
          transcripts: { orderBy: { timestampMs: "asc" } },
        },
      });
      if (dbCall) {
        const agentName = dbCall.agentVersion?.name || dbCall.agent?.name || "Voice Agent";
        const dbTranscripts = dbCall.transcripts.map((t) => ({
          id: t.id,
          role: t.role as any,
          content: t.content,
          normalizedText: t.normalizedText || t.content,
          timestampMs: t.timestampMs,
          ttsLatencyMs: t.ttsLatencyMs || undefined,
        }));

        call = {
          id: dbCall.id,
          callNumber: `#${dbCall.id.slice(-5)}`,
          callerNumber: dbCall.callerNumber,
          agentId: dbCall.agentId || "default",
          agentName,
          direction: dbCall.direction as any,
          status: dbCall.status as any,
          stage: dbCall.status === "ACTIVE" ? "MEDIA_CONNECTED" : "ENDED",
          vobizCallId: dbCall.vobizCallId || "",
          startedAt: dbCall.createdAt.toISOString(),
          durationSeconds: dbCall.durationSeconds || 0,
          language: dbCall.agent?.language === "ENGLISH" ? "English" : "Telugu + English",
          estimatedCost: dbCall.totalCost ? Number(dbCall.totalCost) : 1.5,
          currency: dbCall.currency || "INR",
          summary: {
            summary: dbCall.summary?.summary || "వాయిస్ కాల్ సంభాషణ వివరాలు.",
            customerIntent: dbCall.summary?.customerIntent || "సంభాషణ",
            outcome: dbCall.summary?.outcome || (dbCall.status === "COMPLETED" ? "పూర్తయింది" : "కనెక్ట్ చేయబడింది"),
            importantInfo: dbCall.summary?.importantInfo || `కాలర్: ${dbCall.callerNumber}`,
            followUpRequired: dbCall.summary?.followUpRequired || false,
          },
          transcripts: dbTranscripts.length > 0 ? dbTranscripts : [
            {
              id: `t_${Date.now()}`,
              role: MessageRole.AI,
              content: dbCall.agent?.initialMessage || `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను. మీకు ఏ విధంగా సహాయపడగలను?`,
              normalizedText: dbCall.agent?.initialMessage || `నమస్కారం అండి! నేను ${agentName} మాట్లాడుతున్నాను. మీకు ఏ విధంగా సహాయపడగలను?`,
              timestampMs: 800,
            },
          ],
        };
        if (call) dataStore.addCall(call);
      }
    } catch {}
  }

  if (!call) {
    return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
  }

  // If call was placed via Cartesia runtime, pull live status & transcript
  if (call.vobizCallId && call.vobizCallId.startsWith("ac_")) {
    const { getTelephonyConfig } = await import("@/lib/config/telephony");
    const telConfig = getTelephonyConfig();
    const apiKey = telConfig.cartesiaApiKey;
    if (apiKey) {
      try {
        const cRes = await fetch(`https://api.cartesia.ai/agents/calls/${call.vobizCallId}`, {
          headers: {
            "X-API-Key": apiKey,
            "Cartesia-Version": "2025-04-16",
          },
        });
        if (cRes.ok) {
          const cData = await cRes.json();
          if (cData.status === "completed" || cData.status === "failed") {
            call.status = cData.status === "completed" ? CallStatus.COMPLETED : CallStatus.FAILED;
            call.stage = cData.status === "completed" ? "COMPLETED" : "FAILED";
          } else if (cData.status === "started") {
            call.status = CallStatus.ACTIVE;
            call.stage = "IN_PROGRESS";
          }

          if (cData.duration) {
            call.durationSeconds = Math.round(cData.duration);
          }

          if (cData.summary) {
            call.summary = {
              summary: cData.summary,
              customerIntent: "సంభాషణ వివరాలు",
              outcome: cData.status,
              importantInfo: `Cartesia Call ID: ${call.vobizCallId}`,
              followUpRequired: false,
            };
          }

          if (Array.isArray(cData.transcript) && cData.transcript.length > 0) {
            const mappedTranscripts = cData.transcript
              .filter((t: any) => t.role !== "system" && t.text)
              .map((t: any, idx: number) => ({
                id: `ct_${t.id || idx}`,
                role: t.role === "assistant" ? MessageRole.AI : MessageRole.USER,
                content: t.text,
                normalizedText: t.text,
                timestampMs: Math.round((t.start_timestamp || 0) * 1000),
                ttsLatencyMs: t.tts_ttfb ? Math.round(t.tts_ttfb * 1000) : undefined,
              }));

            if (mappedTranscripts.length > 0) {
              call.transcripts = mappedTranscripts;
            }
          }
        }
      } catch (cErr) {
        console.warn("[CALL_DETAILS] Could not sync with Cartesia API:", cErr);
      }
    }
  }

  return NextResponse.json({ success: true, call });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason = "conversation_completed", context, audioWaitMs = 0 } = body;

    const { endCall, isValidCallStateTransition } = await import("@/lib/telephony/hangupController");

    // Check existing call status in dataStore or DB
    const existingCall = dataStore.getCall(id);
    if (existingCall) {
      if (!isValidCallStateTransition(existingCall.status, CallStatus.ENDING)) {
        console.warn(`[END_CALL_INVALID_STATE] Cannot transition call ${id} from ${existingCall.status} to ENDING`);
        return NextResponse.json({
          success: true,
          status: existingCall.status,
          idempotent: true,
          message: `Call is already in terminal state ${existingCall.status}`,
        });
      }
    }

    const result = await endCall({
      callId: id,
      reason,
      context,
      audioDurationMs: audioWaitMs,
      vobizCallId: existingCall?.vobizCallId,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, reason: result.reason },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      idempotent: Boolean(result.idempotent),
      reason: result.reason,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to terminate call" },
      { status: 500 }
    );
  }
}


