export interface VoiceOption {
  id: string;
  name: string;
  gender: "Female" | "Male";
  language: string;
  description: string;
  model: string;
  isCloned: boolean;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: "93d9c1de-e167-44c6-8e39-b4440c106a1d",
    name: "Priya (Cloned Telugu Voice)",
    gender: "Female",
    language: "Telugu & Tenglish",
    description: "Natural conversational Telugu & English bilingual cloned voice",
    model: "sonic-3.6",
    isCloned: true,
  },
  {
    id: "41508a7d-4839-445f-ba7f-687f620ed0e7",
    name: "Harika (Telugu Faculty Voice)",
    gender: "Female",
    language: "Telugu",
    description: "Academic faculty and polite conversational voice",
    model: "sonic-3.6",
    isCloned: true,
  },
  {
    id: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
    name: "AD (Cloned Telugu Voice)",
    gender: "Male",
    language: "Telugu & English",
    description: "Executive professional male voice",
    model: "sonic-3.6",
    isCloned: true,
  },
];

export const DEFAULT_VOICE_ID = "93d9c1de-e167-44c6-8e39-b4440c106a1d";
