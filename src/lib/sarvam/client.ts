/**
 * Sarvam AI Saaras Realtime STT Client
 * Verified protocol: wss://api.sarvam.ai/speech-to-text-realtime/ws
 * Audio chunks: {"event": "audio_input", "audio": "<base64>"}
 */

export interface SarvamConfig {
  apiKey?: string;
  languageCode?: string; // Default: te-IN
  model?: string;        // Default: saaras:v3-realtime
}

export interface SarvamTranscriptEvent {
  type: "partial" | "final" | "error";
  transcript: string;
  languageCode?: string;
}

export class SarvamClient {
  private apiKey: string;
  private defaultLanguage: string = "te-IN";
  private defaultModel: string = "saaras:v3-realtime";

  constructor(config?: SarvamConfig) {
    this.apiKey = config?.apiKey || "";
    if (config?.languageCode) this.defaultLanguage = config.languageCode;
    if (config?.model) this.defaultModel = config.model;
  }

  getApiKey(): string {
    return (
      this.apiKey ||
      (typeof process !== "undefined" && process.env.SARVAM_API_KEY) ||
      "sk_scyogavs_kh6r7l2swDulfN6ifZYMZRRF"
    );
  }

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  /**
   * Returns the official WebSocket URL with query parameters
   */
  getWebSocketUrl(options?: { languageCode?: string; model?: string }): string {
    const lang = options?.languageCode || this.defaultLanguage;
    const model = options?.model || this.defaultModel;
    return `wss://api.sarvam.ai/speech-to-text-realtime/ws?language_code=${encodeURIComponent(
      lang
    )}&model=${encodeURIComponent(model)}`;
  }

  /**
   * Generates authentication headers for connection
   */
  getHeaders(): Record<string, string> {
    return {
      "api-subscription-key": this.getApiKey(),
    };
  }

  /**
   * Encapsulates raw PCM buffer into the official Sarvam JSON payload
   */
  formatAudioMessage(pcmBuffer: Buffer): string {
    return JSON.stringify({
      event: "audio_input",
      audio: pcmBuffer.toString("base64"),
    });
  }
}

export const sarvamClient = new SarvamClient();
