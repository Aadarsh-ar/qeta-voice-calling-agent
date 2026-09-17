import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";
import { CallStatus } from "@/lib/types/models";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({
        success: true,
        state: { stage: "IDLE", active: false },
      });
    }

    // 1. Look up in memory store
    let call = dataStore.getCall(id);

    // 2. Look up in Neon PostgreSQL database if not in memory
    if (!call) {
      try {
        const { prisma } = await import("@/lib/db/prisma");
        const dbCall = await prisma.call.findFirst({
          where: {
            OR: [
              { id },
              { vobizCallId: id },
            ],
          },
        });
        if (dbCall) {
          call = {
            id: dbCall.id,
            callNumber: `#${dbCall.id.slice(-5)}`,
            callerNumber: dbCall.callerNumber,
            agentId: dbCall.agentId || "default",
            agentName: "Harika (Telugu Faculty Voice)",
            direction: dbCall.direction as any,
            status: dbCall.status as any,
            stage: dbCall.status === "ACTIVE" ? "MEDIA_CONNECTED" : "ENDED",
            vobizCallId: dbCall.vobizCallId || "",
            startedAt: dbCall.createdAt.toISOString(),
            durationSeconds: dbCall.durationSeconds || 0,
            language: "Telugu + English",
            estimatedCost: dbCall.totalCost ? Number(dbCall.totalCost) : 1.5,
            currency: "INR",
            transcripts: [],
          };
        }
      } catch (dbErr) {
        console.warn("[LIVE_STATUS] DB lookup warning:", dbErr);
      }
    }

    if (!call) {
      return NextResponse.json({
        success: true,
        state: { stage: "IDLE", active: false },
      });
    }

    // Compute elapsed duration
    const startTime = call.startedAt ? new Date(call.startedAt).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const durationSeconds = call.durationSeconds > 0 ? call.durationSeconds : elapsedSeconds;

    const isActive = call.status === CallStatus.ACTIVE || call.status === CallStatus.INITIALIZING;

    let stage = call.stage || "RINGING";
    if (isActive) {
      if (elapsedSeconds < 2) {
        stage = "MEDIA_CONNECTING";
      } else if (elapsedSeconds < 6) {
        stage = "AGENT_SPEAKING";
      } else if (elapsedSeconds % 8 < 4) {
        stage = "LISTENING";
      } else {
        stage = "AGENT_SPEAKING";
      }
    } else {
      stage = "ENDED";
    }

    const lastTranscript =
      call.transcripts && call.transcripts.length > 0
        ? call.transcripts[call.transcripts.length - 1].content
        : "నమస్కారం అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను.";

    return NextResponse.json({
      success: true,
      state: {
        stage,
        active: isActive,
        lastTranscript,
        durationSeconds,
        callerNumber: call.callerNumber,
        callId: call.id,
        vobizCallId: call.vobizCallId,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error reading live call status" },
      { status: 500 }
    );
  }
}
