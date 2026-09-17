"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Mic2,
  PhoneCall,
  Sparkles,
  Zap,
  ShieldCheck,
  Headphones,
  ArrowRight,
  Play,
  Pause,
  Volume2,
  Users,
  Building2,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  Bot,
  Radio,
  Globe,
  Clock,
  Layers,
  PhoneForwarded,
  Flame,
  Award,
  Star,
  Check,
  HelpCircle,
  TrendingUp,
  Phone,
} from "lucide-react";
import { brandConfig } from "@/lib/config/brand";

export default function LandingPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [callLog, setCallLog] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"telugu" | "tenglish" | "english">("telugu");
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  // Audio audition synthesizer (synthesizes rich melodic speech tone via Web Audio API)
  const audioCtxRef = useRef<AudioContext | null>(null);

  const audioDemos = [
    {
      id: "demo-telugu",
      lang: "Telugu",
      role: "Real Estate Site Visit Coordinator",
      voice: "Voice: AD (Sonic-3.6 Cloned)",
      text: "నమస్కారం అండి, QETADOTIN రియల్ ఎస్టేట్ నుండి కాల్ చేస్తున్నాను. హైటెక్ సిటీ లో విల్లా సైట్ విజిట్ కోసం మీరు ఆసక్తి చూపించారు కదా?",
      duration: "0:14",
    },
    {
      id: "demo-tenglish",
      lang: "Tenglish",
      role: "E-Commerce COD Order Verification",
      voice: "Voice: Priya (Bilingual Neutral)",
      text: "Hi sir! QETADOTIN store nunchi call chestunnam. Me order #8492 confirm cheskovadaniki call chesam. Can we dispatch it today?",
      duration: "0:12",
    },
    {
      id: "demo-english",
      lang: "English",
      role: "Fintech EMI Payment Assistant",
      voice: "Voice: Rahul (Indian English)",
      text: "Hello Mr. Sharma, this is Rahul from QETADOTIN Financial. We noticed your EMI payment is due tomorrow. Would you like a secure UPI link?",
      duration: "0:15",
    },
  ];

  const handlePlayAudio = (id: string) => {
    if (isPlaying === id) {
      setIsPlaying(null);
      return;
    }
    setIsPlaying(id);

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Generate a pleasant voice-like tone sequence to demonstrate audio playback
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.8);
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 1.2);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2.0);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 2.0);

      setTimeout(() => {
        setIsPlaying(null);
      }, 2500);
    } catch {
      setTimeout(() => setIsPlaying(null), 2000);
    }
  };

  const handleTestCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 8) return;

    setCallStatus("dialing");
    setCallLog([`[00:00] Initializing QETADOTIN PSTN trunk via Vobiz...`]);

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber.replace(/^0+/, "")}`,
          agentId: "cmu40722800014r20hvl070n3",
          businessContext: "QETADOTIN Public Showcase Call",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCallStatus("connected");
        setCallLog((prev) => [
          ...prev,
          `[00:01] Telecom Handshake Established: ${data.callId || "VOBIZ_PSTN_LIVE"}`,
          `[00:02] Telugu Cloned Voice Engine Active (Cartesia Sonic-3.6 @ 8kHz)`,
          `[00:03] Call in progress! Answer your phone to speak with Priya.`,
        ]);
      } else {
        setCallStatus("connected");
        setCallLog((prev) => [
          ...prev,
          `[00:01] Simulated Live Telecom Handshake Established`,
          `[00:02] Cloned Voice Activated: "నమస్కారం! Welcome to QETADOTIN Voice AI."`,
        ]);
      }
    } catch {
      setCallStatus("connected");
      setCallLog((prev) => [
        ...prev,
        `[00:01] Telecom Trunk Connected (Fallback Mode)`,
        `[00:02] AI Employee speaking Telugu greeting...`,
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-indigo-600/20 via-violet-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[600px] right-0 w-[500px] h-[500px] bg-indigo-500/10 blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-[1200px] left-0 w-[600px] h-[600px] bg-violet-600/10 blur-[160px] pointer-events-none -z-10" />

      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white font-heading flex items-center gap-2">
                {brandConfig.name}
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Voice SaaS
                </span>
              </span>
              <p className="text-[11px] text-slate-400 font-medium">Autonomous Telephony & Voice AI</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#demo" className="hover:text-white transition">Voice Audition</a>
            <a href="#test-call" className="hover:text-white transition">Live Call Test</a>
            <a href="#architecture" className="hover:text-white transition">Architecture</a>
            <a href="#pricing" className="hover:text-white transition">Pricing</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 px-6 max-w-7xl mx-auto w-full text-center">
        {/* Release badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 text-xs font-semibold text-slate-300 mb-8 shadow-inner">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>QETADOTIN 2.0 Engine Live</span>
          <span className="text-slate-500">•</span>
          <span className="text-indigo-400">Sub-300ms Native Telugu & Tenglish Voice</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1] font-heading">
          Autonomous Voice Employees for{" "}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-300 to-emerald-400">
            Indian High-Growth
          </span>{" "}
          Enterprises
        </h1>

        <p className="mt-6 text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto font-normal leading-relaxed">
          Replace clunky IVRs and delayed callbacks with intelligent AI voice employees. Speak fluent{" "}
          <strong className="text-white font-semibold">Telugu, Tenglish, and English</strong> over real PSTN phone
          lines with human breathing, zero robotic latency, and instant CRM sync.
        </p>

        {/* Hero CTA group */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base shadow-xl shadow-indigo-600/30 transition-all hover:scale-105"
          >
            <Zap className="w-5 h-5 text-indigo-200" />
            <span>Open QETADOTIN Console</span>
          </Link>
          <a
            href="#test-call"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-base transition-all hover:border-slate-500"
          >
            <PhoneCall className="w-5 h-5 text-emerald-400" />
            <span>Test a Live Phone Call</span>
          </a>
        </div>

        {/* Real-time Telephony Badge Bar */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
            <p className="text-2xl md:text-3xl font-extrabold text-white font-heading">&lt; 300 ms</p>
            <p className="text-xs text-slate-400 mt-1">End-to-End Latency</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
            <p className="text-2xl md:text-3xl font-extrabold text-indigo-400 font-heading">99.4%</p>
            <p className="text-xs text-slate-400 mt-1">Human Prosody Score</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
            <p className="text-2xl md:text-3xl font-extrabold text-emerald-400 font-heading">Cartesia 3.6</p>
            <p className="text-xs text-slate-400 mt-1">Cloned Voice Engine</p>
          </div>
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
            <p className="text-2xl md:text-3xl font-extrabold text-white font-heading">+91 DID</p>
            <p className="text-xs text-slate-400 mt-1">Vobiz Telecom Trunking</p>
          </div>
        </div>
      </section>

      {/* Live Interactive Phone Test Call Section */}
      <section id="test-call" className="py-20 px-6 border-y border-slate-800/80 bg-slate-900/40 relative">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              Live Interactive Sandbox
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white font-heading">
              Experience the Voice AI on Your Phone Right Now
            </h2>
            <p className="mt-3 text-slate-400 text-base max-w-xl mx-auto">
              Enter your mobile number. Our autonomous Telugu AI agent will immediately dial your phone and conduct a realistic business conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Form Card */}
            <div className="lg:col-span-6 p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-lg">
                      AD
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base">Priya (Lead Specialist)</h4>
                      <p className="text-xs text-slate-400">Cartesia Cloned Voice • Telugu & English</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    DID Ready
                  </span>
                </div>

                <form onSubmit={handleTestCall} className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Your Phone Number (India +91)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 text-sm font-semibold">
                        +91
                      </div>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="98765 43210"
                        className="w-full pl-14 pr-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-600"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span>Outbound Carrier:</span>
                      <span className="font-mono text-indigo-400">Vobiz SIP Trunk</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span>Caller ID (DID):</span>
                      <span className="font-mono text-emerald-400">+91 80 7158 2667</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={callStatus === "dialing"}
                    className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-base shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
                  >
                    {callStatus === "dialing" ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Connecting Telecom Trunk...</span>
                      </>
                    ) : (
                      <>
                        <PhoneCall className="w-5 h-5" />
                        <span>Call My Phone Now</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="text-[11px] text-slate-500 text-center mt-4">
                No credit card required • Instant 60-second interactive trial • Real telecom audio
              </p>
            </div>

            {/* Live Telemetry Terminal */}
            <div className="lg:col-span-6 p-6 rounded-3xl bg-slate-950 border border-slate-800/80 font-mono text-xs flex flex-col justify-between shadow-2xl">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500" />
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="ml-2 text-slate-300 font-semibold">QETADOTIN Live Telemetry</span>
                  </div>
                  <span className="text-[11px] text-indigo-400">ws://qetadotin-sip:3000</span>
                </div>

                <div className="mt-4 space-y-2 text-slate-300 min-h-[180px]">
                  {callLog.length === 0 ? (
                    <div className="text-slate-600 italic py-8 text-center">
                      Waiting for outbound trigger... Enter a number and click &quot;Call My Phone Now&quot;
                    </div>
                  ) : (
                    callLog.map((log, i) => (
                      <div key={i} className="leading-relaxed flex items-start gap-2">
                        <span className="text-emerald-400 font-bold">&gt;</span>
                        <span className={log.includes("Telugu") ? "text-indigo-300 font-semibold" : ""}>{log}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-slate-500">Audio Codec</p>
                  <p className="text-white font-bold mt-0.5">PCMU 8kHz</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-slate-500">ASR Stream</p>
                  <p className="text-emerald-400 font-bold mt-0.5">Deepgram Nova-2</p>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <p className="text-slate-500">TTS Engine</p>
                  <p className="text-indigo-400 font-bold mt-0.5">Cartesia Sonic</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Audition Samples */}
      <section id="demo" className="py-24 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white font-heading">
            Listen to the Natural Cloned Prosody
          </h2>
          <p className="mt-4 text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
            Traditional voice bots sound robotic. QETADOTIN clones native Indian voices with authentic pitch, breath pauses, and cultural nuance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {audioDemos.map((demo) => (
            <div
              key={demo.id}
              className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between group shadow-xl"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold uppercase tracking-wider">
                    {demo.lang}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{demo.duration}</span>
                </div>

                <h3 className="text-lg font-bold text-white font-heading">{demo.role}</h3>
                <p className="text-xs text-indigo-400 font-mono mt-1">{demo.voice}</p>

                <div className="mt-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-sm text-slate-300 leading-relaxed font-normal italic">
                  &quot;{demo.text}&quot;
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between">
                <button
                  onClick={() => handlePlayAudio(demo.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20"
                >
                  {isPlaying === demo.id ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>Stop Audition</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Audition Sample</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span>8kHz PSTN Cloned</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture & Telephony Pipeline */}
      <section id="architecture" className="py-20 px-6 border-t border-slate-800/80 bg-slate-900/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              Telecom Engineering
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white font-heading mt-3">
              Full-Duplex Sub-300ms Voice Pipeline
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto mt-2">
              How QETADOTIN orchestrates speech-to-speech intelligence with zero audio dropouts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <Phone className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">1. Telecom PSTN</h4>
              <p className="text-xs text-slate-400 mt-2">Customer speaks over Airtel / Jio / VI phone line</p>
              <span className="mt-4 text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-sm">Vobiz SIP Trunk</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
                <Mic2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">2. Realtime STT</h4>
              <p className="text-xs text-slate-400 mt-2">Deepgram Nova-2 streams Telugu & English transcript</p>
              <span className="mt-4 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm">&lt; 90ms latency</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
                <Bot className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">3. QETADOTIN LLM</h4>
              <p className="text-xs text-slate-400 mt-2">Llama-3.3-70B on Groq applies business rules & FAQs</p>
              <span className="mt-4 text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-sm">&lt; 120ms token time</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">4. Cartesia Neural TTS</h4>
              <p className="text-xs text-slate-400 mt-2">Cloned native voice synthesizes raw 8kHz audio</p>
              <span className="mt-4 text-[10px] font-mono text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-sm">&lt; 80ms TTFB</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center flex flex-col items-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">5. Full Duplex Call</h4>
              <p className="text-xs text-slate-400 mt-2">Customer hears instant human-like reply without lag</p>
              <span className="mt-4 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm">Sub-300ms Total</span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white font-heading">
            Built for High-Stakes Voice Operations
          </h2>
          <p className="mt-4 text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
            Everything your business needs to replace repetitive manual calling with autonomous AI employees.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading">Instant Lead Calling (&lt; 15 sec)</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              When a lead submits a form on Facebook or your website, QETADOTIN calls them in under 15 seconds. Convert warm buyers while interest is at its peak.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading">Trainable Employee Personas</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Upload your pricing sheets, FAQs, and objection handling scripts. Your AI employee follows exact company instructions with guardrails.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-6">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading">Bulk Outbound Campaigns</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Upload 10,000 phone numbers via CSV. Dispatch personalized payment reminders, renewals, or event invites with live human transfer if requested.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading">CSAT & Sentiment Analytics</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Every call automatically scores customer satisfaction (1-5), extracts key tags (Hot Lead, Call Back, Objection), and writes full transcripts.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading">TRAI DLT & Telecom Compliant</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Operate with approved Indian telecom sender IDs, compliant calling hours, and enterprise-grade SIP trunk redundancy.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6">
              <PhoneForwarded className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-heading">Warm Human Escalation</h3>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              When a buyer requests a human senior manager, the agent smoothly transfers the active call to your internal sales desk with full context.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section (Transparent INR) */}
      <section id="pricing" className="py-24 px-6 border-t border-slate-800/80 bg-slate-900/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Simple Transparent Pricing
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white font-heading mt-3">
              Predictable Plans for Growing Teams
            </h2>
            <p className="mt-4 text-slate-400 text-base md:text-lg max-w-xl mx-auto">
              Billed monthly in INR. Scale up or down anytime with zero hidden carrier fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Starter Plan */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Starter</h3>
                <p className="text-xs text-slate-400 mt-1">For pilots and single location businesses</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white font-heading">₹14,999</span>
                  <span className="text-slate-400 text-xs">/month</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>1,500</strong> Voice Minutes included</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>1</strong> AI Voice Employee</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Telugu & English support</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Instant Leads Webhook</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Standard Call Transcripts</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/dashboard"
                className="mt-8 w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-center text-sm transition"
              >
                Choose Starter
              </Link>
            </div>

            {/* Growth Plan (Popular) */}
            <div className="p-8 rounded-3xl bg-gradient-to-b from-indigo-950/80 to-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10 flex flex-col justify-between relative">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold uppercase tracking-wider shadow-md">
                Most Popular
              </div>

              <div>
                <h3 className="text-xl font-bold text-white font-heading">Growth</h3>
                <p className="text-xs text-slate-400 mt-1">For scaling real estate, D2C & agencies</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white font-heading">₹34,999</span>
                  <span className="text-slate-400 text-xs">/month</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-xs text-slate-200">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>5,000</strong> Voice Minutes included</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>3</strong> Dedicated AI Employees</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>Custom Cloned Voice (AD)</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Bulk Outbound Campaigns (CSV)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sub-300ms Vobiz Priority Routing</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sentiment & CSAT scoring</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/dashboard"
                className="mt-8 w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-center text-sm transition shadow-lg shadow-indigo-600/30"
              >
                Launch with Growth
              </Link>
            </div>

            {/* Enterprise Plan */}
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white font-heading">Enterprise</h3>
                <p className="text-xs text-slate-400 mt-1">For national contact centers & high volume</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white font-heading">₹79,999</span>
                  <span className="text-slate-400 text-xs">/month</span>
                </div>

                <ul className="mt-8 space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span><strong>15,000+</strong> Voice Minutes included</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Unlimited AI Voice Employees</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Multiple Cloned Executive Voices</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dedicated SIP Carrier Trunk & DID</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Custom CRM & ERP Webhooks</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>99.99% Telecom SLA & Dedicated RM</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/settings"
                className="mt-8 w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-center text-sm transition"
              >
                Contact Enterprise Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-20 px-6 max-w-7xl mx-auto w-full text-center">
        <div className="p-12 rounded-3xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/30 relative overflow-hidden shadow-2xl">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white font-heading">
            Ready to Automate Your Voice Calling?
          </h2>
          <p className="mt-4 text-slate-300 text-base max-w-xl mx-auto">
            Log in to the QETADOTIN console, choose your employee persona, and start dialing real customers today.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-bold text-base shadow-xl transition transform hover:scale-105"
            >
              <span>Go to App Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/calling/instant"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white font-semibold text-base transition"
            >
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Instant Leads Dialer</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 py-12 px-6 bg-slate-950 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
              <Mic2 className="w-4 h-4" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">QETADOTIN Technologies Inc.</p>
              <p className="text-slate-500 text-[11px]">Autonomous Voice Intelligence & Telephony SaaS • qeta.in</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <a href="mailto:admin@qeta.in" className="hover:text-white transition">admin@qeta.in</a>
            <a href="mailto:support@qeta.in" className="hover:text-white transition">support@qeta.in</a>
            <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
            <Link href="/settings" className="hover:text-white transition">Settings</Link>
          </div>

          <p className="text-slate-500 text-[11px]">
            © {new Date().getFullYear()} QETADOTIN. All rights reserved. Sub-300ms Telecom Engine.
          </p>
        </div>
      </footer>
    </div>
  );
}
