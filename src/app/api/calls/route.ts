import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { resolveOrgContext } from "@/lib/auth/orgContext";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const query = searchParams.get("query")?.toLowerCase();
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    // Resolve org context for multi-tenant scoping
    const orgResult = await resolveOrgContext(req);
    let orgFilter: { organizationId?: string } = {};
    if (!("error" in orgResult)) {
      orgFilter = { organizationId: orgResult.organizationId };
    }

    // Build where clause
    const where: Record<string, unknown> = { ...orgFilter };

    if (statusFilter && statusFilter !== "ALL") {
      where.status = statusFilter;
    }

    if (query) {
      where.OR = [
        { callerNumber: { contains: query } },
        { agentNumber: { contains: query } },
        { agent: { name: { contains: query, mode: "insensitive" } } },
      ];
    }

    const [calls, total] = await Promise.all([
      prisma.call.findMany({
        where: where as any,
        include: {
          agent: { select: { name: true, language: true } },
          agentVersion: { select: { name: true } },
          summary: { select: { summary: true, customerIntent: true, outcome: true, importantInfo: true, followUpRequired: true } },
          transcripts: { select: { id: true, role: true, content: true, timestampMs: true }, orderBy: { timestampMs: "asc" }, take: 20 },
          usage: { select: { totalCost: true, durationSeconds: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.call.count({ where: where as any }),
    ]);

    const formattedCalls = calls.map((c) => ({
      id: c.id,
      callNumber: `#${c.id.slice(-5)}`,
      callerNumber: c.callerNumber,
      agentId: c.agentId || "",
      agentName: c.agentVersion?.name || c.agent?.name || "Voice Agent",
      direction: c.direction,
      status: c.status,
      startedAt: c.startedAt?.toISOString() || c.createdAt.toISOString(),
      endedAt: c.endedAt?.toISOString(),
      durationSeconds: c.durationSeconds || 0,
      language: c.agent?.language === "ENGLISH" ? "English" : "Telugu + English",
      estimatedCost: c.usage ? Number(c.usage.totalCost) : Number(c.totalCost) || 0,
      currency: c.currency || "INR",
      summary: c.summary ? {
        summary: c.summary.summary,
        customerIntent: c.summary.customerIntent || "",
        outcome: c.summary.outcome || "",
        importantInfo: c.summary.importantInfo || "",
        followUpRequired: c.summary.followUpRequired || false,
      } : undefined,
      transcripts: c.transcripts.map((t) => ({
        id: t.id,
        role: t.role,
        content: t.content,
        timestampMs: t.timestampMs,
      })),
      vobizCallId: c.vobizCallId || "",
      livekitRoom: c.livekitRoom || "",
    }));

    return NextResponse.json({
      success: true,
      calls: formattedCalls,
      pagination: { total, limit, offset },
    });
  } catch (err: unknown) {
    console.error("[CALLS_GET_ERROR]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error fetching calls", calls: [] },
      { status: 500 }
    );
  }
}
