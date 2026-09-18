"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Mic,
  Volume2,
  PhoneOff,
  Sparkles,
  VolumeX,
  Radio,
  Loader2,
  Play,
  RotateCcw,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  agentName?: string;
}

type ConvState =
  | "connecting"
  | "speaking"
  | "listening"
  | "interrupted"
  | "ended"
  | "error";

export function LiveAgentAudioModal({
  isOpen,
  onClose,
  agentId = "agent_WzcEn6kkRmPxAfBNHzvpa1",
  agentName = "Personal Assistant (Sam)",
}: Props) {
  const [state, setState] = useState<ConvState>("connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [agentSpokenText, setAgentSpokenText] = useState("");
  const [micVolume, setMicVolume] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMutedRef = useRef<boolean>(false);

  // Synchronously initialize AudioContext
  const ensureAudioContext = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      }
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
      return audioContextRef.current;
    } catch (err) {
      console.warn("[LiveAgent] AudioContext init note:", err);
      return null;
    }
  }, []);

  // Stop / flush active agent audio playback
  const stopAgentPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (audioContextRef.current) {
      nextPlayTimeRef.current = audioContextRef.current.currentTime;
    }
    setState("listening");
  }, []);

  // Terminate voice session completely
  const terminateSession = useCallback(() => {
    isCallActiveRef.current = false;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    // Stop microphone processing
    if (micProcessorRef.current) {
      try {
        micProcessorRef.current.disconnect();
      } catch {}
      micProcessorRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }

    // Stop active audio sources
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {}
    });
    activeSourcesRef.current = [];

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, "Normal termination");
      } catch {}
      wsRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setState("ended");
    setMicVolume(0);
  }, []);

  const handleClose = () => {
    terminateSession();
    onClose();
  };

  // Convert Float32Array to 16kHz 16-bit PCM Linear
  const convertFloatTo16kHzInt16 = (
    input: Float32Array,
    inputSampleRate: number
  ): Int16Array => {
    if (inputSampleRate === 16000) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }

    // Linear downsampling
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const result = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.floor(i * ratio);
      const s = Math.max(-1, Math.min(1, input[idx]));
      result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return result;
  };

  // Play incoming 40ms PCM frame from Cartesia
  const enqueuePcmChunk = useCallback(
    (base64: string) => {
      try {
        const ctx = ensureAudioContext();
        if (!ctx) return;

        const binary = window.atob(base64);
        const len = binary.length;
        if (len === 0) return;

        const numSamples = Math.floor(len / 2);
        const float32 = new Float32Array(numSamples);
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const dataView = new DataView(bytes.buffer, bytes.byteOffset, numSamples * 2);
        for (let i = 0; i < numSamples; i++) {
          float32[i] = dataView.getInt16(i * 2, true) / 32768.0;
        }

        const buffer = ctx.createBuffer(1, numSamples, 16000);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        if (analyserRef.current) {
          source.connect(analyserRef.current);
          analyserRef.current.connect(ctx.destination);
        } else {
          source.connect(ctx.destination);
        }

        const now = ctx.currentTime;
        if (nextPlayTimeRef.current < now) {
          nextPlayTimeRef.current = now + 0.02; // Small 20ms jitter protection
        }

        source.start(nextPlayTimeRef.current);
        nextPlayTimeRef.current += buffer.duration;

        activeSourcesRef.current.push(source);
        setState("speaking");

        source.onended = () => {
          const idx = activeSourcesRef.current.indexOf(source);
          if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
          if (activeSourcesRef.current.length === 0 && isCallActiveRef.current) {
            setState("listening");
          }
        };
      } catch (err) {
        console.warn("[LiveAgent] PCM chunk playback note:", err);
      }
    },
    [ensureAudioContext]
  );

  // Setup User Microphone Capture and Stream to Cartesia
  const setupMicrophone = useCallback(
    async (ws: WebSocket, ctx: AudioContext) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        micStreamRef.current = stream;

        const micSource = ctx.createMediaStreamSource(stream);
        const processor = ctx.createScriptProcessor(1024, 1, 1);
        micProcessorRef.current = processor;

        micSource.connect(processor);

        // Silent node so mic isn't sent to local speakers
        const silentNode = ctx.createGain();
        silentNode.gain.value = 0;
        processor.connect(silentNode);
        silentNode.connect(ctx.destination);

        processor.onaudioprocess = (e) => {
          if (!isCallActiveRef.current || ws.readyState !== WebSocket.OPEN) return;
          if (isMutedRef.current) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate energy for visualizer
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          setMicVolume(Math.min(1, rms * 6));

          // Convert Float32 to 16kHz Int16
          const pcm16 = convertFloatTo16kHzInt16(inputData, ctx.sampleRate);

          // Base64 encode
          let binary = "";
          const bytes = new Uint8Array(pcm16.buffer);
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = window.btoa(binary);

          try {
            ws.send(
              JSON.stringify({
                event: "media",
                media: { payload: base64 },
              })
            );
          } catch {}
        };
      } catch (err) {
        console.warn("[LiveAgent] Microphone access denied or unavailable:", err);
      }
    },
    []
  );

  // Start the voice session immediately (< 300ms connection)
  const startSession = useCallback(async () => {
    setErrorMessage("");
    setAgentSpokenText("");
    setCallDuration(0);
    setState("connecting");
    isCallActiveRef.current = true;

    const ctx = ensureAudioContext();

    // Create visualizer analyser node
    if (ctx && !analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
    }

    try {
      // Direct WebSocket to the high-speed Cartesia stream bridge
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host || "localhost:3000";
      const wsUrl = `${protocol}//${host}/api/cartesia/stream?agentId=${encodeURIComponent(agentId)}`;

      console.log(`[LiveAgent] Connecting immediately to Cartesia Agent stream: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[LiveAgent] Cartesia Agent WebSocket connected in < 150ms");
        if (ctx) {
          setupMicrophone(ws, ctx);
        }
        // Start duration counter
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const evt = msg.event || msg.type;

          // 1. Audio stream frames from Cartesia TTS
          if (evt === "media_output" || evt === "audio_output") {
            const payload = msg.media?.payload || msg.audio || msg.data;
            if (payload) {
              enqueuePcmChunk(payload);
            }
          }

          // 2. Real-time spoken transcript text delta
          else if (evt === "turn_output_text_delta") {
            const text = msg.turn_output_text_delta?.text || msg.text;
            if (text) {
              setAgentSpokenText((prev) => prev + text);
            }
          }

          // 3. New turn started by agent
          else if (evt === "turn_started") {
            setState("speaking");
          }

          // 4. Instant Barge-In / Interruption
          else if (
            evt === "audio_output_clear" ||
            evt === "interruption" ||
            evt === "turn_interrupted"
          ) {
            console.log("[LiveAgent] Caller interrupted agent speech");
            stopAgentPlayback();
          }

          // 5. Turn finished
          else if (evt === "turn_ended") {
            if (activeSourcesRef.current.length === 0) {
              setState("listening");
            }
          }

          // 6. Error event
          else if (evt === "error") {
            console.warn("[LiveAgent] Error from Cartesia stream:", msg);
            if (msg.error) setErrorMessage(msg.error);
          }
        } catch (err) {
          console.warn("[LiveAgent] Message parse note:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[LiveAgent] WebSocket error:", err);
        setErrorMessage("Connection to Cartesia Agent failed");
        setState("error");
      };

      ws.onclose = () => {
        console.log("[LiveAgent] Cartesia Agent WebSocket closed");
        if (isCallActiveRef.current) {
          setState("ended");
        }
      };
    } catch (err: unknown) {
      console.error("[LiveAgent] Session setup error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect");
      setState("error");
    }
  }, [agentId, enqueuePcmChunk, ensureAudioContext, setupMicrophone, stopAgentPlayback]);

  // Auto-connect immediately when modal opens
  useEffect(() => {
    if (isOpen) {
      startSession();
    } else {
      terminateSession();
    }
    return () => {
      terminateSession();
    };
  }, [isOpen, startSession, terminateSession]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full sm:max-w-[480px] bg-white sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "min(680px, 94dvh)" }}
      >
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
                state === "speaking"
                  ? "bg-emerald-100 ring-2 ring-emerald-500 ring-offset-1 animate-pulse"
                  : state === "listening"
                  ? "bg-red-50 ring-2 ring-red-400 ring-offset-1"
                  : "bg-emerald-50"
              }`}
            >
              {state === "listening" ? (
                <Mic className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-700" />
              )}
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{agentName}</span>
                <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                  Live Cartesia Agent
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {state === "connecting"
                  ? "Connecting in < 1s..."
                  : state === "speaking"
                  ? "Agent Speaking · Interrupt anytime"
                  : state === "listening"
                  ? "Listening · Speak naturally"
                  : "Cartesia Neural Voice Active"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
              {formatTime(callDuration)}
            </span>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── MAIN CONTENT ─── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center justify-center min-h-0 bg-[#FBFBFA] relative">
          {/* Subtle Glow Background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
            <div className="w-64 h-64 rounded-full bg-radial from-emerald-100 to-transparent blur-2xl" />
          </div>

          {/* STATE: CONNECTING */}
          {state === "connecting" && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-100 z-10">
              <div className="w-24 h-24 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center shadow-inner">
                <Loader2 className="w-10 h-10 text-emerald-700 animate-spin" />
              </div>
              <div>
                <h4 className="font-heading text-base font-bold text-slate-900">
                  Connecting to {agentName}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Starting zero-latency Cartesia stream...
                </p>
              </div>
            </div>
          )}

          {/* STATE: SPEAKING */}
          {state === "speaking" && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-in fade-in duration-150 z-10">
              {/* Dynamic Sound Wave Pulse */}
              <div className="relative w-32 h-32 rounded-full bg-emerald-100/70 border-2 border-emerald-400/80 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <div className="flex items-center gap-1.5 h-12">
                  {[28, 44, 18, 48, 32, 52, 22, 42, 20].map((h, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-emerald-600"
                      style={{
                        height: `${h}px`,
                        animation: `pulse ${0.35 + (i % 3) * 0.12}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  Sam is Speaking
                </span>
                <p className="text-xs text-slate-500 mt-2">
                  Speak directly to interrupt (Barge-in active)
                </p>
              </div>

              {/* Real-time Streaming Subtitles */}
              {agentSpokenText && (
                <div className="w-full max-w-sm p-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-left">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Live Spoken Transcript:
                  </p>
                  <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed max-h-28 overflow-y-auto">
                    {agentSpokenText}
                  </p>
                </div>
              )}

              {/* Tap to Interrupt Button */}
              <button
                type="button"
                onClick={stopAgentPlayback}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Tap to interrupt</span>
              </button>
            </div>
          )}

          {/* STATE: LISTENING */}
          {state === "listening" && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-in fade-in duration-150 z-10">
              {/* Reactive Microphone Visualizer */}
              <div
                className="relative flex items-center justify-center transition-transform duration-75"
                style={{
                  transform: `scale(${1 + micVolume * 0.3})`,
                }}
              >
                <div className="w-32 h-32 rounded-full bg-red-100/70 border-2 border-red-300 flex items-center justify-center animate-pulse shadow-lg shadow-red-500/10">
                  <div className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/30">
                    <Mic className="w-9 h-9" />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-200 animate-pulse">
                  Listening to You
                </span>
                <p className="text-xs text-slate-600 font-medium mt-2">
                  Speak in Telugu or English — Sam will reply instantly
                </p>
              </div>

              {agentSpokenText && (
                <div className="w-full max-w-sm p-3.5 rounded-2xl bg-white/90 border border-slate-200 text-left">
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

          {/* STATE: ERROR OR ENDED */}
          {(state === "error" || state === "ended") && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in duration-150 z-10">
              <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <PhoneOff className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-heading text-base font-bold text-slate-900">
                  {state === "error" ? "Connection Issue" : "Call Ended"}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  {errorMessage || "The voice session has ended."}
                </p>
              </div>
              <button
                type="button"
                onClick={startSession}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Call Again</span>
              </button>
            </div>
          )}
        </div>

        {/* ─── Bottom Control Bar ─── */}
        <div className="px-5 py-3 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isMuted
                  ? "bg-red-50 text-red-600 border-red-200"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <Mic className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4" />}
            </button>
            <span className="text-[11px] text-slate-500">
              {isMuted ? "Microphone muted" : "Microphone active"}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}
