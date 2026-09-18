"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Send,
  Play,
  RotateCcw,
  PhoneOff,
  Sparkles,
  Bot,
  User,
  Zap,
  Loader2,
} from "lucide-react";

interface TestTurn {
  role: "caller" | "ai";
  text: string;
  audioBase64?: string;
  latencyMs?: number;
  timestamp: string;
  isLoadingAudio?: boolean;
}

interface TestAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  agentName?: string;
  cartesiaVoiceId?: string;
  initialGreeting?: string;
  instructions?: string;
  systemPrompt?: string;
}

const DEFAULT_GREETING = "నమస్తే అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను. మీ అబ్బాయి కాలేజ్ అటెండెన్స్ గురించి కాల్ చేశాను.";

const QUICK_PROMPTS = [
  "నమస్తే అండి, మీరు ఎవరు?",
  "అటెండెన్స్ వివరాలు చెప్పండి",
  "ఈ రోజు ఏ క్లాసెస్ జరిగాయి?",
  "ఫీజు ఎప్పుడు కట్టాలి?",
  "మా అబ్బాయికి ఎన్ని మార్కులు వచ్చాయి?",
  "ప్రిన్సిపాల్ మేడమ్‌తో మాట్లాడాలి",
];

export function TestAgentModal({
  isOpen,
  onClose,
  agentId,
  agentName = "Harika (Telugu Faculty Voice)",
  cartesiaVoiceId,
  initialGreeting = DEFAULT_GREETING,
  instructions,
  systemPrompt,
}: TestAgentModalProps) {
  const [inputText, setInputText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);

  const effectiveGreeting = (initialGreeting || DEFAULT_GREETING).trim();

  const [turns, setTurns] = useState<TestTurn[]>([
    {
      role: "ai",
      text: effectiveGreeting,
      timestamp: "00:00",
      isLoadingAudio: true,
    },
  ]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const greetingAudioRef = useRef<string | null>(null);

  // Synchronously initialize or resume AudioContext on user gesture
  const ensureAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx({ sampleRate: 16000 });
      }
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
      return audioContextRef.current;
    } catch (err) {
      console.warn("[TestAgent] AudioContext error:", err);
      return null;
    }
  }, []);

  // Safely play PCM 16-bit 16kHz audio from Cartesia
  const playPcmAudio = useCallback(
    (base64: string, sampleRate = 16000, onEnded?: () => void) => {
      if (isMuted) {
        if (onEnded) onEnded();
        return;
      }
      try {
        const binary = window.atob(base64);
        const len = binary.length;
        if (len === 0) {
          if (onEnded) onEnded();
          return;
        }

        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        // Safe PCM decoding using DataView (never throws RangeError on odd byte lengths)
        const numSamples = Math.floor(len / 2);
        const float32 = new Float32Array(numSamples);
        const dataView = new DataView(bytes.buffer, bytes.byteOffset, numSamples * 2);
        for (let i = 0; i < numSamples; i++) {
          float32[i] = dataView.getInt16(i * 2, true) / 32768.0;
        }

        const ctx = ensureAudioContext();
        if (!ctx) {
          if (onEnded) onEnded();
          return;
        }

        if (activeSourceRef.current) {
          try {
            activeSourceRef.current.stop();
          } catch {}
          activeSourceRef.current = null;
        }

        const buffer = ctx.createBuffer(1, float32.length, sampleRate);
        buffer.getChannelData(0).set(float32);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        setIsSpeaking(true);
        source.onended = () => {
          activeSourceRef.current = null;
          setIsSpeaking(false);
          if (onEnded) onEnded();
        };

        activeSourceRef.current = source;
        source.start();

        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            setIsAutoplayBlocked(false);
          }).catch(() => {
            setIsAutoplayBlocked(true);
          });
        } else {
          setIsAutoplayBlocked(false);
        }
      } catch (err) {
        console.warn("[TestAgent] PCM audio playback error:", err);
        setIsSpeaking(false);
        if (onEnded) onEnded();
      }
    },
    [isMuted, ensureAudioContext]
  );

  const stopAudio = useCallback(() => {
    if (activeSourceRef.current) {
      try {
        activeSourceRef.current.stop();
      } catch {}
      activeSourceRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Timer counter
  useEffect(() => {
    if (isOpen) {
      setCallSeconds(0);
      timerRef.current = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudio();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudio();
    };
  }, [isOpen, stopAudio]);

  // Auto scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isThinking]);

  // Synthesize and speak the initial greeting whenever the modal is opened
  useEffect(() => {
    if (!isOpen) {
      greetingAudioRef.current = null;
      return;
    }

    const greetingText = (initialGreeting || DEFAULT_GREETING).trim();
    setTurns([
      {
        role: "ai",
        text: greetingText,
        timestamp: "00:00",
        isLoadingAudio: true,
      },
    ]);

    let isCancelled = false;
    setIsGreetingLoading(true);

    // Fetch synthesized TTS greeting audio
    fetch("/api/agent/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        agentName,
        cartesiaVoiceId,
        ttsOnly: true,
        textToSpeak: greetingText,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        setIsGreetingLoading(false);
        if (data.success && data.audioBase64) {
          greetingAudioRef.current = data.audioBase64;
          setTurns((prev) =>
            prev.map((t, idx) =>
              idx === 0
                ? {
                    ...t,
                    audioBase64: data.audioBase64,
                    latencyMs: 120,
                    isLoadingAudio: false,
                  }
                : t
            )
          );

          // Automatically speak the greeting aloud
          playPcmAudio(data.audioBase64, data.sampleRate || 16000);
        } else {
          setTurns((prev) =>
            prev.map((t, idx) => (idx === 0 ? { ...t, isLoadingAudio: false } : t))
          );
        }
      })
      .catch((err) => {
        console.warn("[TestAgent] Greeting audio synthesis notice:", err);
        if (!isCancelled) {
          setIsGreetingLoading(false);
          setTurns((prev) =>
            prev.map((t, idx) => (idx === 0 ? { ...t, isLoadingAudio: false } : t))
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, agentId, agentName, cartesiaVoiceId, initialGreeting, playPcmAudio]);

  // Send turn to backend
  const handleSend = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isThinking) return;

    // Synchronously ensure AudioContext is active on user click
    ensureAudioContext();
    stopAudio();
    setInputText("");
    setIsThinking(true);

    const now = new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
    const userTurn: TestTurn = {
      role: "caller",
      text: cleanText,
      timestamp: now,
    };

    setTurns((prev) => [...prev, userTurn]);

    try {
      const history = [...turns, userTurn].map((t) => ({
        role: t.role === "caller" ? "user" : "assistant",
        content: t.text,
      }));

      const effectiveInstructions = (instructions || systemPrompt || "").trim();
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName,
          cartesiaVoiceId,
          instructions: effectiveInstructions,
          systemPrompt: effectiveInstructions,
          userMessage: cleanText,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      if (data.success && data.rawReply) {
        const aiTurn: TestTurn = {
          role: "ai",
          text: data.rawReply,
          audioBase64: data.audioBase64,
          latencyMs: data.latencies?.totalMs,
          timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        };
        setTurns((prev) => [...prev, aiTurn]);

        if (data.audioBase64) {
          playPcmAudio(data.audioBase64, data.sampleRate || 16000);
        }
      } else {
        setTurns((prev) => [
          ...prev,
          {
            role: "ai",
            text: data.error || "క్షమించండి, సర్వర్ నుండి ప్రతిస్పందన రాలేదు.",
            timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
          },
        ]);
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: "ai",
          text: "కనెక్షన్ సమస్య వచ్చింది. దయచేసి మళ్ళీ ప్రయత్నించండి.",
          timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  // Toggle Microphone
  const toggleListening = () => {
    ensureAudioContext();
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Microphone recognition is not supported in this browser. Please type your message below.");
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = "te-IN";
      rec.continuous = false;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
        stopAudio();
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInputText(transcript);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  // Reset conversation
  const handleReset = () => {
    ensureAudioContext();
    stopAudio();
    const greetingText = (initialGreeting || DEFAULT_GREETING).trim();
    setTurns([
      {
        role: "ai",
        text: greetingText,
        timestamp: "00:00",
        audioBase64: greetingAudioRef.current || undefined,
        latencyMs: 120,
      },
    ]);
    setCallSeconds(0);

    if (greetingAudioRef.current) {
      playPcmAudio(greetingAudioRef.current);
    } else {
      setIsGreetingLoading(true);
      fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName,
          cartesiaVoiceId,
          ttsOnly: true,
          textToSpeak: greetingText,
        }),
      })
        .then((r) => r.json())
        .then((d) => {
          setIsGreetingLoading(false);
          if (d.success && d.audioBase64) {
            greetingAudioRef.current = d.audioBase64;
            setTurns([
              {
                role: "ai",
                text: greetingText,
                timestamp: "00:00",
                audioBase64: d.audioBase64,
                latencyMs: 120,
              },
            ]);
            playPcmAudio(d.audioBase64);
          }
        })
        .catch(() => setIsGreetingLoading(false));
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[92vh] max-h-[720px] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-600 text-white shadow-sm">
              <Bot className="w-5 h-5" />
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {agentName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Cartesia Sonic
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="inline-flex items-center gap-1 font-mono font-medium text-emerald-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {formatDuration(callSeconds)}
                </span>
                <span>•</span>
                <span className="text-[11px] text-slate-500 font-medium">
                  {isSpeaking
                    ? "Speaking..."
                    : isThinking
                    ? "Thinking..."
                    : isListening
                    ? "Listening..."
                    : isGreetingLoading
                    ? "Synthesizing voice..."
                    : "Ready"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                ensureAudioContext();
                setIsMuted(!isMuted);
                if (!isMuted) stopAudio();
              }}
              className={`p-2 rounded-xl border transition ${
                isMuted
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title={isMuted ? "Unmute Agent Voice" : "Mute Agent Voice"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition ml-1"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Autoplay Unlock Notice (if browser blocked auto audio playback) */}
        {isAutoplayBlocked && turns[0]?.audioBase64 && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 font-medium shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-700 animate-bounce" />
              <span>Audio autoplay was paused by your browser. Click to hear the agent speak:</span>
            </div>
            <button
              onClick={() => {
                ensureAudioContext();
                if (turns[0]?.audioBase64) {
                  playPcmAudio(turns[0].audioBase64);
                }
                setIsAutoplayBlocked(false);
              }}
              className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition shrink-0"
            >
              Play Voice
            </button>
          </div>
        )}

        {/* Live Audio Visualizer Banner when speaking */}
        {isSpeaking && (
          <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-900 font-medium shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <span className="w-1 h-3 bg-indigo-600 rounded-full animate-pulse" />
                <span className="w-1 h-5 bg-indigo-600 rounded-full animate-pulse delay-75" />
                <span className="w-1 h-4 bg-indigo-600 rounded-full animate-pulse delay-150" />
                <span className="w-1 h-2 bg-indigo-600 rounded-full animate-pulse delay-100" />
              </span>
              <span>Agent is speaking live audio via Cartesia Sonic...</span>
            </div>
            <button
              onClick={stopAudio}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline"
            >
              Stop Audio
            </button>
          </div>
        )}

        {/* Conversation Transcript */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/40">
          {turns.map((turn, index) => {
            const isAi = turn.role === "ai";
            return (
              <div
                key={index}
                className={`flex items-start gap-2.5 ${isAi ? "justify-start" : "justify-end"}`}
              >
                {isAi && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                    isAi
                      ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                      : "bg-indigo-600 text-white rounded-tr-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                  <div
                    className={`flex items-center justify-between gap-3 mt-1.5 pt-1 text-[10px] ${
                      isAi ? "text-slate-400 border-t border-slate-100" : "text-indigo-200 border-t border-indigo-500/40"
                    }`}
                  >
                    <span>{turn.timestamp}</span>
                    {isAi && (
                      <div className="flex items-center gap-2">
                        {turn.audioBase64 ? (
                          <button
                            onClick={() => {
                              ensureAudioContext();
                              playPcmAudio(turn.audioBase64!);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 transition"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>{isSpeaking ? "Playing..." : "Replay"}</span>
                          </button>
                        ) : turn.isLoadingAudio ? (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>Generating voice...</span>
                          </span>
                        ) : null}

                        {turn.latencyMs && (
                          <span className="font-mono text-emerald-600 font-semibold inline-flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" />
                            {(turn.latencyMs / 1000).toFixed(2)}s
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {!isAi && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isThinking && (
            <div className="flex items-center gap-2.5 justify-start text-xs text-slate-500">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span className="text-slate-600 font-medium">Generating speech & Cartesia TTS...</span>
              </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* Quick Test Prompts */}
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider mr-1">
            Quick:
          </span>
          {QUICK_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => {
                ensureAudioContext();
                handleSend(prompt);
              }}
              disabled={isThinking}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-[11px] font-medium border border-slate-200 hover:border-indigo-200 transition shrink-0 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Bottom Input Area */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ensureAudioContext();
              handleSend(inputText);
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl border transition shrink-0 ${
                isListening
                  ? "bg-rose-600 text-white border-rose-600 animate-pulse shadow-md shadow-rose-500/20"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
              title={isListening ? "Listening... click to stop" : "Speak into microphone"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message in Telugu or English (e.g. అటెండెన్స్ వివరాలు చెప్పు)..."
              disabled={isThinking}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition shrink-0"
              title="End call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
