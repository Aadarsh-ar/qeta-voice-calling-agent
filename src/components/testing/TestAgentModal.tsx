"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
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
  Headphones,
  Radio,
  ChevronDown,
  ChevronUp,
  Terminal,
  CheckCircle2,
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
}

const samplePrompts = [
  "మీ services గురించి చెప్పండి.",
  "మాకు నెలకు ₹25,000 లోపు ప్యాకేజీ కావాలి.",
  "రేపు ఉదయం 10:30 AM కి డెమో షెడ్యూల్ చేయండి.",
  "Hyderabad లో మీ ఆఫీస్ ఎక్కడ ఉంది?",
  "చాలా సంతోషం అండి, వివరాలు తెలిశాయి. బాయ్!",
];

export function TestAgentModal({
  isOpen,
  onClose,
  agentId,
  agentName = "Telugu Sales Agent",
}: TestAgentModalProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [openTraceIndex, setOpenTraceIndex] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [turns, setTurns] = useState<TestTurn[]>([
    {
      role: "ai",
      text: "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
      normalizedText: "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
      timestamp: "Just now",
    },
  ]);

  // Play PCM audio from Cartesia base64 string
  const playPcmAudio = async (base64: string, sampleRate = 16000) => {
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
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({
          sampleRate,
        });
      }

      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      const buffer = ctx.createBuffer(1, float32Array.length, sampleRate);
      buffer.getChannelData(0).set(float32Array);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (e) {
      console.warn("Audio playback error:", e);
    }
  };

  // Toggle Microphone Speech Recognition (Web Speech API)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "te-IN"; // Telugu / Indian English

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInputMessage(transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.warn("Speech recognition error:", e);
      setIsListening(false);
    }
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputMessage;
    if (!textToSend.trim() || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const callerTurn: TestTurn = {
      role: "caller",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedTurns = [...turns, callerTurn];
    setTurns(updatedTurns);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Format history so agent has multi-turn memory
      const conversationHistory = updatedTurns.map((t) => ({
        role: t.role === "caller" ? "user" : "assistant",
        content: t.text,
      }));

      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
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
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
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
            text: `(Error: ${data.error || "Failed to process turn"})`,
            timestamp: "Error",
          },
        ]);
      }
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          role: "ai",
          text: "(Network error reaching test endpoint)",
          timestamp: "Error",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-white border border-[#EAEBE8] rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#EAEBE8] flex items-center justify-between bg-[#FAFAF8]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-slate-900 text-base tracking-tight">{agentName}</h3>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold">
                  Telugu + English
                </span>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  Voice: AD Cloned (8kHz)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Live Voice Agent Pipeline & Latency Simulator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">

            <button
              onClick={() =>
                setTurns([
                  {
                    role: "ai",
                    text: "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
                    normalizedText: "నమస్కారం అండి! QETADOTIN కి స్వాగతం. నేను మీకు ఏ విధంగా సహాయపడగలను?",
                    timestamp: "Just now",
                  },
                ])
              }
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conversation Turns */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`flex gap-3 ${turn.role === "caller" ? "justify-end" : "justify-start"}`}
            >
              {turn.role === "ai" && (
                <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                  turn.role === "caller"
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "bg-white border border-[#EAEBE8] text-slate-900 shadow-xs"
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <span className="text-[11px] font-semibold opacity-80">
                    {turn.role === "caller" ? "Customer (You)" : "AI Agent"}
                  </span>
                  <span className="text-[10px] opacity-70">{turn.timestamp}</span>
                </div>

                <p className="leading-relaxed font-normal">{turn.text}</p>

                {/* Show Telugu normalization breakdown if modified */}
                {turn.normalizedText && turn.normalizedText !== turn.text && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-xs text-indigo-800">
                    <span className="text-[10px] text-slate-400 block font-medium">
                      Telugu Speech Normalized (Pre-TTS):
                    </span>
                    <p className="font-sans italic">{turn.normalizedText}</p>
                  </div>
                )}

                {/* Grounded RAG Knowledge Badges */}
                {turn.retrievedSnippets && turn.retrievedSnippets.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
                    <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-indigo-500" />
                      RAG Grounded Knowledge ({turn.retrievedSnippets.length} chunks retrieved):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {turn.retrievedSnippets.map((s, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-800 border border-indigo-200/80 text-[10px]"
                        >
                          <span className="font-bold">[{s.source}]</span> {s.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Executed Tools Badges */}
                {turn.toolCalls && turn.toolCalls.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1 text-[11px]">
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      Real Tool Executed:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {turn.toolCalls.map((tc, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono"
                        >
                          <span className="font-bold">{tc.name}</span>
                          <span>({Object.keys(tc.args).length > 0 ? JSON.stringify(tc.args) : "void"})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quality Guardrail Note */}
                {turn.qualityValidation?.wasModified && (
                  <div className="mt-2 pt-1 text-[10px] text-amber-700 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-amber-600" />
                    <span>Guardrail: {turn.qualityValidation.modificationReason}</span>
                  </div>
                )}

                {/* Latency Breakdown Bar */}
                {turn.latencies && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 font-mono flex items-center gap-1 border border-slate-200">
                      <Zap className="w-3 h-3 text-amber-500" />
                      STT: {turn.latencies.sttMs}ms
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 font-mono flex items-center gap-1 border border-slate-200">
                      <Sparkles className="w-3 h-3 text-indigo-600" />
                      LLM: {turn.latencies.llmMs}ms
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 font-mono flex items-center gap-1 border border-slate-200">
                      <Volume2 className="w-3 h-3 text-emerald-600" />
                      TTS: {turn.latencies.ttsMs}ms
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-mono font-semibold ml-auto border border-emerald-200">
                      Total: {turn.latencies.totalMs}ms
                    </span>
                  </div>
                )}

                {turn.audioBase64 && (
                  <button
                    onClick={() => playPcmAudio(turn.audioBase64!)}
                    className="mt-2 text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Replay Cloned Voice
                  </button>
                )}

                {/* Section 17 Debug Trace (Customer Input → Intent → Knowledge Search → Retrieved Info → Tool Call → Tool Result → Agent Response → TTS Response) */}
                {turn.role === "ai" && turn.customerInput && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      onClick={() => setOpenTraceIndex(openTraceIndex === i ? null : i)}
                      className="flex items-center justify-between w-full text-[11px] font-bold text-slate-700 hover:text-indigo-600 transition"
                    >
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                        Runtime Debug Trace (Section 17)
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                        {openTraceIndex === i ? "Hide Trace" : "Show Trace"}
                        {openTraceIndex === i ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </span>
                    </button>

                    {openTraceIndex === i && (
                      <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-slate-100 font-mono text-[11px] space-y-2 border border-slate-800 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          <span>Live Call Pipeline Execution</span>
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Synced Cartesia Agent
                          </span>
                        </div>

                        {/* 1. CUSTOMER INPUT */}
                        <div>
                          <span className="text-sky-400 font-bold block">CUSTOMER INPUT</span>
                          <span className="text-slate-300 pl-3 block">&ldquo;{turn.customerInput}&rdquo;</span>
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 2. INTENT */}
                        <div>
                          <span className="text-purple-400 font-bold block">INTENT</span>
                          <span className="text-slate-300 pl-3 block">{turn.intent || "General Inbound Query"}</span>
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 3. KNOWLEDGE SEARCH */}
                        <div>
                          <span className="text-amber-400 font-bold block">KNOWLEDGE SEARCH</span>
                          <span className="text-slate-300 pl-3 block">
                            Query: &ldquo;{turn.customerInput}&rdquo; | Scope: [org_active] + [{agentId || "agent_GaiYMgB9Bj9kaKW1tUgqSQ"}]
                          </span>
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 4. RETRIEVED INFORMATION */}
                        <div>
                          <span className="text-amber-300 font-bold block">RETRIEVED INFORMATION</span>
                          {turn.retrievedSnippets && turn.retrievedSnippets.length > 0 ? (
                            <div className="pl-3 space-y-1 text-slate-300">
                              {turn.retrievedSnippets.map((s, sIdx) => (
                                <div key={sIdx} className="text-[10px]">
                                  • [{s.source}] {s.title} (score: {s.score.toFixed(2)})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 pl-3 block italic">No specific knowledge chunks needed for this intent</span>
                          )}
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 5. TOOL CALL */}
                        <div>
                          <span className="text-emerald-400 font-bold block">TOOL CALL</span>
                          {turn.toolCalls && turn.toolCalls.length > 0 ? (
                            <div className="pl-3 space-y-0.5 text-slate-300">
                              {turn.toolCalls.map((tc, tcIdx) => (
                                <div key={tcIdx} className="text-[10px]">
                                  Function: <span className="text-emerald-300">{tc.name}</span>({JSON.stringify(tc.args)})
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 pl-3 block italic">None invoked</span>
                          )}
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 6. TOOL RESULT */}
                        <div>
                          <span className="text-emerald-300 font-bold block">TOOL RESULT</span>
                          {turn.toolCalls && turn.toolCalls.length > 0 ? (
                            <div className="pl-3 space-y-0.5 text-slate-300 text-[10px]">
                              {turn.toolCalls.map((tc, tcIdx) => (
                                <div key={tcIdx}>
                                  Result: <span className="text-slate-200">{JSON.stringify(tc.result)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 pl-3 block italic">N/A</span>
                          )}
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 7. AGENT RESPONSE */}
                        <div>
                          <span className="text-indigo-400 font-bold block">AGENT RESPONSE</span>
                          <span className="text-slate-200 pl-3 block">&ldquo;{turn.text}&rdquo;</span>
                        </div>

                        <div className="text-slate-600 pl-3">↓</div>

                        {/* 8. TTS RESPONSE */}
                        <div>
                          <span className="text-rose-400 font-bold block">TTS RESPONSE</span>
                          <span className="text-slate-300 pl-3 block">
                            {turn.audioBase64
                              ? `Cartesia Sonic (${turn.latencies?.ttsMs || 120}ms) | Voice ID: ${turn.cartesiaVoiceId || "ff480e6e-3e79-4307-9889-d1d9feb8e20e"}`
                              : "Pre-warmed audio cache"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {turn.role === "caller" && (
                <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 items-center text-xs text-slate-500">
              <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center animate-pulse">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-xs">
                <Activity className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                <span>Processing turn (STT → Normalizer → Cartesia Cloned TTS)...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Sample Utterance Suggestions */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto flex gap-2">
          <span className="text-[11px] text-slate-400 self-center shrink-0 font-medium">
            Try Telugu:
          </span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap transition disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Footer Input Bar */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? "Stop listening" : "Speak via microphone (Telugu / English)"}
            className={`p-2.5 rounded-xl border transition flex items-center justify-center shrink-0 ${
              isListening
                ? "bg-rose-500 text-white border-rose-600 animate-pulse shadow-md shadow-rose-200"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={isListening ? "Listening to your voice... Speak now" : "Type your message in Telugu or Tenglish (e.g. మీ ధర ఎంత?)..."}
              disabled={isLoading}
              className={`w-full px-5 py-3 rounded-full bg-white border text-slate-900 text-xs sm:text-sm focus:outline-hidden transition shadow-xs ${
                isListening ? "border-rose-400 ring-2 ring-rose-100 placeholder-rose-400 font-medium" : "border-[#EAEBE8] focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10"
              }`}
            />
            {isListening && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                Listening
              </span>
            )}
          </div>
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !inputMessage.trim()}
            className="btn-emerald-primary text-xs px-5 py-3 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
