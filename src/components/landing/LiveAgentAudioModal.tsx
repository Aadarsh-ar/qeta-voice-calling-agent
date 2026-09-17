"use client";

import React, { useState, useRef } from "react";
import { X, Play, Pause, Volume2, Sparkles, Phone, Radio, ArrowRight } from "lucide-react";
import Link from "next/link";

interface LiveAgentAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullTest?: () => void;
}

interface AudioSnippet {
  id: string;
  lang: string;
  role: string;
  speaker: string;
  teluguText: string;
  englishTranslation: string;
  voiceId: string;
}

const DEMO_SNIPPETS: AudioSnippet[] = [
  {
    id: "snip-1",
    lang: "Telugu / Tenglish",
    role: "Electronics Retail & Service Support",
    speaker: "Aadarsh (Neural Telugu)",
    teluguText: "హలో అండి! నేను Aadarsh మాట్లాడుతున్నాను, ABC Electronics నుంచి call చేస్తున్నాను. మీకు ఎలా సహాయం చేయగలను?",
    englishTranslation: "Hello! I am Aadarsh calling from ABC Electronics. How may I assist you today?",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
  },
  {
    id: "snip-2",
    lang: "Telugu / Tenglish",
    role: "E-Commerce Delivery Verification",
    speaker: "Aadarsh (COD Verification)",
    teluguText: "మీ ఆర్డర్ 4567 ప్రస్తుతం హైదరాబాద్ Hub లో In Transit లో ఉంది అండి. రేపు మధ్యాహ్నం 2:00 PM కి డెలివరీ అవుతుంది.",
    englishTranslation: "Your order 4567 is currently In Transit at Hyderabad Hub. It will be delivered tomorrow by 2:00 PM.",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
  },
  {
    id: "snip-3",
    lang: "Telugu / Tenglish",
    role: "Customer Warranty & Refund Policy",
    speaker: "Aadarsh (Store Policy)",
    teluguText: "డెలివరీ అయిన 7 రోజులలోపు రీఫండ్ అభ్యర్థించవచ్చు అండి. ప్రొడక్ట్ ఒరిజినల్ ప్యాకింగ్ లో ఉండాలి.",
    englishTranslation: "Refund can be requested within 7 days of delivery. The product must be in its original packaging.",
    voiceId: "f9945b75-0f3b-448d-ba9e-3d22c229a68e",
  },
];

export function LiveAgentAudioModal({ isOpen, onClose, onOpenFullTest }: LiveAgentAudioModalProps) {
  const [activeSnippet, setActiveSnippet] = useState<string>("snip-1");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  if (!isOpen) return null;

  const currentSnippet = DEMO_SNIPPETS.find((s) => s.id === activeSnippet) || DEMO_SNIPPETS[0];

  const handlePlayVoice = async (snippet: AudioSnippet) => {
    setActiveSnippet(snippet.id);
    setIsLoadingAudio(true);
    setIsPlaying(false);

    try {
      // Call backend Cartesia test endpoint to synthesize speech dynamically
      const res = await fetch("/api/agent/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: snippet.teluguText,
        }),
      });

      const data = await res.json();
      if (data.audioBase64) {
        // Decode and play PCM / audio
        const binaryString = window.atob(data.audioBase64);
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

        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = audioContextRef.current || new AudioCtx({ sampleRate: 16000 });
        audioContextRef.current = ctx;

        if (ctx.state === "suspended") await ctx.resume();

        const audioBuffer = ctx.createBuffer(1, float32Array.length, 16000);
        audioBuffer.copyToChannel(float32Array, 0);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();

        setIsPlaying(true);
        source.onended = () => setIsPlaying(false);
      } else {
        // Fallback speech synthesis if audioBase64 not returned
        const utterance = new SpeechSynthesisUtterance(snippet.teluguText);
        utterance.lang = "te-IN";
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn("Audio playback exception, falling back to speech synthesis:", err);
      const utterance = new SpeechSynthesisUtterance(snippet.teluguText);
      utterance.lang = "te-IN";
      utterance.onend = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Live Voice Agent Audition
              </h3>
              <p className="text-xs text-slate-500">
                Powered by Cartesia Neural Telugu Engine
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Snippet Selection Tabs */}
        <div className="flex items-center gap-2 my-5 overflow-x-auto pb-1">
          {DEMO_SNIPPETS.map((snippet, idx) => (
            <button
              key={snippet.id}
              onClick={() => handlePlayVoice(snippet)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                activeSnippet === snippet.id
                  ? "bg-emerald-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Demo {idx + 1}: {snippet.role.split(" ")[0]}
            </button>
          ))}
        </div>

        {/* Active Audio Player Card */}
        <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/60 mb-6">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold mb-2">
            <span>{currentSnippet.role}</span>
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {currentSnippet.speaker}
            </span>
          </div>

          <p className="font-heading text-lg font-bold text-slate-900 leading-snug mb-2">
            "{currentSnippet.teluguText}"
          </p>

          <p className="text-xs text-slate-500 italic">
            "{currentSnippet.englishTranslation}"
          </p>

          {/* Player Button & Equalizer */}
          <div className="mt-5 flex items-center justify-between pt-4 border-t border-emerald-200/50">
            <button
              onClick={() => handlePlayVoice(currentSnippet)}
              disabled={isLoadingAudio}
              className="btn-emerald-primary text-xs px-4 py-2"
            >
              {isLoadingAudio ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Synthesizing Voice...
                </span>
              ) : isPlaying ? (
                <span className="flex items-center gap-2">
                  <Pause className="w-3.5 h-3.5" />
                  Playing Audio...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play Voice Sample
                </span>
              )}
            </button>

            {/* Visualizer bars */}
            <div className="flex items-center gap-1 h-5 px-3">
              <span className={`w-1 bg-emerald-600 rounded-full transition-all ${isPlaying ? "animate-eq-1" : "h-1.5 opacity-40"}`} />
              <span className={`w-1 bg-emerald-600 rounded-full transition-all ${isPlaying ? "animate-eq-2" : "h-2 opacity-40"}`} />
              <span className={`w-1 bg-emerald-600 rounded-full transition-all ${isPlaying ? "animate-eq-3" : "h-1.5 opacity-40"}`} />
              <span className={`w-1 bg-emerald-600 rounded-full transition-all ${isPlaying ? "animate-eq-4" : "h-2.5 opacity-40"}`} />
              <span className={`w-1 bg-emerald-600 rounded-full transition-all ${isPlaying ? "animate-eq-2" : "h-1.5 opacity-40"}`} />
            </div>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-emerald-800 transition flex items-center gap-1"
          >
            <span>Open Interactive Dashboard</span>
            <ArrowRight className="w-3 h-3" />
          </Link>

          <Link
            href="/signup"
            onClick={onClose}
            className="btn-emerald-primary w-full sm:w-auto text-xs px-4 py-2"
          >
            Deploy This Agent →
          </Link>
        </div>
      </div>
    </div>
  );
}
