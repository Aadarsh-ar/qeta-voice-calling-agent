/**
 * Vobiz Telephony Protocol & Bidirectional WebSocket Message Handler
 */

export interface VobizConfig {
  apiKey?: string;
  secret?: string;
  phoneNumber?: string;
}

export class VobizTelephony {
  private apiKey: string;
  private secret: string;

  constructor(config?: VobizConfig) {
    this.apiKey = config?.apiKey || process.env.VOBIZ_API_KEY || "";
    this.secret = config?.secret || process.env.VOBIZ_SECRET || "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.secret);
  }

  /**
   * Generates Vobiz XML to fork live audio into our bidirectional WebSocket stream
   */
  generateStreamResponseXml(websocketUrl: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-l16;rate=16000">
    ${websocketUrl}
  </Stream>
</Response>`.trim();
  }

  /**
   * Constructs the Vobiz playAudio payload for outbound TTS playback
   */
  createPlayAudioMessage(streamId: string, pcmBuffer: Buffer, sampleRate: number = 16000): string {
    return JSON.stringify({
      event: "playAudio",
      streamId,
      media: {
        contentType: "audio/x-l16",
        sampleRate,
        payload: pcmBuffer.toString("base64"),
      },
    });
  }

  /**
   * Constructs the Vobiz clearAudio message to immediately stop current speech on interruption (Barge-in)
   */
  createClearAudioMessage(streamId: string): string {
    return JSON.stringify({
      event: "clearAudio",
      streamId,
    });
  }

  /**
   * Constructs checkpoint message to track playback position
   */
  createCheckpointMessage(streamId: string, name: string): string {
    return JSON.stringify({
      event: "checkpoint",
      streamId,
      name,
    });
  }
}

export const vobizTelephony = new VobizTelephony();
