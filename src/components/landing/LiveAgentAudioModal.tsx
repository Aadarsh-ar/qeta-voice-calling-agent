"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Sparkles,
  Send,
  Play,
  RotateCcw,
  Zap,
  Loader2,
  Bot,
  User,
} from "lucide-react";

import { unlockAudio } from "@/lib/audio/unlock";

export interface LiveTurn {
  id: string;
  role: "ai" | "caller";
  text: string;
  audioBase64?: string;
  latencyMs?: number;
  timestamp: string;
  isLoadingAudio?: boolean;
}

interface LiveAgentAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId?: string;
  agentName?: string;
  initialGreeting?: string;
}

const DEFAULT_AGENT_ID = "agent_WzcEn6kkRmPxAfBNHzvpa1";
const DEFAULT_AGENT_NAME = "Sam (AI Voice Agent)";
const DEFAULT_GREETING =
  "హాయ్! నేను సామ్, qwetadotin యొక్క AI Voice Agent. నాతో ఏదైనా మాట్లాడండి — qwetadotin ఎలా పనిచేస్తుందో మీరే experience చేయొచ్చు.";

const QUICK_STARTERS = [
  "qwetadotin అంటే ఏమిటి?",
  "నువ్వు ఏం చేయగలవు?",
  "ఒక business scenario try చేద్దాం",
  "నేను ఒక restaurant owner",
  "నువ్వు మనిషివా?",
  "Pricing details చెప్పండి",
];

function base64ToWavBlob(base64: string, sampleRate = 16000): Blob {
  try {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Check for standard RIFF header (from Cartesia container: 'wav')
    if (len >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return new Blob([bytes], { type: "audio/wav" });
    }

    // Prepend standard 44-byte WAV header to raw PCM
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
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 for Mono)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate (sampleRate * numChannels * bitsPerSample/8)
    view.setUint16(32, 2, true); // BlockAlign (numChannels * bitsPerSample/8)
    view.setUint16(34, 16, true); // BitsPerSample
    // "data"
    view.setUint32(36, 0x64617461, false);
    view.setUint32(40, totalDataLen, true);

    return new Blob([wavHeader, bytes], { type: "audio/wav" });
  } catch (err) {
    console.warn("[LiveAgent] base64ToWavBlob notice:", err);
    return new Blob([], { type: "audio/wav" });
  }
}

export function LiveAgentAudioModal({
  isOpen,
  onClose,
  agentId = DEFAULT_AGENT_ID,
  agentName = DEFAULT_AGENT_NAME,
  initialGreeting = DEFAULT_GREETING,
}: LiveAgentAudioModalProps) {
  const [inputText, setInputText] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);

  const effectiveGreeting = (initialGreeting || DEFAULT_GREETING).trim();

  const [turns, setTurns] = useState<LiveTurn[]>([
    {
      id: "greeting",
      role: "ai",
      text: effectiveGreeting,
      timestamp: "00:00",
      isLoadingAudio: true,
    },
  ]);

  // Audio elements and refs
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const greetingAudioRef = useRef<string | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isHandsFree, setIsHandsFree] = useState(true);
  const isHandsFreeRef = useRef(true);
  isHandsFreeRef.current = isHandsFree;

  // Universal cross-browser audio playback with Blob URLs and Web Speech API fallback
  const playPcmAudio = useCallback(
    (base64?: string | null, sampleRate = 16000, onEnded?: () => void, fallbackText?: string) => {
      if (isMuted) {
        if (onEnded) onEnded();
        return;
      }

      // If no Cartesia audio returned, fallback to native browser Web Speech API so voice is never absent
      if (!base64 || base64.trim().length === 0) {
        if (fallbackText && typeof window !== "undefined" && "speechSynthesis" in window) {
          try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(fallbackText);
            utter.lang = "te-IN";
            utter.rate = 1.05;
            utter.pitch = 1.0;
            utter.onstart = () => {
              setIsSpeaking(true);
              setIsAutoplayBlocked(false);
            };
            utter.onend = () => {
              setIsSpeaking(false);
              if (onEnded) onEnded();
              if (isHandsFreeRef.current) {
                setTimeout(() => {
                  if (startListeningRef.current) startListeningRef.current();
                }, 300);
              }
            };
            utter.onerror = () => {
              setIsSpeaking(false);
              if (onEnded) onEnded();
            };
            window.speechSynthesis.speak(utter);
            return;
          } catch {}
        }
        if (onEnded) onEnded();
        return;
      }

      try {
        // Clean up previous blob URL
        if (activeBlobUrlRef.current) {
          try {
            URL.revokeObjectURL(activeBlobUrlRef.current);
          } catch {}
          activeBlobUrlRef.current = null;
        }

        // Stop any currently playing audio
        if (audioElementRef.current) {
          try {
            audioElementRef.current.pause();
            audioElementRef.current.currentTime = 0;
          } catch {}
        }

        const blob = base64ToWavBlob(base64, sampleRate);
        const blobUrl = URL.createObjectURL(blob);
        activeBlobUrlRef.current = blobUrl;

        // Re-use existing audio element to keep user gesture authorization alive
        let audio = audioElementRef.current;
        if (!audio) {
          audio = new Audio();
          audioElementRef.current = audio;
        }
        audio.src = blobUrl;

        audio.onplay = () => {
          setIsSpeaking(true);
          setIsAutoplayBlocked(false);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          if (activeBlobUrlRef.current) {
            try {
              URL.revokeObjectURL(activeBlobUrlRef.current);
            } catch {}
            activeBlobUrlRef.current = null;
          }
          if (onEnded) onEnded();
          if (isHandsFreeRef.current) {
            setTimeout(() => {
              if (startListeningRef.current) {
                startListeningRef.current();
              }
            }, 300);
          }
        };

        audio.onerror = (e) => {
          console.warn("[LiveAgent] Audio playback notice:", e);
          setIsSpeaking(false);
          if (activeBlobUrlRef.current) {
            try {
              URL.revokeObjectURL(activeBlobUrlRef.current);
            } catch {}
            activeBlobUrlRef.current = null;
          }
          // Fallback to Web Speech API
          if (fallbackText && typeof window !== "undefined" && "speechSynthesis" in window) {
            try {
              const utter = new SpeechSynthesisUtterance(fallbackText);
              utter.lang = "te-IN";
              utter.onstart = () => setIsSpeaking(true);
              utter.onend = () => {
                setIsSpeaking(false);
                if (onEnded) onEnded();
              };
              window.speechSynthesis.speak(utter);
              return;
            } catch {}
          }
          if (onEnded) onEnded();
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsSpeaking(true);
              setIsAutoplayBlocked(false);
            })
            .catch((err) => {
              console.warn("[LiveAgent] Autoplay prevented by browser:", err);
              setIsSpeaking(false);
              setIsAutoplayBlocked(true);
            });
        }
      } catch (err) {
        console.warn("[LiveAgent] Audio playback error:", err);
        setIsSpeaking(false);
        if (onEnded) onEnded();
      }
    },
    [isMuted]
  );

  // Stop active speech (barge-in / interrupt)
  const stopAudio = useCallback(() => {
    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
      } catch {}
      audioElementRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  // Call timer
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

  // Auto scroll transcript to latest turn
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, isThinking]);

  // Synthesize and speak the initial greeting on modal open
  useEffect(() => {
    if (!isOpen) {
      greetingAudioRef.current = null;
      return;
    }

    const greetingText = (initialGreeting || DEFAULT_GREETING).trim();
    setTurns([
      {
        id: "greeting",
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
        cartesiaVoiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
        ttsOnly: true,
        textToSpeak: greetingText,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        setIsGreetingLoading(false);
        if (data.success) {
          if (data.audioBase64) {
            greetingAudioRef.current = data.audioBase64;
          }
          setTurns((prev) =>
            prev.map((t) =>
              t.id === "greeting"
                ? {
                    ...t,
                    audioBase64: data.audioBase64,
                    latencyMs: 140,
                    isLoadingAudio: false,
                  }
                : t
            )
          );
          // Play initial greeting aloud (Cartesia WAV or Web Speech fallback)
          playPcmAudio(data.audioBase64, data.sampleRate || 16000, undefined, greetingText);
        } else {
          setTurns((prev) =>
            prev.map((t) => (t.id === "greeting" ? { ...t, isLoadingAudio: false } : t))
          );
          playPcmAudio(null, 16000, undefined, greetingText);
        }
      })
      .catch((err) => {
        console.warn("[LiveAgent] Greeting synthesis note:", err);
        if (!isCancelled) {
          setIsGreetingLoading(false);
          setTurns((prev) =>
            prev.map((t) => (t.id === "greeting" ? { ...t, isLoadingAudio: false } : t))
          );
          playPcmAudio(null, 16000, undefined, greetingText);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, agentId, agentName, initialGreeting, playPcmAudio]);

  // Send turn to backend
  const handleSend = async (textToSend: string) => {
    const cleanText = textToSend.trim();
    if (!cleanText || isThinking) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    stopAudio();
    setInputText("");
    setIsThinking(true);

    const now = new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
    const userTurn: LiveTurn = {
      id: `user_${Date.now()}`,
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

      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          agentName,
          cartesiaVoiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
          userMessage: cleanText,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      if (data.success && data.rawReply) {
        const aiTurn: LiveTurn = {
          id: `ai_${Date.now()}`,
          role: "ai",
          text: data.rawReply,
          audioBase64: data.audioBase64,
          latencyMs: data.latencies?.totalMs,
          timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        };
        setTurns((prev) => [...prev, aiTurn]);

        // Play aloud reliably (Cartesia audio or Web Speech API fallback)
        playPcmAudio(data.audioBase64, data.sampleRate || 16000, undefined, data.rawReply);
      } else {
        const errText = data.error || "క్షమించండి, సర్వర్ నుండి ప్రతిస్పందన రాలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.";
        setTurns((prev) => [
          ...prev,
          {
            id: `ai_err_${Date.now()}`,
            role: "ai",
            text: errText,
            timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
          },
        ]);
        playPcmAudio(null, 16000, undefined, errText);
      }
    } catch {
      const connErrText = "కనెక్షన్ సమస్య వచ్చింది. దయచేసి మళ్ళీ మాట్లాడండి.";
      setTurns((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          role: "ai",
          text: connErrText,
          timestamp: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
        },
      ]);
      playPcmAudio(null, 16000, undefined, connErrText);
    } finally {
      setIsThinking(false);
    }
  };

  // Ref wrappers to avoid stale closures in callbacks
  const handleSendRef = useRef<(t: string) => void>(() => {});
  handleSendRef.current = handleSend;
  const startListeningRef = useRef<() => void>(() => {});

  const startListening = useCallback(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = "te-IN";
      rec.continuous = true;
      rec.interimResults = true;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        let transcript = "";
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }

        const clean = transcript.trim();
        if (clean) {
          setInputText(clean);
          // Instant barge-in: stop any AI voice speech immediately when caller speaks
          stopAudio();
        }

        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        if (clean.length > 0) {
          if (isFinal) {
            handleSendRef.current(clean);
            try {
              rec.stop();
            } catch {}
          } else {
            // Buffer 700ms silence to auto-send turn with lowest latency
            silenceTimerRef.current = setTimeout(() => {
              handleSendRef.current(clean);
              try {
                rec.stop();
              } catch {}
            }, 700);
          }
        }
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
      console.warn("[LiveAgent] Speech recognition notice:", err);
      setIsListening(false);
    }
  }, [stopAudio]);

  startListeningRef.current = startListening;

  // Toggle Microphone / Speech-to-Text
  const toggleListening = () => {
    if (isListening) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Microphone recognition is not supported in this browser. Please type your message below.");
      return;
    }

    startListening();
  };

  // Reset conversation
  const handleReset = () => {
    stopAudio();
    const greetingText = (initialGreeting || DEFAULT_GREETING).trim();
    setTurns([
      {
        id: "greeting",
        role: "ai",
        text: greetingText,
        timestamp: "00:00",
        audioBase64: greetingAudioRef.current || undefined,
        latencyMs: 140,
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
          cartesiaVoiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
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
                id: "greeting",
                role: "ai",
                text: greetingText,
                timestamp: "00:00",
                audioBase64: d.audioBase64,
                latencyMs: 140,
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

  const handleClose = () => {
    stopAudio();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full sm:max-w-2xl bg-white sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "min(730px, 94dvh)" }}
      >
        {/* ─── Header ─── */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-md shadow-emerald-700/20">
              <Bot className="w-5 h-5" />
              {isSpeaking && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {agentName}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Cartesia Sonic · Neural Voice
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {formatDuration(callSeconds)}
                </span>
                <span>•</span>
                <span className="text-[11px] font-medium text-slate-600">
                  {isSpeaking
                    ? "Agent Speaking..."
                    : isThinking
                    ? "Thinking & synthesizing..."
                    : isListening
                    ? "Listening to your voice..."
                    : isGreetingLoading
                    ? "Warming up voice..."
                    : "Ready · Talk or type"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) stopAudio();
              }}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                isMuted
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
              }`}
              title={isMuted ? "Unmute Voice" : "Mute Voice"}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition cursor-pointer"
              title="Restart Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-800 border border-slate-200 transition cursor-pointer ml-1"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Autoplay Unlock Notice (if browser policy paused audio) ─── */}
        {isAutoplayBlocked && (
          <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-900 font-medium shrink-0 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-amber-700 animate-bounce" />
              <span>Audio autoplay was paused by your browser. Click to hear Sam speak:</span>
            </div>
            <button
              type="button"
              onClick={() => {
                unlockAudio();
                const latestAiTurn = [...turns].reverse().find((t) => t.role === "ai");
                if (latestAiTurn) {
                  playPcmAudio(latestAiTurn.audioBase64, 16000, undefined, latestAiTurn.text);
                }
                setIsAutoplayBlocked(false);
              }}
              className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition cursor-pointer shrink-0"
            >
              Play Voice
            </button>
          </div>
        )}

        {/* ─── Dynamic Speaking Equalizer Banner ─── */}
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
                Sam is speaking live audio via Cartesia Neural Voice
              </span>
            </div>
            <button
              type="button"
              onClick={stopAudio}
              className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
            >
              Stop Audio (Interrupt)
            </button>
          </div>
        )}

        {/* ─── Conversation Transcript Stream ─── */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-[#FAFAF8]/70">
          {turns.map((turn) => {
            const isAi = turn.role === "ai";
            return (
              <div
                key={turn.id}
                className={`flex items-start gap-3 ${isAi ? "justify-start" : "justify-end"}`}
              >
                {isAi && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div
                  className={`max-w-[84%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-xs leading-relaxed ${
                    isAi
                      ? "bg-white border border-slate-200/90 text-slate-800 rounded-tl-sm"
                      : "bg-emerald-700 text-white rounded-tr-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                  <div
                    className={`flex items-center justify-between gap-3 mt-2 pt-1.5 text-[10px] ${
                      isAi
                        ? "text-slate-400 border-t border-slate-100"
                        : "text-emerald-200 border-t border-emerald-600/50"
                    }`}
                  >
                    <span>{turn.timestamp}</span>
                    {isAi && (
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            unlockAudio();
                            playPcmAudio(turn.audioBase64, 16000, undefined, turn.text);
                          }}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-900 transition cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{isSpeaking ? "Playing..." : "Replay"}</span>
                        </button>

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
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isThinking && (
            <div className="flex items-center gap-3 justify-start text-xs text-slate-500 animate-in fade-in">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                <span className="text-slate-700 font-medium">
                  Sam is formulating answer & synthesizing Telugu voice...
                </span>
              </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </div>

        {/* ─── Quick Conversation Starters ─── */}
        <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 uppercase tracking-wider mr-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Try:
          </span>
          {QUICK_STARTERS.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                handleSend(prompt);
              }}
              disabled={isThinking}
              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 text-[11px] font-medium border border-slate-200/80 hover:border-emerald-300 transition shrink-0 cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* ─── Interactive Voice & Text Input ─── */}
        <div className="p-3.5 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }}
            className="flex items-center gap-2"
          >
            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3 rounded-2xl border transition shrink-0 cursor-pointer ${
                isListening
                  ? "bg-rose-600 text-white border-rose-600 animate-pulse shadow-md shadow-rose-500/20"
                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200"
              }`}
              title={isListening ? "Listening... click to stop" : "Speak into microphone"}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Speak or type in Telugu or English (e.g. నా బిజినెస్ కోసం వాయిస్ ఏజెంట్ ఎలా పనిచేస్తుంది?)..."
              disabled={isThinking}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-[#FAFAF8] text-slate-900 text-xs sm:text-sm focus:outline-none focus:border-emerald-600 focus:bg-white transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Send</span>
            </button>

            {/* End Call Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition shrink-0 cursor-pointer"
              title="End conversation"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
