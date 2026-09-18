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
import { Room, RoomEvent, Track, RemoteParticipant, RemoteTrackPublication, RemoteTrack } from "livekit-client";

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

export function LiveAgentAudioModal({ isOpen, onClose }: Props) {
  const [state, setState] = useState<ConvState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [agentSpokenText, setAgentSpokenText] = useState("");
  const [micVolume, setMicVolume] = useState(0);

  // LiveKit Room ref and audio output ref
  const roomRef = useRef<Room | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isCallActiveRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Stop / interrupt agent audio
  const stopAgentAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setState("listening");
  }, []);

  // Clean teardown
  const terminateSession = useCallback(() => {
    isCallActiveRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch {}
      roomRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
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
  }, []);

  // Handle modal close
  const handleClose = () => {
    terminateSession();
    onClose();
  };

  // Teardown on unmount or when modal closes
  useEffect(() => {
    if (!isOpen) {
      terminateSession();
    }
    return () => {
      terminateSession();
    };
  }, [isOpen, terminateSession]);

  // Start the voice-only session using LiveKit WebRTC
  const startVoiceCall = async () => {
    setErrorMessage("");
    setAgentSpokenText("");
    setState("requesting_mic");

    try {
      // 1. Request short-lived LiveKit token from QETA control plane
      const sessionRes = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const sessionData = await sessionRes.json();

      if (!sessionRes.ok || !sessionData.success || !sessionData.token) {
        throw new Error(sessionData.error || "Failed to initialize live voice session");
      }

      setState("connecting");
      isCallActiveRef.current = true;

      // 2. Initialize LiveKit Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      roomRef.current = room;

      // Attach track subscription handler (plays incoming Agent audio)
      room.on(
        RoomEvent.TrackSubscribed,
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            console.log(`[LiveKit WebRTC] Subscribed to audio track from ${participant.identity}`);
            if (audioElementRef.current) {
              track.attach(audioElementRef.current);
            } else {
              const audioEl = track.attach();
              audioEl.autoplay = true;
              audioEl.setAttribute("playsinline", "true");
            }
            setState("speaking");
          }
        }
      );

      // Track active speakers for UI pulse
      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (!isCallActiveRef.current) return;
        const agentSpeaking = speakers.some((s) => s.identity !== room.localParticipant.identity);
        const userSpeaking = speakers.some((s) => s.identity === room.localParticipant.identity);

        if (agentSpeaking) {
          setState("speaking");
        } else if (userSpeaking || speakers.length === 0) {
          setState("listening");
        }
      });

      // Track disconnection
      room.on(RoomEvent.Disconnected, () => {
        if (isCallActiveRef.current) {
          setState("idle");
          isCallActiveRef.current = false;
        }
      });

      // 3. Connect to LiveKit Cloud Room
      await room.connect(sessionData.livekitUrl, sessionData.token);
      console.log(`[LiveKit WebRTC] Connected to room ${room.name}`);

      // 4. Publish Microphone Track
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log("[LiveKit WebRTC] Microphone enabled");

      // Setup local audio analyser for volume visualizer
      try {
        const localTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track;
        if (localTrack?.mediaStreamTrack) {
          const stream = new MediaStream([localTrack.mediaStreamTrack]);
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new AudioCtx();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
          audioContextRef.current = ctx;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!isCallActiveRef.current) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            setMicVolume(Math.min(1, avg / 80));
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (analyserErr) {
        console.warn("[Visualizer] Analyser setup skipped:", analyserErr);
      }

      setState("listening");
    } catch (err: unknown) {
      console.error("[StartVoiceCall Error]", err);
      setErrorMessage(err instanceof Error ? err.message : "Could not connect to live voice agent");
      setState("error");
    }
  };

  if (!isOpen) return null;

  const isOnCall = state !== "idle" && state !== "error";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Hidden audio element for remote WebRTC stream */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      <div
        className="relative w-full sm:max-w-[520px] bg-white sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "min(700px, 96dvh)" }}
      >
        {/* ─── Header ─── */}
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
                    : "Establishing ultra-low latency WebRTC stream..."}
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

              {/* Manual Interrupt Button */}
              <button
                type="button"
                onClick={stopAgentAudio}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>Tap to pause Harika</span>
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

        {/* ─── Footer ─── */}
        <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <Link
            href="/login"
            onClick={handleClose}
            className="text-[11px] font-semibold text-slate-600 hover:text-emerald-800 transition flex items-center gap-1"
          >
            Open Console <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-emerald-500" /> LiveKit WebRTC Full-Duplex Audio
          </span>
        </div>
      </div>
    </div>
  );
}
