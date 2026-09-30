import { NextResponse } from "next/server";
import { AVAILABLE_VOICES, DEFAULT_VOICE_ID } from "@/lib/config/voices";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      voices: AVAILABLE_VOICES,
      defaultVoiceId: DEFAULT_VOICE_ID,
      count: AVAILABLE_VOICES.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch voices" },
      { status: 500 }
    );
  }
}
