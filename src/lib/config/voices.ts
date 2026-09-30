export interface VoiceOption {
  id: string;
  name: string;
  displayName: string;
  gender: "Female" | "Male";
  language: string;
  description: string;
  model: string;
  isCloned: boolean;
}

/**
 * The 4 exact Cartesia cloned voices configured for the QETADOTIN platform.
 * These are verified, live, and active in the Cartesia neural voice engine.
 */
export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: "41508a7d-4839-445f-ba7f-687f620ed0e7",
    name: "Harika",
    displayName: "Harika (Telugu Faculty Voice)",
    gender: "Female",
    language: "Telugu",
    description: "Academic faculty and polite conversational voice",
    model: "sonic-3.6",
    isCloned: true,
  },
  {
    id: "480e1f44-cdab-4777-851a-236e06b04672",
    name: "Priya",
    displayName: "Priya (Telugu Conversational Voice)",
    gender: "Female",
    language: "Telugu",
    description: "Warm, friendly, natural customer support and sales voice",
    model: "sonic-3.6",
    isCloned: true,
  },
  {
    id: "7a80db73-b204-4cb7-aa26-8c43a79d557c",
    name: "Vamshi",
    displayName: "Vamshi (Telugu Professional Male Voice)",
    gender: "Male",
    language: "Telugu",
    description: "Authoritative, clear, corporate and advisory male voice",
    model: "sonic-3.6",
    isCloned: true,
  },
  {
    id: "9dfd1c5f-e623-488e-99ec-7344e6b4be51",
    name: "Arjun",
    displayName: "Arjun (Telugu Dynamic Male Voice)",
    gender: "Male",
    language: "Telugu",
    description: "Energetic, engaging, dynamic sales and outreach voice",
    model: "sonic-3.6",
    isCloned: true,
  },
];

export const DEFAULT_VOICE_ID = "41508a7d-4839-445f-ba7f-687f620ed0e7";

/**
 * Validates whether a given ID matches one of the 4 configured Cartesia voices.
 */
export function isValidVoiceId(voiceId?: string | null): boolean {
  if (!voiceId) return false;
  return AVAILABLE_VOICES.some((v) => v.id.toLowerCase() === voiceId.trim().toLowerCase());
}

/**
 * Retrieves the full voice option metadata by Cartesia voice ID.
 */
export function getVoiceById(voiceId?: string | null): VoiceOption | undefined {
  if (!voiceId) return undefined;
  return AVAILABLE_VOICES.find((v) => v.id.toLowerCase() === voiceId.trim().toLowerCase());
}

/**
 * Returns human-readable voice display name for UI reporting.
 */
export function getVoiceName(voiceId?: string | null): string {
  const match = getVoiceById(voiceId);
  return match ? match.displayName : "Custom Voice";
}
