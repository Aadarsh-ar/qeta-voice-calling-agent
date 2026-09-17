"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X, Mic, Volume2, Phone, PhoneOff, ArrowRight, Radio, Loader2, Send, Globe, Play, Sparkles, CheckCircle2,
} from "lucide-react";
import Link from "next/link";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface AgentOption {
  id: string;
  name: string;
  role: string;
  emoji: string;
  greeting: string;
  description: string;
  sampleQuestions: string[];
  voiceName: string;
  voiceGender: string;
  voiceId: string;
}

const AGENTS: AgentOption[] = [
  {
    id: "agent_vDCfnuFdJokXJDVxgmHeZx",
    name: "College Attendance Notification",
    role: "Faculty Attendance Helpline",
    emoji: "🎓",
    voiceName: "Harika Voice",
    voiceGender: "Female (Telugu)",
    voiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
    greeting: "నమస్తే అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను. మీ అబ్బాయి అటెండెన్స్ గురించి కాల్ చేశాను.",
    description: "Assists parents with attendance counseling (75% rule), exam eligibility, and student academic welfare in polite natural Telugu.",
    sampleQuestions: [
      "కాలేజ్ attendance requirement ఎంత?",
      "నా కొడుకు attendance 75% కన్నా తక్కువ ఉంటే ఏమవుతుంది?",
      "ఎగ్జామ్ ఫీజు ఎప్పుడు కట్టాలి?",
    ],
  },
];

type ConvState = "idle" | "connecting" | "listening" | "processing" | "speaking" | "error";

interface Message {
  id: string;
  role: "user" | "agent";
  text: string;
}

const hasSpeechRecognition = () =>
  typeof window !== "undefined" &&
  ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

export function LiveAgentAudioModal({ isOpen, onClose }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<AgentOption>(AGENTS[0]);
  const [state, setState] = useState<ConvState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [micPartial, setMicPartial] = useState("");
  const [textInput, setTextInput] = useState("");
  const [sttLang, setSttLang] = useState<"te-IN" | "en-IN">("te-IN");

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isActiveRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // CRITICAL: Acoustic Echo / Recursive Self-Listening Prevention
  // When the agent is speaking or the room echo tail is dissipating,
  // the microphone is forcefully halted and any audio packets are discarded.
  const isAgentSpeakingRef = useRef(false);
  const echoGuardTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, micPartial]);

  // Physical mic abort to guarantee zero microphone audio capture during speech
  const stopMic = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setMicPartial("");
  }, []);

  const stopAudio = useCallback(() => {
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch {}
      audioPlayerRef.current = null;
    }
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch {}
      currentSourceRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const endCall = useCallback(() => {
    isActiveRef.current = false;
    isAgentSpeakingRef.current = false;
    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }
    stopAudio();
    stopMic();
    setState("idle");
    setMicPartial("");
    setTextInput("");
  }, [stopAudio, stopMic]);

  useEffect(() => {
    if (!isOpen) endCall();
    return () => endCall();
  }, [isOpen, endCall]);

  const addMessage = (role: "user" | "agent", text: string) => {
    const msg: Message = { id: Date.now().toString() + Math.random(), role, text };
    setMessages((p) => [...p, msg]);
    return msg;
  };

  // Plays PCM 16kHz audio from Cartesia with strict acoustic echo isolation
  const playPcmAudio = async (base64Audio: string): Promise<void> => {
    // 1. Lock mutex & abort microphone IMMEDIATELY so system voice cannot leak into STT
    isAgentSpeakingRef.current = true;
    stopMic();
    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }

    return new Promise(async (resolve) => {
      try {
        stopAudio();
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / 32768.0;
        }

        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new Ctx({ sampleRate: 16000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        const buf = ctx.createBuffer(1, float32.length, 16000);
        buf.copyToChannel(float32, 0);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        currentSourceRef.current = src;

        src.onended = () => {
          currentSourceRef.current = null;
          // Acoustic dissipation guard window (400ms): wait for speaker soundwaves
          // in the room to dissipate before opening the microphone to listen to human
          echoGuardTimerRef.current = setTimeout(() => {
            isAgentSpeakingRef.current = false;
            resolve();
          }, 400);
        };

        src.start(0);
      } catch (e) {
        console.warn("[LiveAgentModal] Audio playback error:", e);
        isAgentSpeakingRef.current = false;
        resolve();
      }
    });
  };

  // Plays synthesized audio via HTML5 Audio with WAV dataUrl or PCM fallback
  const playSynthesizedAudio = async (audioDataUrl?: string | null, fallbackBase64?: string | null): Promise<void> => {
    isAgentSpeakingRef.current = true;
    stopMic();
    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }

    if (audioDataUrl) {
      return new Promise((resolve) => {
        try {
          stopAudio();
          const audio = new Audio(audioDataUrl);
          audioPlayerRef.current = audio;
          audio.onended = () => {
            audioPlayerRef.current = null;
            echoGuardTimerRef.current = setTimeout(() => {
              isAgentSpeakingRef.current = false;
              resolve();
            }, 350);
          };
          audio.onerror = () => {
            audioPlayerRef.current = null;
            if (fallbackBase64) {
              playPcmAudio(fallbackBase64).then(resolve);
            } else {
              isAgentSpeakingRef.current = false;
              resolve();
            }
          };
          audio.play().catch(() => {
            if (fallbackBase64) {
              playPcmAudio(fallbackBase64).then(resolve);
            } else {
              isAgentSpeakingRef.current = false;
              resolve();
            }
          });
        } catch {
          if (fallbackBase64) {
            playPcmAudio(fallbackBase64).then(resolve);
          } else {
            isAgentSpeakingRef.current = false;
            resolve();
          }
        }
      });
    } else if (fallbackBase64) {
      return playPcmAudio(fallbackBase64);
    } else {
      isAgentSpeakingRef.current = false;
      return Promise.resolve();
    }
  };

  // Browser Web Speech fallback with the same echo guard
  const playBrowserSpeech = (text: string): Promise<void> => {
    isAgentSpeakingRef.current = true;
    stopMic();
    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }

    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        isAgentSpeakingRef.current = false;
        resolve();
        return;
      }
      stopAudio();
      const utt = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const matchVoice = voices.find(
        (v) => v.lang.startsWith("te") || v.lang.startsWith("hi") || v.lang.startsWith("en-IN")
      );
      if (matchVoice) utt.voice = matchVoice;
      utt.lang = sttLang === "te-IN" ? "te-IN" : "en-IN";
      utt.rate = 0.95;

      utt.onend = () => {
        echoGuardTimerRef.current = setTimeout(() => {
          isAgentSpeakingRef.current = false;
          resolve();
        }, 400);
      };

      utt.onerror = () => {
        isAgentSpeakingRef.current = false;
        resolve();
      };

      window.speechSynthesis.speak(utt);
    });
  };

  const startListening = useCallback(() => {
    if (!isActiveRef.current) return;

    // Reject listening if agent is speaking or echo dissipation tail is active
    if (isAgentSpeakingRef.current) {
      console.log("[ECHO_GUARD] Refusing startListening: agent is speaking or echo dissipating");
      return;
    }

    if (!hasSpeechRecognition()) {
      setState("listening"); // allows text input
      return;
    }

    setState("listening");
    setMicPartial("");

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SR();
      recognitionRef.current = recognition;
      recognition.lang = sttLang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (e: any) => {
        // Critical: Drop any mic audio captured while agent was outputting audio
        if (isAgentSpeakingRef.current) {
          console.warn("[ECHO_GUARD] Discarded mic event: speaker audio was active");
          return;
        }

        const last = e.results[e.results.length - 1];
        const transcript = last[0]?.transcript || "";
        if (last.isFinal) {
          try { recognition.abort(); } catch {}
          if (transcript.trim()) {
            handleUserMessage(transcript.trim());
          } else if (isActiveRef.current && !isAgentSpeakingRef.current) {
            startListening();
          }
        } else {
          setMicPartial(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        if (e.error === "no-speech") {
          // Normal silence pause — ignore and let onend restart cleanly
          return;
        } else if (e.error === "not-allowed") {
          setError("Microphone access blocked. You can type your message below!");
        }
      };

      recognition.onend = () => {
        // Continuous listening: auto-restart whenever call is active and agent isn't outputting audio
        if (isActiveRef.current && !isAgentSpeakingRef.current) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
    } catch (err) {
      console.warn("[LiveAgentModal] SpeechRecognition error:", err);
    }
  }, [sttLang]);

  // Executes a single turn: user input -> Cartesia LLM response -> play audio -> resume listening
  const handleUserMessage = async (userText: string) => {
    if (!isActiveRef.current || !userText.trim()) return;

    // Immediately stop mic and audio to prevent any interference
    stopMic();
    stopAudio();

    setState("processing");
    addMessage("user", userText);
    setMicPartial("");
    setTextInput("");

    try {
      const history = messagesRef.current.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          voiceId: selectedAgent.voiceId,
          cartesiaVoiceId: selectedAgent.voiceId,
          userMessage: userText,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      const reply = data.normalizedReply || data.rawReply || "మీ అభ్యర్థనను పరిశీలిస్తున్నాను. దయచేసి వివరాలు చెప్పండి.";

      if (!isActiveRef.current) return;

      // Add agent reply
      addMessage("agent", reply);
      setState("speaking");

      // Play synthesized audio directly (single turn)
      if (data.audioDataUrl || data.audioBase64) {
        await playSynthesizedAudio(data.audioDataUrl, data.audioBase64);
      } else {
        await playBrowserSpeech(reply);
      }

      // Resume listening once speech & acoustic guard finish
      if (isActiveRef.current) {
        startListening();
      }
    } catch (err) {
      console.error("[LiveAgentModal] Turn error:", err);
      if (isActiveRef.current) {
        addMessage("agent", "క్షమించండి, చిన్న సమస్య వచ్చింది. దయచేసి మళ్ళీ చెప్పండి.");
        setState("speaking");
        await playBrowserSpeech("క్షమించండి, చిన్న సమస్య వచ్చింది. దయచేసి మళ్ళీ చెప్పండి.");
        if (isActiveRef.current) startListening();
      }
    }
  };

  // Allows seamlessly switching agent in the middle of a live conversation with strict context isolation
  const switchAgentDuringCall = async (targetAgent: AgentOption) => {
    if (selectedAgent.id === targetAgent.id) return;

    // 1. Immediately halt audio and mic
    stopAudio();
    stopMic();
    if (echoGuardTimerRef.current) {
      clearTimeout(echoGuardTimerRef.current);
      echoGuardTimerRef.current = null;
    }

    // 2. Switch agent and wipe history to prevent agent cross-contamination
    setSelectedAgent(targetAgent);
    setMessages([]);
    messagesRef.current = [];
    setError("");
    setMicPartial("");
    setTextInput("");

    if (!isActiveRef.current) return;

    // 3. Play the newly selected agent's greeting with that agent's exact voice
    setState("speaking");
    const greetingMsg: Message = {
      id: Date.now().toString() + Math.random(),
      role: "agent",
      text: targetAgent.greeting,
    };
    setMessages([greetingMsg]);
    messagesRef.current = [greetingMsg];

    try {
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: targetAgent.id,
          voiceId: targetAgent.voiceId,
          cartesiaVoiceId: targetAgent.voiceId,
          ttsOnly: true,
          textToSpeak: targetAgent.greeting,
        }),
      });
      const data = await res.json();

      if (!isActiveRef.current) return;

      if (data.audioBase64) {
        await playPcmAudio(data.audioBase64);
      } else {
        await playBrowserSpeech(targetAgent.greeting);
      }

      if (isActiveRef.current) {
        startListening();
      }
    } catch {
      if (isActiveRef.current) {
        await playBrowserSpeech(targetAgent.greeting);
        if (isActiveRef.current) startListening();
      }
    }
  };

  // Explicit user trigger: Start conversation after agent selection
  const startConversation = async () => {
    setError("");
    setMessages([]);
    messagesRef.current = [];
    isActiveRef.current = true;
    setState("connecting");

    // Display agent greeting in chat
    addMessage("agent", selectedAgent.greeting);
    setState("speaking");

    try {
      // Synthesize greeting with Cartesia cloned voice using ttsOnly
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          voiceId: selectedAgent.voiceId,
          cartesiaVoiceId: selectedAgent.voiceId,
          ttsOnly: true,
          textToSpeak: selectedAgent.greeting,
        }),
      });
      const data = await res.json();

      if (!isActiveRef.current) return;

      if (data.audioDataUrl || data.audioBase64) {
        await playSynthesizedAudio(data.audioDataUrl, data.audioBase64);
      } else {
        await playBrowserSpeech(selectedAgent.greeting);
      }

      if (isActiveRef.current) {
        startListening();
      }
    } catch (e) {
      if (isActiveRef.current) {
        await playBrowserSpeech(selectedAgent.greeting);
        if (isActiveRef.current) startListening();
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    handleUserMessage(textInput.trim());
  };

  if (!isOpen) return null;

  const isOnCall = state !== "idle" && state !== "error";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full sm:max-w-[520px] bg-white sm:rounded-3xl border-t sm:border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        style={{ height: "min(720px, 96dvh)" }}
      >
        {/* Header */}
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
                {isOnCall ? `Active Call: Harika Madam (College Attendance)` : "Harika (Native Telugu Voice) • Cartesia Sonic-3.6"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* STT Input Language Toggle */}
            <button
              type="button"
              onClick={() => setSttLang((l) => (l === "te-IN" ? "en-IN" : "te-IN"))}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              title="Toggle input speech recognition language"
            >
              <Globe className="w-3 h-3 text-slate-500" />
              <span>{sttLang === "te-IN" ? "తెలుగు" : "English"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ─── HARIKA VOICE AGENT SHOWCASE CARD (When Idle) ─── */}
        {state === "idle" && (
          <div className="px-5 pt-4 pb-4 shrink-0 bg-slate-50/70 border-b border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Active Telephony Voice Agent
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Cartesia Sonic-3.6 Active
              </span>
            </div>

            <div className="p-3.5 rounded-2xl border-2 border-emerald-500 bg-white shadow-sm ring-2 ring-emerald-500/20 relative">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">🎓</span>
                  <div>
                    <div className="font-heading text-xs font-bold text-slate-900 leading-tight">
                      {selectedAgent.name}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {selectedAgent.role}
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Harika (Telugu)
                </span>
              </div>
            </div>

            {/* ── PROMINENT START BUTTON RIGHT BELOW AGENT SELECTION ── */}
            <div className="pt-1">
              <button
                type="button"
                onClick={startConversation}
                className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.99] group"
              >
                <Play className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                <span>Start Live Conversation with Harika Madam</span>
                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        )}

        {/* ─── MAIN CONTENT AREA: CHAT FEED OR AGENT PREVIEW ─── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0 bg-[#FBFBFA]">
          {/* Idle Agent Detail Preview */}
          {state === "idle" && (
            <div className="h-full flex flex-col justify-center space-y-4 py-2">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{selectedAgent.emoji}</span>
                  <div>
                    <h4 className="font-heading text-sm font-bold text-slate-900">{selectedAgent.name}</h4>
                    <p className="text-xs text-slate-500">{selectedAgent.role}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {selectedAgent.description}
                </p>
                <div className="pt-2.5 border-t border-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Sample Questions to Ask:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAgent.sampleQuestions.map((q, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full"
                      >
                        &ldquo;{q}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Call Messages */}
          {isOnCall &&
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
              >
                {msg.role === "agent" && (
                  <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5 mr-2 text-sm shadow-xs">
                    {selectedAgent.emoji}
                  </span>
                )}
                <div
                  className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-br-sm"
                      : "bg-white border border-slate-200/90 text-slate-900 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

          {/* Live Microphone Interim Partial */}
          {micPartial && (
            <div className="flex justify-end">
              <div className="max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed bg-slate-200/90 text-slate-700 rounded-br-sm italic animate-pulse">
                {micPartial}...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ─── CALL STATUS & CONTROL BAR ─── */}
        <div className="px-5 py-2.5 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            {state === "idle" && (
              <span className="text-slate-500 font-medium">Ready · Click green button to start</span>
            )}
            {state === "connecting" && (
              <span className="flex items-center gap-2 text-amber-700 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                Connecting with {selectedAgent.name}...
              </span>
            )}
            {state === "listening" && (
              <span className="flex items-center gap-2 text-red-600 font-semibold animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_#ef4444]" />
                <span>Listening... speak or type below</span>
              </span>
            )}
            {state === "processing" && (
              <span className="flex items-center gap-2 text-slate-600 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                {selectedAgent.name} formulating response...
              </span>
            )}
            {state === "speaking" && (
              <span className="flex items-center gap-2 text-emerald-700 font-semibold">
                <span className="flex items-end gap-0.5 h-3.5">
                  {[12, 18, 10, 16, 8, 20, 12].map((h, i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full bg-emerald-500"
                      style={{
                        height: `${h}px`,
                        animation: `pulse ${0.35 + i * 0.08}s ease-in-out infinite alternate`,
                      }}
                    />
                  ))}
                </span>
                <span>{selectedAgent.name} speaking (Mic muted to prevent echo)</span>
              </span>
            )}
            {state === "error" && (
              <span className="text-red-600 font-medium truncate">{error || "Connection error"}</span>
            )}
          </div>

          <div className="shrink-0">
            {isOnCall ? (
              <button
                onClick={endCall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                End Call
              </button>
            ) : null}
          </div>
        </div>

        {/* ─── DUAL INPUT BAR: SPEAK OR TYPE ─── */}
        {isOnCall && (
          <form
            onSubmit={handleTextSubmit}
            className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Speak via mic or type here..."
              disabled={state === "processing"}
              className="flex-1 text-xs px-4 py-2.5 rounded-full border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 text-slate-800 placeholder:text-slate-400"
            />

            <button
              type="submit"
              disabled={!textInput.trim() || state === "processing"}
              className="p-2.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 shadow-xs"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <Link
            href="/login"
            onClick={onClose}
            className="text-[11px] font-semibold text-slate-600 hover:text-emerald-800 transition flex items-center gap-1"
          >
            Open Console <ArrowRight className="w-3 h-3" />
          </Link>
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-emerald-500" /> Echo-Isolated Real-Time Audio
          </span>
        </div>
      </div>
    </div>
  );
}
