import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Missing LiveKit credentials" }, { status: 500 });
  }

  const receiver = new WebhookReceiver(apiKey, apiSecret);
  const body = await req.text();
  const authHeader = req.headers.get("Authorization");

  let event;
  try {
    event = await receiver.receive(body, authHeader || undefined);
  } catch (err) {
    console.error("[LiveKit Webhook] Authentication failed:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  console.log(`[LiveKit Webhook] Received event: ${event.event} for room: ${event.room?.name}`);

  const roomName = event.room?.name;
  if (!roomName) {
    return NextResponse.json({ received: true });
  }

  const callId = roomName.startsWith("call_") ? roomName.replace(/^call_/, "") : null;

  if (callId) {
    try {
      if (event.event === "room_started") {
        await prisma.call.update({
          where: { id: callId },
          data: { status: "ACTIVE", livekitRoom: roomName },
        });
      } else if (event.event === "room_finished") {
        const call = await prisma.call.findUnique({ where: { id: callId } });
        const endedAt = new Date();
        const durationSeconds = call?.startedAt
          ? Math.max(1, Math.round((endedAt.getTime() - new Date(call.startedAt).getTime()) / 1000))
          : 0;

        await prisma.call.update({
          where: { id: callId },
          data: {
            status: "COMPLETED",
            endedAt,
            durationSeconds: durationSeconds > 0 ? durationSeconds : undefined,
          },
        });
      }
    } catch (dbErr) {
      console.warn(`[LiveKit Webhook] DB update failed for call ${callId}:`, dbErr);
    }
  }

  return NextResponse.json({ received: true });
}
