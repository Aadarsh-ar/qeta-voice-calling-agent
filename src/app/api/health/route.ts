import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { RoomServiceClient } from "livekit-server-sdk";

export async function GET() {
  const checks: Record<string, { status: "HEALTHY" | "DEGRADED" | "DOWN"; details?: string; latencyMs: number }> = {};
  let isAllHealthy = true;

  // 1. PostgreSQL check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "HEALTHY", latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    isAllHealthy = false;
    checks.database = { status: "DOWN", details: err?.message, latencyMs: Date.now() - dbStart };
  }

  // 2. LiveKit Cloud check
  const lkStart = Date.now();
  try {
    const livekitUrl = process.env.LIVEKIT_URL || "wss://ai-voice-agent-44qkuva3.livekit.cloud";
    const livekitHost = livekitUrl.replace(/^wss:\/\//, "https://");
    const apiKey = process.env.LIVEKIT_API_KEY || "API6S2vyxFt6xvW";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "eaFWRJKuO7ifHaLDwUeNZZ8TCyHfecYwHhnvHCxkwDSG";
    const rsc = new RoomServiceClient(livekitHost, apiKey, apiSecret);
    const rooms = await rsc.listRooms();
    checks.livekit = {
      status: "HEALTHY",
      details: `${rooms.length} active rooms on cluster`,
      latencyMs: Date.now() - lkStart,
    };
  } catch (err: any) {
    isAllHealthy = false;
    checks.livekit = { status: "DOWN", details: err?.message, latencyMs: Date.now() - lkStart };
  }

  // 3. Environment configuration check
  const { DEFAULT_TELEPHONY_CONFIG } = await import("@/lib/config/telephony");
  const hasCartesia = !!(process.env.CARTESIA_API_KEY || DEFAULT_TELEPHONY_CONFIG.cartesiaApiKey);
  const hasGroq = !!(process.env.GROQ_API_KEY || DEFAULT_TELEPHONY_CONFIG.groqApiKey);
  const hasDeepgram = !!(process.env.DEEPGRAM_API_KEY || "5cfc51075cbd0dd63e8cd8b46cc240eed660551d");
  const hasLivekit = !!(process.env.LIVEKIT_API_KEY || "API6S2vyxFt6xvW");

  checks.config = {
    status: hasCartesia && hasGroq && hasDeepgram && hasLivekit ? "HEALTHY" : "DEGRADED",
    latencyMs: 0,
  };

  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA
    ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
    : "c259771";

  return NextResponse.json(
    {
      status: isAllHealthy ? "OK" : "DEGRADED",
      timestamp: new Date().toISOString(),
      version: `1.0.3-prod-${commitSha}`,
      services: checks,
    },
    { status: isAllHealthy ? 200 : 503 }
  );
}
