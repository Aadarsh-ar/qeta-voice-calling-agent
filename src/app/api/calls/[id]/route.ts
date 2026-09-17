import { NextResponse } from "next/server";
import { dataStore } from "@/lib/db/store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const call = dataStore.getCall(id);
  if (!call) {
    return NextResponse.json({ success: false, error: "Call not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, call });
}
