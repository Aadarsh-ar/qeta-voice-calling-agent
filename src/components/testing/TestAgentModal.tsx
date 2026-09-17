"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Volume2,
  Sparkles,
  Zap,
  Activity,
  Bot,
  User,
  RotateCcw,
  BookOpen,
  Wrench,
  ShieldAlert,
  Mic,
  MicOff,
  Radio,
  ChevronDown,
  ChevronUp,
  Terminal,
  PhoneOff,
  Square,
  Globe,
  HelpCircle,
  Play,
} from "lucide-react";

interface TestTurn {
  role: "caller" | "ai";
  text: string;
  normalizedText?: string;
  intent?: string;
  customerInput?: string;
  cartesiaVoiceId?: string;
  retrievedSnippets?: { source: string; title: string; score: number; content?: string }[];
  toolCalls?: { name: string; args: Record<string, unknown>; result: unknown }[];
  qualityValidation?: { wasModified: boolean; modificationReason?: string };
  latencies?: {
    sttMs: number;
    llmMs: number;
    ttsMs: number;
    totalMs: number;
  };
  audioBase64?: string;
  timestamp: string;
}

interface TestAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  agentName?: string;
  initialGreeting?: string;
  instructions?: string;
  systemPrompt?: string;
}

type CallStatus = "IDLE" | "CONNECTING" | "LISTENING" | "THINKING" | "SPEAKING" | "MUTED";

export function TestAgentModal({
  isOpen,
  onClose,
  agentId,
  agentName = "Telugu Sales Agent",
  initialGreeting = "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
  instructions,
  systemPrompt,
}: TestAgentModalProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("IDLE");
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [callDuration, setCallDuration] = useState<number>(0);
  const [speechLanguage, setSpeechLanguage] = useState<"te-IN" | "en-IN">("te-IN");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [openTraceIndex, setOpenTraceIndex] = useState<number | null>(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState<boolean>(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [micErrorMessage, setMicErrorMessage] = useState<string | null>(null);
  const [showManualFallback, setShowManualFallback] = useState<boolean>(false);
  const [manualText, setManualText] = useState<string>("");

  const [turns, setTurns] = useState<TestTurn[]>([
    {
      role: "ai",
      text: initialGreeting,
      normalizedText: initialGreeting,
      timestamp: "00:00",
    },
  ]);

  // Audio & Speech refs
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const micMediaStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isListeningIntentionalRef = useRef<boolean>(false);

  // Play PCM audio from Cartesia base64 string
  const playPcmAudio = useCallback(async (base64: string, sampleRate = 16000, onEnded?: () => void) => {
    try {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )({ sampleRate });
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      // Stop any prior playing audio
      if (activeAudioSourceRef.current) {
        try {
          activeAudioSourceRef.current.stop();
        } catch {}
      }

      const buffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      buffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      source.onended = () => {
        activeAudioSourceRef.current = null;
        if (onEnded) onEnded();
      };

      activeAudioSourceRef.current = source;
      setCallStatus("SPEAKING");
      source.start();
    } catch (e) {
      console.warn("Audio playback error:", e);
      if (onEnded) onEnded();
    }
  }, []);

  // Stop current agent audio (for barge-in interruption)
  const interruptAgentAudio = useCallback(() => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
        activeAudioSourceRef.current = null;
      } catch {}
    }
  }, []);

  // Submit spoken turn to backend AI orchestrator & Cartesia TTS
  const handleTurnSubmit = useCallback(
    async (spokenText: string) => {
      const textToSend = spokenText.trim();
      if (!textToSend) return;

      // Stop recognition while waiting for AI response
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }

      setCallStatus("THINKING");
      setLiveTranscript("");

      const callerTurn: TestTurn = {
        role: "caller",
        text: textToSend,
        timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
      };

      setTurns((prev) => [...prev, callerTurn]);

      try {
        const conversationHistory = [...turns, callerTurn].map((t) => ({
          role: t.role === "caller" ? "user" : "assistant",
          content: t.text,
        }));

        const effectivePrompt = (systemPrompt || instructions || "").trim();
        const res = await fetch("/api/agent/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            agentName,
            systemPrompt: effectivePrompt,
            instructions: effectivePrompt,
            userMessage: textToSend,
            conversationHistory,
          }),
        });

        const data = await res.json();

        if (data.success) {
          const aiTurn: TestTurn = {
            role: "ai",
            text: data.rawReply,
            normalizedText: data.normalizedReply,
            intent: data.intent || "General Inquiry",
            customerInput: textToSend,
            cartesiaVoiceId: data.cartesiaVoiceId,
            retrievedSnippets: data.retrievedSnippets,
            toolCalls: data.toolCalls,
            qualityValidation: data.qualityValidation,
            latencies: data.latencies,
            audioBase64: data.audioBase64,
            timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
          };

          setTurns((prev) => [...prev, aiTurn]);

          // Play Cartesia spoken audio
          if (data.audioBase64) {
            playPcmAudio(data.audioBase64, data.sampleRate || 16000, () => {
              // Once agent finishes speaking, automatically re-arm mic for continuous caller speech
              if (!isMuted && isListeningIntentionalRef.current) {
                startListening();
              } else {
                setCallStatus("IDLE");
              }
            });
          } else {
            // No audio returned, re-arm listening after short pause
            setTimeout(() => {
              if (!isMuted && isListeningIntentionalRef.current) {
                startListening();
              }
            }, 800);
          }
        } else {
          setTurns((prev) => [
            ...prev,
            {
              role: "ai",
              text: `(Error: ${data.error || "Turn processing failed"})`,
              timestamp: "Error",
            },
          ]);
          setCallStatus("IDLE");
        }
      } catch (err) {
        console.error("Test turn error:", err);
        setTurns((prev) => [
          ...prev,
          {
            role: "ai",
            text: "(Network error reaching voice test pipeline)",
            timestamp: "Error",
          },
        ]);
        setCallStatus("IDLE");
      }
    },
    [agentId, turns, isMuted, playPcmAudio]
  );

  // Start continuous Web Speech Recognition
  const startListening = useCallback(() => {
    if (isMuted) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicErrorMessage("Speech recognition not supported in this browser. Please use Chrome or Edge.");
      setShowManualFallback(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLanguage;

      recognition.onstart = () => {
        setCallStatus("LISTENING");
        setMicErrorMessage(null);
        isListeningIntentionalRef.current = true;
      };

      recognition.onresult = (event: any) => {
        // If agent was speaking and user begins talking, execute barge-in
        interruptAgentAudio();

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += trans;
          } else {
            interim += trans;
          }
        }

        const currentSpoken = (final || interim).trim();
        setLiveTranscript(currentSpoken);

        // Reset silence timer on every new word detected
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        if (final.trim()) {
          // Final sentence segment detected: auto-submit after natural 600ms boundary
          silenceTimerRef.current = setTimeout(() => {
            handleTurnSubmit(final.trim());
          }, 600);
        } else if (currentSpoken.length > 2) {
          // Continuous interim speech: wait for 1300ms pause of silence, then auto-submit
          silenceTimerRef.current = setTimeout(() => {
            if (currentSpoken.trim()) {
              handleTurnSubmit(currentSpoken.trim());
            }
          }, 1300);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") return;
        if (event.error === "not-allowed") {
          setMicErrorMessage("Microphone access blocked. Please allow mic permission in your browser address bar.");
          setCallStatus("IDLE");
          setShowManualFallback(true);
        }
      };

      recognition.onend = () => {
        // Auto-restart if we are still meant to be in listening state and not waiting for AI turn
        if (
          isListeningIntentionalRef.current &&
          callStatus !== "THINKING" &&
          callStatus !== "SPEAKING" &&
          !isMuted
        ) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (e) {
      console.warn("Speech recognition start failed:", e);
    }
  }, [speechLanguage, isMuted, callStatus, handleTurnSubmit, interruptAgentAudio]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningIntentionalRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  // Initialize Microphone decibel audio analyser for animated waveform
  const initMicAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micMediaStreamRef.current = stream;

      const audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        if (!micAnalyserRef.current) return;
        micAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (err) {
      console.warn("Could not capture mic stream for volume visualizer:", err);
    }
  }, []);

  // Connect call when modal opens
  const connectCall = useCallback(async () => {
    setCallStatus("CONNECTING");
    setCallDuration(0);
    setMicErrorMessage(null);

    // Start duration timer
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    // Initialize mic analyser
    await initMicAnalyser();

    // Trigger initial agent greeting voice synthesis
    try {
      const effectivePrompt = (systemPrompt || instructions || "").trim();
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName,
          systemPrompt: effectivePrompt,
          instructions: effectivePrompt,
          userMessage: initialGreeting,
          conversationHistory: [],
        }),
      });

      const data = await res.json();
      if (data.success && data.audioBase64) {
        playPcmAudio(data.audioBase64, data.sampleRate || 16000, () => {
          startListening();
        });
      } else {
        startListening();
      }
    } catch {
      startListening();
    }
  }, [agentId, initialGreeting, initMicAnalyser, playPcmAudio, startListening]);

  // Clean up all audio streams and timers on close
  const disconnectCall = useCallback(() => {
    stopListening();
    interruptAgentAudio();

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micMediaStreamRef.current) {
      micMediaStreamRef.current.getTracks().forEach((t) => t.stop());
      micMediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    setCallStatus("IDLE");
    setLiveTranscript("");
    setMicVolumeLevel(0);
  }, [stopListening, interruptAgentAudio]);

  // Handle modal mount / open
  useEffect(() => {
    if (isOpen) {
      connectCall();
    } else {
      disconnectCall();
    }
    return () => {
      disconnectCall();
    };
  }, [isOpen]);

  // Format timer MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Toggle Mute
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startListening();
    } else {
      setIsMuted(true);
      stopListening();
      setCallStatus("MUTED");
    }
  };

  // Reset conversation
  const resetCall = () => {
    disconnectCall();
    setTurns([
      {
        role: "ai",
        text: initialGreeting,
        normalizedText: initialGreeting,
        timestamp: "00:00",
      },
    ]);
    setTimeout(() => {
      connectCall();
    }, 200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Top Calling Status Bar */}
        <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  callStatus === "SPEAKING"
                    ? "bg-indigo-500 animate-pulse"
                    : callStatus === "LISTENING"
                    ? "bg-emerald-500 animate-ping"
                    : callStatus === "THINKING"
                    ? "bg-amber-500 animate-spin"
                    : "bg-slate-500"
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-white text-base tracking-tight truncate">
                  {agentName}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold uppercase tracking-wider">
                  Live Voice
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-mono text-emerald-400 font-medium">
                  {formatTime(callDuration)}
                </span>
                <span>•</span>
                <span>Cartesia 16kHz Neural</span>
                <span>•</span>
                <span className="text-[11px] text-slate-400">
                  {speechLanguage === "te-IN" ? "Telugu (te-IN)" : "English (en-IN)"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <button
              onClick={() => {
                const nextLang = speechLanguage === "te-IN" ? "en-IN" : "te-IN";
                setSpeechLanguage(nextLang);
                if (callStatus === "LISTENING") {
                  stopListening();
                  setTimeout(startListening, 100);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
              title="Toggle Mic Speech Language"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{speechLanguage === "te-IN" ? "తెలుగు" : "EN"}</span>
            </button>

            <button
              onClick={resetCall}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
              title="Redial / Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                disconnectCall();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition"
              title="End call"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Central Hands-Free Mic Calling Room */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-y-auto">
          {/* Subtle Ambient Glow */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity duration-700 ${
              callStatus === "SPEAKING"
                ? "bg-radial-indigo opacity-30"
                : callStatus === "LISTENING"
                ? "bg-radial-emerald opacity-25"
                : "opacity-0"
            }`}
          />

          {/* Large Pulsating Voice Orb */}
          <div className="relative mb-8 mt-2">
            {/* Pulsing Ripple Rings */}
            {callStatus === "LISTENING" && (
              <>
                <div
                  className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping duration-1000"
                  style={{ animationDuration: "2.4s" }}
                />
                <div
                  className="absolute -inset-8 rounded-full border border-emerald-500/30 animate-pulse"
                  style={{ transform: `scale(${1 + micVolumeLevel / 150})` }}
                />
              </>
            )}

            {callStatus === "SPEAKING" && (
              <>
                <div
                  className="absolute -inset-6 rounded-full bg-indigo-500/25 animate-ping"
                  style={{ animationDuration: "1.8s" }}
                />
                <div className="absolute -inset-10 rounded-full border border-indigo-500/40 animate-pulse" />
              </>
            )}

            {callStatus === "THINKING" && (
              <div className="absolute -inset-6 rounded-full border-2 border-dashed border-amber-500/50 animate-spin duration-700" />
            )}

            {/* Central Interactive Orb Button */}
            <button
              onClick={() => {
                if (callStatus === "SPEAKING") {
                  // Barge in!
                  interruptAgentAudio();
                  startListening();
                } else if (callStatus === "LISTENING") {
                  toggleMute();
                } else if (isMuted || callStatus === "MUTED") {
                  toggleMute();
                } else {
                  startListening();
                }
              }}
              className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center shadow-2xl transition-all duration-300 ${
                callStatus === "LISTENING"
                  ? "bg-emerald-600 text-white ring-8 ring-emerald-500/20 shadow-emerald-900/50 scale-105"
                  : callStatus === "SPEAKING"
                  ? "bg-indigo-600 text-white ring-8 ring-indigo-500/20 shadow-indigo-900/50 scale-105"
                  : callStatus === "THINKING"
                  ? "bg-amber-600 text-white ring-8 ring-amber-500/20 shadow-amber-900/50"
                  : isMuted
                  ? "bg-rose-900/80 text-rose-300 ring-8 ring-rose-900/20"
                  : "bg-slate-800 text-slate-300 ring-4 ring-slate-700"
              }`}
            >
              {callStatus === "LISTENING" ? (
                <>
                  <Mic className="w-10 h-10 animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
                    Listening
                  </span>
                </>
              ) : callStatus === "SPEAKING" ? (
                <>
                  <Volume2 className="w-10 h-10 animate-bounce" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
                    Agent Speaking
                  </span>
                </>
              ) : callStatus === "THINKING" ? (
                <>
                  <Activity className="w-10 h-10 animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
                    Thinking...
                  </span>
                </>
              ) : isMuted ? (
                <>
                  <MicOff className="w-10 h-10" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
                    Muted
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-10 h-10" />
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
                    Tap to Speak
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Dynamic Frequency Waveform Visualization */}
          <div className="flex items-center justify-center gap-1.5 h-10 mb-6">
            {[40, 65, 85, 100, 75, 50, 90, 60, 45, 70, 80, 55, 35].map((height, i) => {
              const activeHeight =
                callStatus === "LISTENING"
                  ? Math.max(15, (height * micVolumeLevel) / 100)
                  : callStatus === "SPEAKING"
                  ? Math.max(20, Math.sin(Date.now() / 150 + i) * 35 + 45)
                  : 12;

              return (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-150 ${
                    callStatus === "LISTENING"
                      ? "bg-emerald-400"
                      : callStatus === "SPEAKING"
                      ? "bg-indigo-400"
                      : "bg-slate-700 opacity-40"
                  }`}
                  style={{ height: `${activeHeight}px` }}
                />
              );
            })}
          </div>

          {/* Status Label / Directive */}
          <div className="max-w-md mx-auto mb-4">
            {callStatus === "LISTENING" && (
              <p className="text-sm font-semibold text-emerald-400 animate-pulse">
                🎙️ Speak into your microphone... (Hands-free auto turn)
              </p>
            )}
            {callStatus === "SPEAKING" && (
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-300">
                <span>🔊 Cartesia Neural Voice is speaking...</span>
                <button
                  onClick={() => {
                    interruptAgentAudio();
                    startListening();
                  }}
                  className="px-2.5 py-0.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-rose-500/30 transition flex items-center gap-1"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Interrupt
                </button>
              </div>
            )}
            {callStatus === "THINKING" && (
              <p className="text-sm font-semibold text-amber-400 flex items-center justify-center gap-1.5">
                <Activity className="w-4 h-4 animate-spin" />
                Generating turn (Sarvam STT → Normalizer → Cartesia TTS)...
              </p>
            )}
            {callStatus === "MUTED" && (
              <p className="text-sm font-semibold text-rose-400">
                Microphone is muted. Tap orb or Unmute to speak.
              </p>
            )}
            {callStatus === "IDLE" && !micErrorMessage && (
              <p className="text-sm text-slate-400">
                Microphone idle. Tap the orb to resume speaking.
              </p>
            )}
            {micErrorMessage && (
              <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-medium">
                {micErrorMessage}
              </div>
            )}
          </div>

          {/* Live Real-time Subtitles / Speech Transcript Caption */}
          <div className="w-full max-w-xl min-h-[56px] px-6 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-center shadow-inner">
            {liveTranscript ? (
              <p className="text-sm sm:text-base font-medium text-emerald-300 italic animate-in fade-in">
                "{liveTranscript}"
              </p>
            ) : callStatus === "SPEAKING" ? (
              <p className="text-xs sm:text-sm text-indigo-200 line-clamp-2">
                "{turns[turns.length - 1]?.text}"
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-mono">
                {callStatus === "LISTENING"
                  ? "Say something in Telugu or English (e.g. 'మీ సర్వీసెస్ గురించి చెప్పండి')..."
                  : "Live subtitles will appear here as you speak..."}
              </p>
            )}
          </div>

          {/* Emergency Manual Fallback Option */}
          {showManualFallback && (
            <div className="w-full max-w-xl mt-4 p-3 rounded-2xl bg-slate-800/80 border border-slate-700 flex gap-2">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualText.trim()) {
                    handleTurnSubmit(manualText);
                    setManualText("");
                  }
                }}
                placeholder="Fallback: Type message here if mic blocked..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
              />
              <button
                onClick={() => {
                  if (manualText.trim()) {
                    handleTurnSubmit(manualText);
                    setManualText("");
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
              >
                Send
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Call Transcript & Section 17 Runtime Trace */}
        <div className="border-t border-slate-800/80 bg-slate-950/80">
          <div className="px-5 py-3 flex items-center justify-between">
            <button
              onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
              className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span>Call Transcript & Latency Trace ({turns.length} turns)</span>
              {isTranscriptExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() => setShowManualFallback(!showManualFallback)}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline decoration-slate-600"
            >
              {showManualFallback ? "Hide typing option" : "Mic issues? Type instead"}
            </button>
          </div>

          {isTranscriptExpanded && (
            <div className="p-5 max-h-64 overflow-y-auto space-y-3 bg-slate-900/60 border-t border-slate-800">
              {turns.map((turn, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${
                    turn.role === "caller" ? "justify-end" : "justify-start"
                  }`}
                >
                  {turn.role === "ai" && (
                    <div className="w-7 h-7 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 flex items-center justify-center shrink-0 text-xs">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                      turn.role === "caller"
                        ? "bg-emerald-900/90 text-emerald-50 border border-emerald-700/50"
                        : "bg-slate-800 text-slate-100 border border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-70">
                      <span className="font-bold">
                        {turn.role === "caller" ? "You (Spoken into Mic)" : agentName}
                      </span>
                      <span>{turn.timestamp}</span>
                    </div>

                    <p>{turn.text}</p>

                    {/* Section 17 Latencies */}
                    {turn.latencies && (
                      <div className="mt-2 pt-2 border-t border-slate-700/80 flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-amber-400">
                          STT: {turn.latencies.sttMs}ms
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-indigo-400">
                          LLM: {turn.latencies.llmMs}ms
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400">
                          TTS: {turn.latencies.ttsMs}ms
                        </span>
                        <span className="ml-auto font-bold text-emerald-300">
                          Total: {turn.latencies.totalMs}ms
                        </span>
                      </div>
                    )}

                    {turn.audioBase64 && (
                      <button
                        onClick={() => playPcmAudio(turn.audioBase64!)}
                        className="mt-1.5 text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <Volume2 className="w-3 h-3" />
                        Replay Audio
                      </button>
                    )}
                  </div>

                  {turn.role === "caller" && (
                    <div className="w-7 h-7 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center justify-center shrink-0 text-xs">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Hands-Free Call Action Bar */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 border ${
                isMuted
                  ? "bg-rose-600 hover:bg-rose-500 text-white border-rose-500"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
            </button>

            {callStatus === "SPEAKING" && (
              <button
                onClick={() => {
                  interruptAgentAudio();
                  startListening();
                }}
                className="px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Barge In (Interrupt)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                disconnectCall();
                onClose();
              }}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950 transition flex items-center gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
