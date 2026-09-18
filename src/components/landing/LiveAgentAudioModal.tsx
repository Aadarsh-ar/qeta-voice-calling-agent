"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Mic,
  Volume2,
  PhoneOff,
  ArrowRight,
  Radio,
  Loader2,
  Play,
  Sparkles,
  VolumeX,
} from "lucide-react";
import Link from "next/link";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type ConvState =
  | "idle"
  | "requesting_mic"
  | "connecting"
  | "speaking"
  | "listening"
  | "interrupted"
  | "error";

// Pre-computed G.711 mu-law to Float32 lookup table for low-latency decoding
const ULAW_TABLE = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const u = ~i;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 1) + 33) << (exponent + 2);
  sample -= 132;
  ULAW_TABLE[i] = (sign !== 0 ? -sample : sample) / 32768.0;
}

function decodeMuLaw(uint8: Uint8Array): Float32Array {
  const out = new Float32Array(uint8.length);
  for (let i = 0; i < uint8.length; i++) {
    out[i] = ULAW_TABLE[uint8[i]];
  }
  return out;
}

function encodeMuLawSample(sample: number): number {
  const BIAS = 132;
  const CLIP = 32635;
  let pcm = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
  const sign = pcm < 0 ? 0x80 : 0;
  if (sign) pcm = -pcm;
  if (pcm > CLIP) pcm = CLIP;
  pcm += BIAS;

  let exponent = 7;
  for (let expMask = 0x4000; (pcm & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent--;
  }
  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

function uint8ToBase64(uint8: Uint8Array): string {
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const bin = window.atob(base64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function LiveAgentAudioModal({ isOpen, onClose }: Props) {
  const [state, setState] = useState<ConvState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [agentSpokenText, setAgentSpokenText] = useState("");
  const [micVolume, setMicVolume] = useState(0);

  // Audio nodes and references
  const audioContextRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const isAgentSpeakingRef = useRef<boolean>(false);
  const isCallActiveRef = useRef<boolean>(false);

  // Stop active audio playback immediately (instant barge-in / clear)
  const stopAgentAudio = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (audioContextRef.current) {
      nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
    isAgentSpeakingRef.current = false;
  }, []);

  // Teardown everything cleanly
  const terminateSession = useCallback(() => {
    isCallActiveRef.current = false;
    stopAgentAudio();

    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "User ended call");
      } catch {}
      wsRef.current = null;
    }

    if (workletNodeRef.current) {
      try {
        workletNodeRef.current.disconnect();
      } catch {}
      workletNodeRef.current = null;
    }

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch {}
      scriptProcessorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setState("idle");
    setMicVolume(0);
    setAgentSpokenText("");
  }, [stopAgentAudio]);

  // Handle modal close
  const handleClose = () => {
    terminateSession();
    onClose();
  };

  // Ensure teardown on unmount or when modal closes
  useEffect(() => {
    if (!isOpen) {
      terminateSession();
    }
    return () => {
      terminateSession();
    };
  }, [isOpen, terminateSession]);

  // Start the voice-only session
  const startVoiceCall = async () => {
    setErrorMessage("");
    setAgentSpokenText("");
    setState("requesting_mic");

    try {
      // 1. Initialize AudioContext directly inside user click handler (required for mobile autoplay)
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 48000 });
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;
      nextStartTimeRef.current = audioCtx.currentTime;

      // 2. Request mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      setState("connecting");
      isCallActiveRef.current = true;

      // 3. Request short-lived Cartesia connection token
      const sessionRes = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const sessionData = await sessionRes.json();

      if (!sessionRes.ok || !sessionData.success || !sessionData.wsUrl) {
        throw new Error(sessionData.error || "Failed to initialize voice session");
      }

      // 4. Establish Cartesia Agent WebSocket
      const ws = new WebSocket(sessionData.wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isCallActiveRef.current) {
          ws.close();
          return;
        }

        // Send Cartesia start event
        ws.send(
          JSON.stringify({
            event: "start",
            config: {
              input_format: "mulaw_8000",
              output_audio_delivery: "speaking_pace",
            },
          })
        );
      };

      ws.onmessage = (event) => {
        if (!isCallActiveRef.current) return;

        try {
          const msg = JSON.parse(event.data);

          if (msg.event === "ack") {
            setState("listening");
          } else if (msg.event === "turn_started") {
            isAgentSpeakingRef.current = true;
            setState("speaking");
          } else if (msg.event === "turn_output_text_delta") {
            const delta = msg.turn_output_text_delta?.text || "";
            if (delta) {
              setAgentSpokenText((prev) => prev + delta);
            }
          } else if (msg.event === "media_output") {
            const payload = msg.media?.payload;
            if (payload && audioContextRef.current) {
              const rawBytes = base64ToUint8(payload);
              const float32Audio = decodeMuLaw(rawBytes);

              // Schedule audio buffer
              const buffer = audioCtx.createBuffer(1, float32Audio.length, 8000);
              buffer.getChannelData(0).set(float32Audio);

              const source = audioCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(audioCtx.destination);

              const now = audioCtx.currentTime;
              const startTime = Math.max(now, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;

              activeSourcesRef.current.push(source);
              source.onended = () => {
                const idx = activeSourcesRef.current.indexOf(source);
                if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
                if (activeSourcesRef.current.length === 0) {
                  isAgentSpeakingRef.current = false;
                  if (isCallActiveRef.current) {
                    setState("listening");
                  }
                }
              };
            }
          } else if (msg.event === "turn_interrupted" || msg.event === "audio_output_clear") {
            stopAgentAudio();
            setState("listening");
          } else if (msg.event === "error") {
            console.error("[Cartesia WS Error]", msg);
          }
        } catch (e) {
          console.error("[Cartesia WS Parse Error]", e);
        }
      };

      ws.onerror = (err) => {
        console.error("[Cartesia WS Error]", err);
        if (isCallActiveRef.current) {
          setErrorMessage("Live voice connection interrupted.");
          setState("error");
        }
      };

      ws.onclose = (e) => {
        if (isCallActiveRef.current && e.code !== 1000) {
          setErrorMessage("Voice stream ended.");
          setState("error");
        }
      };

      // 5. Connect Microphone to Downsampling AudioWorklet
      const micSource = audioCtx.createMediaStreamSource(stream);

      let workletLoaded = false;
      try {
        await audioCtx.audioWorklet.addModule("/audio-processor.js");
        const workletNode = new AudioWorkletNode(audioCtx, "live-audio-processor");
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (e) => {
          if (!isCallActiveRef.current) return;
          const { type, buffer, volume } = e.data;

          if (type === "volume" && typeof volume === "number") {
            setMicVolume(volume);
          } else if (type === "audio_data" && buffer && wsRef.current?.readyState === WebSocket.OPEN) {
            // While agent is outputting voice, avoid transmitting room echo
            if (isAgentSpeakingRef.current) return;

            const u8 = new Uint8Array(buffer);
            const b64 = uint8ToBase64(u8);
            wsRef.current.send(
              JSON.stringify({
                event: "media",
                media: {
                  payload: b64,
                },
              })
            );
          }
        };

        micSource.connect(workletNode);
        workletLoaded = true;
      } catch (workletErr) {
        console.warn("[Worklet Fallback] Using ScriptProcessorNode:", workletErr);
      }

      // Fallback for browsers with AudioWorklet restrictions
      if (!workletLoaded) {
        const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
        scriptProcessorRef.current = scriptNode;

        const targetSampleRate = 8000;
        const ratio = audioCtx.sampleRate / targetSampleRate;
        let accumulator: number[] = [];

        scriptNode.onaudioprocess = (e) => {
          if (!isCallActiveRef.current) return;
          const input = e.inputBuffer.getChannelData(0);

          let sumSq = 0;
          for (let i = 0; i < input.length; i += ratio) {
            const sample = input[Math.floor(i)] || 0;
            sumSq += sample * sample;
            accumulator.push(encodeMuLawSample(sample));

            if (accumulator.length >= 320) {
              if (!isAgentSpeakingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
                const chunk = new Uint8Array(accumulator.slice(0, 320));
                wsRef.current.send(
                  JSON.stringify({
                    event: "media",
                    media: { payload: uint8ToBase64(chunk) },
                  })
                );
              }
              accumulator = accumulator.slice(320);
            }
          }

          const rms = Math.sqrt(sumSq / (input.length / ratio || 1));
          setMicVolume(Math.min(1, rms * 5));
        };

        micSource.connect(scriptNode);
        scriptNode.connect(audioCtx.destination);
      }
    } catch (err) {
      console.error("[StartVoiceCall Error]", err);
      setErrorMessage(err instanceof Error ? err.message : "Could not access microphone");
      setState("error");
    }
  };

  if (!isOpen) return null;

  const isOnCall = state !== "idle" && state !== "error";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full sm:max-w-[520px] bg-white sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "min(700px, 96dvh)" }}
      >
        {/* ─── Header (Identical Layout & Aesthetic) ─── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                state === "speaking"
                  ? "bg-emerald-100 ring-2 ring-emerald-400 ring-offset-1 animate-pulse"
                  : state === "listening"
                  ? "bg-red-50 ring-2 ring-red-400 ring-offset-1"
                  : "bg-emerald-100"
              }`}
            >
              {state === "listening" ? (
                <Mic className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>Live Voice Agent</span>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                  Real Time
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {isOnCall ? "Harika (Female Telugu & English Voice)" : "Full-Duplex Speech · No Typing Required"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>Voice Only</span>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── MAIN CONTENT: 100% VOICE-ONLY INTERACTIVE CANVAS ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center justify-center min-h-0 bg-[#FBFBFA] relative">
          {/* Subtle Ambient Background Ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-72 h-72 rounded-full bg-radial from-emerald-100/60 to-transparent blur-2xl" />
          </div>

          {/* STATE: IDLE */}
          {state === "idle" && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-200 z-10">
              {/* Voice Orb */}
              <div className="relative flex items-center justify-center">
                <div className="w-28 h-28 rounded-full bg-emerald-600/10 border-2 border-emerald-500/30 flex items-center justify-center animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-700/30">
                    <Volume2 className="w-10 h-10" />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-heading text-lg font-bold text-slate-900">
                  Talk to Harika in Real-Time
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                  Natural spoken conversations in Telugu, English, or Tenglish. No typing required.
                </p>
              </div>

              {/* Language Tags */}
              <div className="flex items-center gap-2">
                {["తెలుగు", "English", "Tenglish"].map((lang) => (
                  <span
                    key={lang}
                    className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-3 py-1 rounded-full shadow-xs"
                  >
                    {lang}
                  </span>
                ))}
              </div>

              {/* Action Button */}
              <div className="w-full max-w-xs pt-2">
                <button
                  type="button"
                  onClick={startVoiceCall}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] group"
                >
                  <Play className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                  <span>Start Voice Call</span>
                  <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              {/* Sample Prompts */}
              <div className="pt-2 border-t border-slate-200/60 w-full max-w-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Sample things you can say aloud:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[
                    "నమస్తే, కాలేజ్ అటెండెన్స్ రూల్స్ చెప్పండి",
                    "What happens if attendance is under 75%?",
                    "Can you speak in English?",
                  ].map((q, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200/60"
                    >
                      &ldquo;{q}&rdquo;
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STATE: REQUESTING MIC OR CONNECTING */}
          {(state === "requesting_mic" || state === "connecting") && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-200 z-10">
              <div className="w-24 h-24 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-700 animate-spin" />
              </div>
              <div>
                <h4 className="font-heading text-sm font-bold text-slate-900">
                  {state === "requesting_mic" ? "Requesting Microphone Access" : "Connecting to Voice Agent"}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {state === "requesting_mic"
                    ? "Please allow microphone permission to talk."
                    : "Establishing ultra-low latency audio stream..."}
                </p>
              </div>
            </div>
          )}

          {/* STATE: AGENT SPEAKING */}
          {state === "speaking" && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-in fade-in duration-200 z-10">
              {/* Dynamic Animated Sound Wave Bars */}
              <div className="relative w-36 h-36 rounded-full bg-emerald-100/60 border-2 border-emerald-300 flex items-center justify-center">
                <div className="flex items-center gap-1 h-12">
                  {[24, 38, 16, 44, 28, 48, 20, 40, 18].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-emerald-600"
                      style={{
                        height: `${h}px`,
                        animation: `pulse ${0.3 + (i % 4) * 0.12}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Harika Speaking
                </span>
                <p className="text-xs text-slate-500 mt-2">
                  Speak anytime to interrupt (Barge-in supported)
                </p>
              </div>

              {/* Spoken Captions Box */}
              {agentSpokenText && (
                <div className="w-full max-w-sm p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Live Spoken Captions:
                  </p>
                  <p className="text-xs text-slate-800 font-medium leading-relaxed">
                    {agentSpokenText}
                  </p>
                </div>
              )}

              {/* Manual Barge-In / Interrupt Button */}
              <button
                type="button"
                onClick={stopAgentAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Tap to interrupt Harika</span>
              </button>
            </div>
          )}

          {/* STATE: LISTENING TO VISITOR */}
          {state === "listening" && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-in fade-in duration-200 z-10">
              {/* Reactive Microphone Visualizer */}
              <div
                className="relative flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `scale(${1 + micVolume * 0.25})`,
                }}
              >
                <div className="w-32 h-32 rounded-full bg-red-100/70 border-2 border-red-300 flex items-center justify-center animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                    <Mic className="w-9 h-9" />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200 animate-pulse">
                  Listening to You
                </span>
                <p className="text-xs text-slate-600 font-medium mt-2">
                  Speak naturally into your microphone in Telugu or English
                </p>
              </div>

              {agentSpokenText && (
                <div className="w-full max-w-sm p-3.5 rounded-2xl bg-white/80 border border-slate-200 text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Last response:
                  </p>
                  <p className="text-xs text-slate-700 leading-relaxed line-clamp-3">
                    {agentSpokenText}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STATE: ERROR */}
          {state === "error" && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-200 z-10">
              <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-500">
                <VolumeX className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-heading text-sm font-bold text-slate-900">
                  Voice Call Ended
                </h4>
                <p className="text-xs text-red-600 mt-1 max-w-xs">
                  {errorMessage || "Connection closed."}
                </p>
              </div>
              <button
                type="button"
                onClick={startVoiceCall}
                className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* ─── STATUS & CONTROL BAR ─── */}
        <div className="px-5 py-3 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            {state === "idle" && (
              <span className="text-slate-500 font-medium">Ready · Click green button to talk</span>
            )}
            {state === "requesting_mic" && (
              <span className="flex items-center gap-2 text-amber-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Waiting for microphone permission...
              </span>
            )}
            {state === "connecting" && (
              <span className="flex items-center gap-2 text-amber-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Connecting with Harika...
              </span>
            )}
            {state === "listening" && (
              <span className="flex items-center gap-2 text-red-600 font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 animate-ping" />
                <span>Microphone active · Speak now</span>
              </span>
            )}
            {state === "speaking" && (
              <span className="flex items-center gap-2 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span>Harika speaking</span>
              </span>
            )}
            {state === "error" && (
              <span className="text-red-600 font-medium truncate">{errorMessage}</span>
            )}
          </div>

          <div className="shrink-0">
            {isOnCall ? (
              <button
                type="button"
                onClick={terminateSession}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* ─── Footer (Exact Reference Layout) ─── */}
        <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <Link
            href="/login"
            onClick={handleClose}
            className="text-[11px] font-semibold text-slate-600 hover:text-emerald-800 transition flex items-center gap-1"
          >
            Open Console <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-emerald-500" /> Full-Duplex Real-Time Audio
          </span>
        </div>
      </div>
    </div>
  );
}
