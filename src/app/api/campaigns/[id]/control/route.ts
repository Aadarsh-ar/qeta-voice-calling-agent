import { NextResponse } from "next/server";
import { campaignManager } from "@/lib/campaigns/campaignManager";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (!action || !["start", "pause", "resume", "stop"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action must be one of: start, pause, resume, stop" },
        { status: 400 }
      );
    }

    let result: { success: boolean; message: string; campaign?: any } = {
      success: false,
      message: "Unknown action",
    };

    switch (action) {
      case "start":
        result = campaignManager.startCampaign(id);
        break;
      case "pause":
        result = campaignManager.pauseCampaign(id);
        break;
      case "resume":
        result = campaignManager.resumeCampaign(id);
        break;
      case "stop":
        result = campaignManager.stopCampaign(id);
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      campaign: result.campaign,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to control campaign" },
      { status: 500 }
    );
  }
}
