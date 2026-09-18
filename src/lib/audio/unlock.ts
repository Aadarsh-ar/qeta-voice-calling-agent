/**
 * Synchronously unlocks audio playback permissions in the browser
 * when called from a user gesture (e.g. click).
 * 
 * Solves browser autoplay restrictions across Chrome, Safari, iOS & Android.
 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    // 1. Prime AudioContext if supported
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

    // 2. Prime HTMLMediaElement playback with inaudible micro-WAV
    const silent = new Audio(
      "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
    );
    silent.volume = 0.001;
    const promise = silent.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          silent.pause();
        })
        .catch(() => {});
    }
  } catch {}
}
