import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { CallStatus, MessageRole } from "@/lib/types/models";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const call = dataStore.getCall(id);
  if (!call) {
    return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
  }

  // If call was placed via Cartesia runtime, pull live status & transcript
  if (call.vobizCallId && call.vobizCallId.startsWith("ac_")) {
    const apiKey = process.env.CARTESIA_API_KEY || "";
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

