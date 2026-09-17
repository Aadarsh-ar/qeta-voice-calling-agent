import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";

export async function GET() {
  const numbers = dataStore.getPhoneNumbers();
  return NextResponse.json({ success: true, phoneNumbers: numbers });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { e164Number, assignedAgentId } = body;

    if (!e164Number) {
      return NextResponse.json(
        { success: false, error: "Phone number is required." },
        { status: 400 }
      );
    }

    const agent = assignedAgentId ? dataStore.getAgent(assignedAgentId) : undefined;

    const newNumber = {
      id: `num_${Date.now()}`,
      e164Number,
      provider: "Vobiz",
      assignedAgentId,
      assignedAgentName: agent ? agent.name : "Unassigned",
      status: "Active" as const,
      createdAt: new Date().toISOString(),
      isDemo: false,
    };

    dataStore.addPhoneNumber(newNumber);
    return NextResponse.json({ success: true, phoneNumber: newNumber });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, assignedAgentId, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Number ID is required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (assignedAgentId !== undefined) {
      const agent = assignedAgentId ? dataStore.getAgent(assignedAgentId) : undefined;
      updates.assignedAgentId = assignedAgentId;
      updates.assignedAgentName = agent ? agent.name : "Unassigned";
    }
    if (status !== undefined) {
      updates.status = status;
    }

    const updated = dataStore.updatePhoneNumber(id, updates);
    return NextResponse.json({ success: true, phoneNumber: updated });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error updating phone number" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Number ID is required" }, { status: 400 });
    }

    dataStore.deletePhoneNumber(id);
    return NextResponse.json({ success: true, deleted: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error deleting phone number" },
      { status: 500 }
    );
  }
}
