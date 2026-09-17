import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    vobizCall: "Connected",
    mediaStream: "Connected",
    callerAudio: "Receiving",
    sarvam: "Connected",
    transcript: "Receiving",
    groq: "Responding",
    cartesia: "Generating Audio",
    outboundAudio: "Sending",
    callerPlayback: "Confirmed",
    voiceId: "ff480e6e-3e79-4307-9889-d1d9feb8e20e",
    agentName: "ఆదర్శ్",
    greeting: "హాయ్ అండి, నేను ఆదర్శ్. మీకు ఎలా సహాయం చేయగలను?",
    format: "audio/x-mulaw;rate=8000 (40ms chunks / 320 bytes)",
    statusTimestamp: new Date().toISOString(),
  });
}
