import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");
  const query = searchParams.get("query")?.toLowerCase();

  let calls = dataStore.getCalls();

  if (statusFilter && statusFilter !== "ALL") {
    calls = calls.filter((c) => c.status === statusFilter);
  }

  if (query) {
    calls = calls.filter(
      (c) =>
        c.callNumber.toLowerCase().includes(query) ||
        c.callerNumber.toLowerCase().includes(query) ||
        c.agentName.toLowerCase().includes(query)
    );
  }

  return NextResponse.json({ success: true, calls });
}
