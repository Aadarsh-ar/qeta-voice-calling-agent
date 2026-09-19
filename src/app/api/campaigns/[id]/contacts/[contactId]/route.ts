import { NextResponse } from "next/server";
import { campaignManager } from "@/lib/campaigns/campaignManager";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const { id, contactId } = await params;
    const campaign = campaignManager.getCampaign(id);
    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    const contact = campaign.contacts.find((c) => c.id === contactId);
    if (!contact) {
      return NextResponse.json(
        { success: false, error: "Contact not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, contact });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch contact details" },
      { status: 500 }
    );
  }
}
