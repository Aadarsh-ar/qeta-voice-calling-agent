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
import { unlockAudio, getSharedAudioElement } from "@/lib/audio/unlock";
import { base64ToWavBlob, playAudioBase64, stopAudio } from "@/lib/audio/player";
import { DEFAULT_VOICE_ID, getVoiceName } from "@/lib/config/voices";

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

const DEFAULT_GREETING =
  "హలో అండి! నేను ప్రియ, qetadotin యొక్క AI Voice Assistant ని. మీకు ఎలా సహాయం చేయగలను?";

const QUICK_PROMPTS = [
  "హలో, మీరు ఎవరు?",
  "qetadotin గురించి చెప్పండి",
  "మీరు ఎలాంటి సర్వీసెస్ అందిస్తారు?",
  "ధర వివరాలు చెప్పండి",
  "ఒక డెమో బుక్ చేయండి",
  "థాంక్యూ, బాయ్!",
];

export function TestAgentModal({
  isOpen,
  onClose,
  agentId,
  agentName = "Priya (AI Voice Assistant · qetadotin)",
  cartesiaVoiceId = DEFAULT_VOICE_ID,
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
  const effectiveVoiceId = cartesiaVoiceId || DEFAULT_VOICE_ID;
  const effectiveVoiceName = getVoiceName(effectiveVoiceId);

  const [turns, setTurns] = useState<TestTurn[]>([
    {
      role: "ai",
      text: effectiveGreeting,
      timestamp: "00:00",
      isLoadingAudio: true,
    },
  ]);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const greetingAudioRef = useRef<string | null>(null);

  // Play audio base64 safely
  const playVoiceAudio = useCallback(
    (base64: string, sampleRate = 16000, onEnded?: () => void) => {
      if (isMuted) {
        if (onEnded) onEnded();
        return;
      }
      if (!base64 || base64.trim().length === 0) {
        if (onEnded) onEnded();
        return;
      }

      playAudioBase64(base64, {
        sampleRate,
        onStart: () => {
          setIsSpeaking(true);
          setIsAutoplayBlocked(false);
        },
        onEnded: () => {
          setIsSpeaking(false);
          if (onEnded) onEnded();
        },
        onError: () => {
          setIsSpeaking(false);
          setIsAutoplayBlocked(true);
          if (onEnded) onEnded();
        },
      });
    },
    [isMuted]
  );

  const handleStopAudio = useCallback(() => {
    stopAudio();
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
      handleStopAudio();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      handleStopAudio();
    };
  }, [isOpen, handleStopAudio]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isThinking]);

  // Initial greeting audio synthesis
  useEffect(() => {
    if (!isOpen) {
      greetingAudioRef.current = null;
      return;
    }

    unlockAudio();
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

    fetch("/api/agent/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId,
        agentName,
        cartesiaVoiceId: effectiveVoiceId,
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
                    latencyMs: 140,
                    isLoadingAudio: false,
                  }
                : t
            )
          );

          playVoiceAudio(data.audioBase64, data.sampleRate || 16000);
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
  }, [isOpen, agentId, agentName, effectiveVoiceId, initialGreeting, playVoiceAudio]);

  // Send message
  const handleSend = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isThinking) return;

    unlockAudio();
    handleStopAudio();
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
          cartesiaVoiceId: effectiveVoiceId,
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
          playVoiceAudio(data.audioBase64, data.sampleRate || 16000);
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
    unlockAudio();
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
        handleStopAudio();
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
    unlockAudio();
    handleStopAudio();
    const greetingText = (initialGreeting || DEFAULT_GREETING).trim();
    setTurns([
      {
        role: "ai",
        text: greetingText,
        timestamp: "00:00",
        audioBase64: greetingAudioRef.current || undefined,
        latencyMs: 140,
      },
    ]);
    setCallSeconds(0);

    if (greetingAudioRef.current) {
      playVoiceAudio(greetingAudioRef.current);
    } else {
      setIsGreetingLoading(true);
      fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName,
          cartesiaVoiceId: effectiveVoiceId,
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
                latencyMs: 140,
              },
            ]);
            playVoiceAudio(d.audioBase64);
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

  const handleClose = () => {
    handleStopAudio();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-md shadow-emerald-700/20">
              <Bot className="w-5 h-5" />
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 leading-tight">
                  {agentName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  {effectiveVoiceName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {formatDuration(callSeconds)}
                </span>
                <span>•</span>
                <span>
                  {isSpeaking
                    ? "Agent Speaking..."
                    : isThinking
                    ? "Synthesizing voice..."
                    : isListening
                    ? "Listening..."
                    : isGreetingLoading
                    ? "Warming up audio..."
                    : "Ready"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) handleStopAudio();
              }}
              className={`p-2 rounded-xl border transition ${
                isMuted
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-white hover:bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
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
              onClick={handleClose}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-800 border border-slate-200 transition ml-1"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Autoplay Unlock Notice */}
        {isAutoplayBlocked && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 font-medium shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-700 animate-bounce" />
              <span>Audio autoplay was paused by your browser. Click to hear speech:</span>
            </div>
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                const latestAiTurn = [...turns].reverse().find((t) => t.role === "ai" && t.audioBase64);
                if (latestAiTurn?.audioBase64) {
                  playVoiceAudio(latestAiTurn.audioBase64, 16000);
                }
                setIsAutoplayBlocked(false);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition cursor-pointer shrink-0"
            >
              Play Voice
            </button>
          </div>
        )}

        {/* Dynamic Speaking Equalizer Banner */}
        {isSpeaking && (
          <div className="px-5 py-2.5 bg-emerald-50/90 border-b border-emerald-200/60 flex items-center justify-between text-xs text-emerald-950 font-medium shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 h-3.5">
                <span className="w-1 bg-emerald-600 rounded-full animate-eq-1" />
                <span className="w-1 bg-emerald-600 rounded-full animate-eq-2" />
                <span className="w-1 bg-emerald-600 rounded-full animate-eq-3" />
                <span className="w-1 bg-emerald-600 rounded-full animate-eq-4" />
                <span className="w-1 bg-emerald-600 rounded-full animate-eq-2" />
              </div>
              <span className="font-semibold text-emerald-900">
                Agent is speaking live audio via Cartesia Neural Voice
              </span>
            </div>
            <button
              type="button"
              onClick={handleStopAudio}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
            >
              Stop Audio
            </button>
          </div>
        )}

        {/* Conversation Transcript */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/40 min-h-[280px]">
          {turns.map((turn, index) => {
            const isAi = turn.role === "ai";
            return (
              <div
                key={index}
                className={`flex items-start gap-2.5 ${isAi ? "justify-start" : "justify-end"}`}
              >
                {isAi && (
                  <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                    isAi
                      ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                      : "bg-emerald-700 text-white rounded-tr-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                  <div
                    className={`flex items-center justify-between gap-3 mt-1.5 pt-1 text-[10px] ${
                      isAi ? "text-slate-400 border-t border-slate-100" : "text-emerald-200 border-t border-emerald-600/40"
                    }`}
                  >
                    <span>{turn.timestamp}</span>
                    {isAi && (
                      <div className="flex items-center gap-2">
                        {turn.audioBase64 ? (
                          <button
                            onClick={() => {
                              unlockAudio();
                              playVoiceAudio(turn.audioBase64!);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 transition cursor-pointer"
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
                          <span className="font-mono text-emerald-700 font-semibold inline-flex items-center gap-0.5">
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
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 animate-spin" />
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
                unlockAudio();
                handleSend(prompt);
              }}
              disabled={isThinking}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-[11px] font-medium border border-slate-200 hover:border-emerald-200 transition shrink-0 disabled:opacity-50 cursor-pointer"
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
              unlockAudio();
              handleSend(inputText);
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2.5 rounded-xl border transition shrink-0 cursor-pointer ${
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
              placeholder="Type message in Telugu or English (e.g. qetadotin అంటే ఏమిటి?)..."
              disabled={isThinking}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition shrink-0 cursor-pointer"
              title="End test"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
