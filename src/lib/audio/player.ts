/**
/**
 * Universal browser audio player for Cartesia TTS.
 * Reliable cross-browser audio playback with automatic WAV/PCM header wrapping,
 * autoplay unlock management, and memory cleanup.
 */

import { getSharedAudioElement, unlockAudio } from "./unlock";

let activeBlobUrl: string | null = null;
let currentAudio: HTMLAudioElement | null = null;
let isCurrentlyPlaying = false;

/**
 * Converts Base64 audio into a playable WAV Blob.
 * If the incoming binary already has a standard RIFF/WAV header (44 bytes), wraps it directly.
 * Otherwise, prepends a 44-byte standard RIFF PCM header.
 */
export function base64ToWavBlob(base64: string, sampleRate = 16000): Blob {
  try {
    const binary = window.atob(base64.trim());
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Check for standard RIFF header from Cartesia container: 'wav'
    if (len >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return new Blob([bytes], { type: "audio/wav" });
    }

    // Wrap raw PCM in 44-byte WAV header
    const wavHeader = new ArrayBuffer(44);
    const view = new DataView(wavHeader);
    const totalDataLen = len;
    const totalLen = totalDataLen + 36;

    // "RIFF"
    view.setUint32(0, 0x52494646, false);
    view.setUint32(4, totalLen, true);
    // "WAVE"
    view.setUint32(8, 0x57415645, false);
    // "fmt "
    view.setUint32(12, 0x666d7420, false);
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, 1, true); // NumChannels (Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    // "data"
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, totalDataLen, true);

    return new Blob([wavHeader, bytes], { type: "audio/wav" });
  } catch (err) {
    console.warn("[AUDIO_PLAYER] base64ToWavBlob conversion notice:", err);
    return new Blob([], { type: "audio/wav" });
  }
}

export interface PlayAudioOptions {
  sampleRate?: number;
  volume?: number;
  onStart?: () => void;
  onEnded?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Stops any currently active audio playback.
 */
export function stopAudio(): void {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {}
  }
  if (activeBlobUrl) {
    try {
      URL.revokeObjectURL(activeBlobUrl);
    } catch {}
    activeBlobUrl = null;
  }
  isCurrentlyPlaying = false;
}

export function isAudioPlaying(): boolean {
  return isCurrentlyPlaying;
}

/**
 * Plays base64 audio aloud reliably using HTML5 Audio + Blob URLs.
 */
export async function playAudioBase64(
  base64: string,
  options?: PlayAudioOptions
): Promise<HTMLAudioElement | null> {
  if (typeof window === "undefined") return null;

  unlockAudio();
  stopAudio();

  if (!base64 || base64.trim().length === 0) {
    options?.onEnded?.();
    return null;
  }

  try {
    const blob = base64ToWavBlob(base64, options?.sampleRate || 16000);
    const blobUrl = URL.createObjectURL(blob);
    activeBlobUrl = blobUrl;

    let audio = getSharedAudioElement();
    if (!audio) {
      audio = new Audio();
    }
    currentAudio = audio;

    audio.pause();
    audio.currentTime = 0;
    audio.src = blobUrl;
    audio.volume = typeof options?.volume === "number" ? options.volume : 1.0;

    audio.onplay = () => {
      isCurrentlyPlaying = true;
      options?.onStart?.();
    };

    audio.onended = () => {
      isCurrentlyPlaying = false;
      if (activeBlobUrl) {
        try {
          URL.revokeObjectURL(activeBlobUrl);
        } catch {}
        activeBlobUrl = null;
      }
      options?.onEnded?.();
    };

    audio.onerror = (e) => {
      console.warn("[AUDIO_PLAYER] Audio playback error:", e);
      isCurrentlyPlaying = false;
      if (activeBlobUrl) {
        try {
          URL.revokeObjectURL(activeBlobUrl);
        } catch {}
        activeBlobUrl = null;
      }
      options?.onError?.(e);
      options?.onEnded?.();
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      await playPromise;
      isCurrentlyPlaying = true;
    }
    return audio;
  } catch (err) {
    console.warn("[AUDIO_PLAYER] playAudioBase64 notice:", err);
    isCurrentlyPlaying = false;
    options?.onError?.(err);
    options?.onEnded?.();
    return null;
  }
}

/**
 * Plays a quick voice preview sample for any configured Cartesia voice ID.
 */
export async function playVoicePreviewSample(
  voiceId: string,
  options?: {
    customText?: string;
    onStart?: () => void;
    onEnded?: () => void;
    onError?: (err: unknown) => void;
  }
): Promise<{ stop: () => void }> {
  unlockAudio();

  try {
    const res = await fetch("/api/voices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, text: options?.customText }),
    });

    const data = await res.json();
    if (data.success && data.audioBase64) {
      await playAudioBase64(data.audioBase64, {
        sampleRate: data.sampleRate || 16000,
        onStart: options?.onStart,
        onEnded: options?.onEnded,
        onError: options?.onError,
      });
    } else {
      throw new Error(data.error || "Failed to generate preview audio");
    }
  } catch (err) {
    options?.onError?.(err);
    options?.onEnded?.();
  }

  return { stop: stopAudio };
}
