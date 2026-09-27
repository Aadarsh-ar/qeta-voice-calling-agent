import { NextResponse } from "next/server";
import { campaignManager } from "@/lib/campaigns/campaignManager";

export async function GET() {
  try {
    const rawCampaigns = campaignManager.getCampaigns();
    // Memory and payload optimization for 1K+ contacts:
    // Strip heavy transcripts from list view so polling is instant
    const campaigns = rawCampaigns.map((c) => ({
      ...c,
      contacts: c.contacts.slice(0, 10).map((cnt) => ({
        ...cnt,
        transcripts: undefined,
      })),
      totalContactsCount: c.contacts.length,
    }));
    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, agentId, concurrency, maxRetries, retryDelaySeconds, callDelaySeconds, contacts } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Campaign name is required." },
        { status: 400 }
      );
    }

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one valid contact is required to create a campaign." },
        { status: 400 }
      );
    }

    const campaign = campaignManager.createCampaign({
      name,
      description,
      agentId,
      concurrency: Number(concurrency) || 2,
      maxRetries: Number(maxRetries) ?? 2,
      retryDelaySeconds: Number(retryDelaySeconds) || 30,
      callDelaySeconds: Number(callDelaySeconds) || 2,
      contacts,
    });

    return NextResponse.json({ success: true, campaign });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}
