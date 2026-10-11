import { NextResponse } from "next/server";
import { cartesiaClient } from "@/lib/cartesia/client";
import { AVAILABLE_VOICES, DEFAULT_VOICE_ID, getVoiceById } from "@/lib/config/voices";

export const dynamic = "force-dynamic";

// In-memory audio cache for instant sub-millisecond preview playback
const previewAudioCache = new Map<string, { audioBase64: string; audioBytes: number }>();

const DEFAULT_SAMPLES: Record<string, string> = {
  // Priya (Platform Default & Landing Page Assistant)
  "480e1f44-cdab-4777-851a-236e06b04672":
    "హలో అండి! నేను ప్రియ, qetadotin యొక్క AI వాయిస్ అసిస్టెంట్ ని. మీకు ఎలా సహాయం చేయగలను?",
  // Harika
  "41508a7d-4839-445f-ba7f-687f620ed0e7":
    "నమస్కారం అండి! నేను హారిక, మీ అకడమిక్ మరియు అటెండెన్స్ కౌన్సెలర్ ని.",
  // Vamshi
  "7a80db73-b204-4cb7-aa26-8c43a79d557c":
    "నమస్కారం అండి! నేను వంశీ, కార్పొరేట్ మరియు రియల్ ఎస్టేట్ అడ్వైజర్ ని.",
  // Arjun
  "9dfd1c5f-e623-488e-99ec-7344e6b4be51":
    "హలో బాస్! నేను అర్జున్, డైనమిక్ సేల్స్ మరియు ఔట్ రీచ్ అసిస్టెంట్ ని.",
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedVoiceId = searchParams.get("voiceId")?.trim() || DEFAULT_VOICE_ID;
    const requestedText = searchParams.get("text")?.trim();

    return await handlePreview(requestedVoiceId, requestedText);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate voice preview" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const requestedVoiceId = (body.voiceId || body.cartesiaVoiceId || "").trim() || DEFAULT_VOICE_ID;
    const requestedText = (body.text || body.sampleText || body.textToSpeak || "").trim();

    return await handlePreview(requestedVoiceId, requestedText);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to generate voice preview" },
      { status: 500 }
    );
  }
}

async function handlePreview(voiceId: string, customText?: string) {
  const matchedVoice = getVoiceById(voiceId) || AVAILABLE_VOICES.find((v) => v.id === DEFAULT_VOICE_ID) || AVAILABLE_VOICES[0];
  const effectiveVoiceId = matchedVoice.id;
  const transcript = customText || DEFAULT_SAMPLES[effectiveVoiceId] || DEFAULT_SAMPLES[DEFAULT_VOICE_ID];

  const cacheKey = `${effectiveVoiceId}:${transcript}`;
  if (previewAudioCache.has(cacheKey)) {
    const cached = previewAudioCache.get(cacheKey)!;
    return NextResponse.json({
      success: true,
      voiceId: effectiveVoiceId,
      voiceName: matchedVoice.displayName,
      transcript,
      audioBase64: cached.audioBase64,
      audioBytes: cached.audioBytes,
      sampleRate: 16000,
      cached: true,
    });
  }

  if (!cartesiaClient.isConfigured()) {
    return NextResponse.json(
      { success: false, error: "Cartesia API key is not configured on server." },
      { status: 500 }
    );
  }

  const audioBuffer = await cartesiaClient.synthesize({
    transcript,
    voiceId: effectiveVoiceId,
    modelId: "sonic-3.6",
    container: "wav",
    encoding: "pcm_s16le",
    sampleRate: 16000,
  });

  if (!audioBuffer || audioBuffer.byteLength === 0) {
    return NextResponse.json(
      { success: false, error: "Cartesia returned empty audio stream." },
      { status: 502 }
    );
  }

  const audioBase64 = Buffer.from(audioBuffer).toString("base64");
  const audioBytes = audioBuffer.byteLength;

  previewAudioCache.set(cacheKey, { audioBase64, audioBytes });

  return NextResponse.json({
    success: true,
    voiceId: effectiveVoiceId,
    voiceName: matchedVoice.displayName,
    transcript,
    audioBase64,
    audioBytes,
    sampleRate: 16000,
    cached: false,
  });
}
