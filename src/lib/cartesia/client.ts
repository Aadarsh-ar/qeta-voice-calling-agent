/**
 * Cartesia Sonic Client
 * Handles voice synthesis, cloned voice verification, and WebSocket streaming.
 */

export interface CartesiaVoice {
  id: string;
  name: string;
  description?: string;
  language: string;
  is_public: boolean;
  status: string;
}

export class CartesiaClient {
  private apiKey: string;
  private version: string = "2024-06-10";
  private baseUrl: string = "https://api.cartesia.ai";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  getApiKey(): string {
    const envKey = typeof process !== "undefined" ? process.env.CARTESIA_API_KEY : undefined;
    const cleanEnvKey = envKey ? envKey.trim().replace(/^["']|["']$/g, "") : "";
    if (cleanEnvKey && cleanEnvKey.startsWith("sk_car_")) {
      return cleanEnvKey;
    }
    return this.apiKey || "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
  }

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.startsWith("sk_car_"));
  }

  /**
   * List all voices accessible by the account
   */
  async listVoices(): Promise<CartesiaVoice[]> {
    if (!this.isConfigured()) {
      throw new Error("Cartesia API key is missing or invalid.");
    }

    const res = await fetch(`${this.baseUrl}/voices`, {
      headers: {
        "X-API-Key": this.getApiKey(),
        "Cartesia-Version": this.version,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to fetch Cartesia voices (${res.status}): ${errText}`);
    }

    return (await res.json()) as CartesiaVoice[];
  }

  /**
   * Get custom cloned voices
   */
  async getClonedVoices(): Promise<CartesiaVoice[]> {
    const all = await this.listVoices();
    return all.filter((v) => !v.is_public);
  }

  /**
   * Verify if a specific voice ID exists and is active
   */
  async verifyVoice(voiceId: string): Promise<CartesiaVoice | null> {
    try {
      const res = await fetch(`${this.baseUrl}/voices/${voiceId}`, {
        headers: {
          "X-API-Key": this.getApiKey(),
          "Cartesia-Version": this.version,
        },
      });
      if (res.ok) {
        return (await res.json()) as CartesiaVoice;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Synthesize speech via REST API (audio/wav or raw pcm)
   */
  async synthesize(params: {
    transcript: string;
    voiceId: string;
    modelId?: string;
    sampleRate?: number;
    encoding?: "pcm_s16le" | "pcm_f32le" | "pcm_mulaw";
    container?: "wav" | "raw";
  }): Promise<ArrayBuffer> {
    if (!this.isConfigured()) {
      throw new Error("Cartesia API key is not configured.");
    }

    const MASTER_KEY = "sk_car_x7b5kmXE55KpDgAR9Rcc1U";
    const primaryKey = this.getApiKey();

    const payload = {
      model_id: params.modelId || "sonic-3.6",
      transcript: params.transcript,
      voice: {
        mode: "id",
        id: params.voiceId,
      },
      output_format: {
        container: params.container || "wav",
        encoding: params.encoding || "pcm_s16le",
        sample_rate: params.sampleRate || 16000,
      },
    };

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/tts/bytes`, {
        method: "POST",
        headers: {
          "X-API-Key": primaryKey,
          "Cartesia-Version": this.version,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr: any) {
      console.warn("[CARTESIA] Primary key network error:", netErr.message);
      res = new Response(netErr.message || "Network Error", { status: 599 });
    }

    // Auto-retry with master key if environment key or primary key failed for ANY reason (status != 200)
    if (!res.ok && primaryKey !== MASTER_KEY) {
      console.warn(`[CARTESIA] Primary key synthesis failed (HTTP ${res.status}). Retrying with master fallback key...`);
      try {
        res = await fetch(`${this.baseUrl}/tts/bytes`, {
          method: "POST",
          headers: {
            "X-API-Key": MASTER_KEY,
            "Cartesia-Version": this.version,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (retryErr: any) {
        console.warn("[CARTESIA] Master key fallback network error:", retryErr.message);
      }
    }

    const latencyMs = Date.now() - t0;
    const contentType = res.headers.get("content-type") || "unknown";

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[CARTESIA_TTS_DIAGNOSTIC] FAILED HTTP ${res.status} | Content-Type: ${contentType} | Latency: ${latencyMs}ms | Voice: ${params.voiceId} | Error: ${errText}`);
      throw new Error(`Cartesia synthesis failed (${res.status}): ${errText || res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    console.log(`[CARTESIA_TTS_DIAGNOSTIC] SUCCESS HTTP ${res.status} | Content-Type: ${contentType} | Latency: ${latencyMs}ms | Bytes: ${arrayBuffer.byteLength} | Voice: ${params.voiceId}`);
    return arrayBuffer;
  }
}

export const cartesiaClient = new CartesiaClient();
