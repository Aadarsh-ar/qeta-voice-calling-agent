/**
 * Universal browser audio unlock singleton.
 * 
 * In Safari (iOS & macOS), Chrome (Android & desktop), and Edge:
 * Media playback outside a direct user gesture is blocked unless the EXACT
 * HTMLAudioElement instance was already activated by a user gesture.
 * 
 * By maintaining a singleton HTMLAudioElement primed during the user's initial click,
 * subsequent asynchronous network audio (Cartesia TTS WAV stream) plays aloud reliably.
 */

let sharedAudio: HTMLAudioElement | null = null;

export function getSharedAudioElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    // 1. Prime the shared HTMLAudioElement directly in the user click callstack
    const audio = getSharedAudioElement();
    if (audio) {
      if (!audio.src || audio.src === "") {
        audio.src =
          "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
      }
      audio.volume = 0.001;
      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1.0;
          })
          .catch(() => {
            audio.volume = 1.0;
          });
      }
    }

    // 2. Prime Web Audio Context if available
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  } catch {}
}
