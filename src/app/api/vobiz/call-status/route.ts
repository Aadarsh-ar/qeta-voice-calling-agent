import { NextResponse } from "next/server";

/**
 * Handles Vobiz call status webhooks (ring, hangup, etc.)
 */
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let data: any = {};
    if (contentType.includes("application/json")) {
      data = await req.json().catch(() => ({}));
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      data = Object.fromEntries(params.entries());
    }
    console.log("[VOBIZ STATUS]", JSON.stringify(data));

    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "ok" });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Vobiz call-status webhook active" });
}
