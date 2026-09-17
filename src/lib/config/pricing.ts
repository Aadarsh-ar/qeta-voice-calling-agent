export interface ProviderRate {
  provider: "vobiz" | "sarvam" | "openai" | "cartesia" | "infrastructure";
  unit: "minute" | "second" | "1k_input_tokens" | "1k_output_tokens" | "1k_characters";
  rate: number; // in INR
  currency: string;
  effectiveDate: string;
  description: string;
}

export interface CallUsageMetrics {
  durationSeconds: number;
  sttAudioSeconds: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  ttsCharacters: number;
}

export interface CostBreakdown {
  vobizCost: number;
  sarvamCost: number;
  openaiCost: number;
  cartesiaCost: number;
  infraCost: number;
  totalCost: number;
  currency: string;
}

export const defaultProviderRates: Record<string, ProviderRate> = {
  vobiz: {
    provider: "vobiz",
    unit: "minute",
    rate: 0.65, // ₹0.65 per minute for domestic India calls
    currency: "INR",
    effectiveDate: "2026-01-01",
    description: "Vobiz PSTN inbound/outbound telephony",
  },
  sarvam: {
    provider: "sarvam",
    unit: "second",
    rate: 0.008, // ₹0.008 per audio second (~₹0.48 / min)
    currency: "INR",
    effectiveDate: "2026-01-01",
    description: "Sarvam Saaras Realtime STT",
  },
  openai_input: {
    provider: "openai",
    unit: "1k_input_tokens",
    rate: 0.012, // GPT-4o-mini input tokens (~$0.15 / 1M tokens converted to INR)
    currency: "INR",
    effectiveDate: "2026-01-01",
    description: "OpenAI LLM prompt tokens",
  },
  openai_output: {
    provider: "openai",
    unit: "1k_output_tokens",
    rate: 0.048, // GPT-4o-mini output tokens (~$0.60 / 1M tokens converted to INR)
    currency: "INR",
    effectiveDate: "2026-01-01",
    description: "OpenAI LLM completion tokens",
  },
  cartesia: {
    provider: "cartesia",
    unit: "1k_characters",
    rate: 0.065, // Cartesia Sonic TTS characters (~$0.075 / 1K chars converted)
    currency: "INR",
    effectiveDate: "2026-01-01",
    description: "Cartesia Sonic Cloned Voice TTS",
  },
  infrastructure: {
    provider: "infrastructure",
    unit: "minute",
    rate: 0.15, // Server compute, websocket egress buffer
    currency: "INR",
    effectiveDate: "2026-01-01",
    description: "Realtime WebSocket orchestration infrastructure",
  },
};

export function calculateCallCost(
  metrics: CallUsageMetrics,
  customRates?: Record<string, ProviderRate>
): CostBreakdown {
  const rates = customRates || defaultProviderRates;

  const minutes = Math.ceil(metrics.durationSeconds / 60);
  const vobizCost = Number((minutes * rates.vobiz.rate).toFixed(4));
  const sarvamCost = Number((metrics.sttAudioSeconds * rates.sarvam.rate).toFixed(4));
  const openaiCost = Number(
    (
      (metrics.llmInputTokens / 1000) * rates.openai_input.rate +
      (metrics.llmOutputTokens / 1000) * rates.openai_output.rate
    ).toFixed(4)
  );
  const cartesiaCost = Number(
    ((metrics.ttsCharacters / 1000) * rates.cartesia.rate).toFixed(4)
  );
  const infraCost = Number((minutes * rates.infrastructure.rate).toFixed(4));

  const totalCost = Number(
    (vobizCost + sarvamCost + openaiCost + cartesiaCost + infraCost).toFixed(2)
  );

  return {
    vobizCost,
    sarvamCost,
    openaiCost,
    cartesiaCost,
    infraCost,
    totalCost,
    currency: "INR",
  };
}
