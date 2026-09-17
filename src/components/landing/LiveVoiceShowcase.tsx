"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Volume2,
  PhoneCall,
  CheckCircle2,
  ArrowRight,
  Radio,
  Mic,
} from "lucide-react";

interface ShowcaseScenario {
  id: string;
  tag: string;
  title: string;
  description: string;
  teluguText: string;
  englishTranslation: string;
  duration: string;
  ttfb: string;
}

const SCENARIOS: ShowcaseScenario[] = [
  {
    id: "attendance-alert",
    tag: "Parent Alert",
    title: "Faculty Attendance Notification",
    description: "Personalized call to student parents regarding semester attendance threshold.",
    teluguText: "నమస్తే అండి, నేను హారిక మేడమ్ మాట్లాడుతున్నాను. మీ అబ్బాయి అటెండెన్స్ గురించి కాల్ చేశాను.",
    englishTranslation: "Namaste, this is Harika Madam speaking. I am calling regarding your son's attendance.",
    duration: "0:06",
    ttfb: "61 ms",
  },
  {
    id: "counseling-75",
    tag: "Academic Advisory",
    title: "75% Rule & Exam Eligibility",
    description: "Polite natural counseling on University mandatory attendance regulations.",
    teluguText: "మీ అబ్బాయి అటెండెన్స్ ఈ సెమిస్టర్లో కొద్దిగా తక్కువగా ఉందని గమనించాను. రెగ్యులర్‌గా క్లాసులకు హాజరవడం ఎంత ముఖ్యమో మీకు తెలుసు కదా.",
    englishTranslation: "I noticed your son's attendance is slightly low this semester. You know how important regular classes are for exam eligibility.",
    duration: "0:09",
    ttfb: "74 ms",
  },
  {
    id: "deadline-support",
    tag: "Exam Guidance",
    title: "Semester Exam Fee & Welfare",
    description: "Guidance on examination registration deadlines and faculty support.",
    teluguText: "అటెండెన్స్ తక్కువగా ఉంటే పరీక్షలకు కూర్చోవడానికి ఇబ్బందులు రావచ్చు. దయచేసి ఒకసారి మీ అబ్బాయితో మాట్లాడి, అతను క్లాసులకు సరిగ్గా వెళ్ళేలా చూస్తారని ఆశిస్తున్నాను.",
    englishTranslation: "Low attendance can cause issues with exam eligibility. Please talk with your son and ensure he attends classes regularly.",
    duration: "0:11",
    ttfb: "68 ms",
  },
];

interface Props {
  onOpenLiveModal?: () => void;
}

export function LiveVoiceShowcase({ onOpenLiveModal }: Props) {
  const [activeScenario, setActiveScenario] = useState<ShowcaseScenario>(SCENARIOS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "success" | "error">("idle");
  const [callMessage, setCallMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleTogglePlay = async (scenario: ShowcaseScenario) => {
    if (isPlaying && activeScenario.id === scenario.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setActiveScenario(scenario);
    setProgress(0);
    setIsLoading(true);

    try {
      let dataUrl = audioCacheRef.current.get(scenario.id);

      if (!dataUrl) {
        const res = await fetch("/api/agent/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
            voiceId: "41508a7d-4839-445f-ba7f-687f620ed0e7",
            ttsOnly: true,
            textToSpeak: scenario.teluguText,
          }),
        });
        const data = await res.json();
        if (data.audioDataUrl) {
          dataUrl = data.audioDataUrl;
          audioCacheRef.current.set(scenario.id, dataUrl);
        }
      }

      setIsLoading(false);

      if (dataUrl) {
        const audio = new Audio(dataUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsPlaying(true);
          progressIntervalRef.current = setInterval(() => {
            if (audio.duration) {
              setProgress((audio.currentTime / audio.duration) * 100);
            }
          }, 60);
        };

        audio.onended = () => {
          setIsPlaying(false);
          setProgress(100);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          setTimeout(() => setProgress(0), 400);
        };

        audio.onerror = () => {
          setIsPlaying(false);
          setIsLoading(false);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };

        await audio.play();
      } else {
        setIsPlaying(false);
      }
    } catch (e) {
      console.warn("Audio playback error:", e);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleInstantPhoneCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setCallStatus("calling");
    setCallMessage("Initiating Vobiz telecom trunk...");

    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phoneNumber,
          agentId: "agent_vDCfnuFdJokXJDVxgmHeZx",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCallStatus("success");
        setCallMessage("Calling now! Answer your phone to speak with Harika Madam.");
      } else {
        setCallStatus("error");
        setCallMessage(data.error || "Could not dispatch call. Please verify phone number.");
      }
    } catch {
      setCallStatus("error");
      setCallMessage("Connection error while dialing. Please try again.");
    }
  };

  return (
    <section id="showcase" className="py-20 lg:py-28 bg-[#F4F6F0] border-b border-[#E3E6DC] relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-emerald-500/8 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-16">
          <div className="ref-pill mb-4">
            <span className="ref-pill-dot" />
            <span>LIVE VOICE AUDITION</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-5xl font-bold text-slate-900 tracking-tight mb-4">
            Listen to Harika. <br className="hidden sm:inline" />
            <span className="text-emerald-700">Autonomous Telugu Voice Intelligence.</span>
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            Experience sub-100ms conversational prosody powered by Cartesia Sonic-3.6 and Vobiz telephony.
            Audition sample dialogue or have her call your phone right now.
          </p>
        </div>

        {/* Master Showcase Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Interactive Audio Player Console (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              {/* Agent Identity Bar */}
              <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl shadow-md">
                      🎓
                    </div>
                    {isPlaying && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-heading text-lg font-bold text-slate-900">
                        Harika (హారిక మేడమ్)
                      </h3>
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Verified
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      College Faculty Attendance Helpline • Native Telugu Prosody
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Response TTFB
                  </span>
                  <span className="text-sm font-mono font-bold text-emerald-700">
                    {activeScenario.ttfb}
                  </span>
                </div>
              </div>

              {/* Scenario Selector Tabs */}
              <div className="grid grid-cols-3 gap-2 my-6 p-1.5 bg-slate-100/90 rounded-2xl">
                {SCENARIOS.map((sc) => {
                  const isCur = activeScenario.id === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => handleTogglePlay(sc)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left flex flex-col ${
                        isCur
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
                      }`}
                    >
                      <span className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider">
                        {sc.tag}
                      </span>
                      <span className="text-xs font-bold truncate mt-0.5">{sc.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Spoken Dialog Transcript Card */}
              <div className="p-6 rounded-2xl bg-[#FAFAF8] border border-slate-200/80 relative">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium mb-3">
                  <span className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <Volume2 className="w-3.5 h-3.5" />
                    Spoken Telugu Speech
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Cartesia Sonic-3.6 @ 16kHz
                  </span>
                </div>

                {/* Telugu Spoken Text */}
                <p className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed font-sans mb-3">
                  &ldquo;{activeScenario.teluguText}&rdquo;
                </p>

                {/* English Subtitle Translation */}
                <p className="text-xs text-slate-500 italic leading-relaxed pt-3 border-t border-slate-200/60">
                  Translation: &ldquo;{activeScenario.englishTranslation}&rdquo;
                </p>

                {/* Audio Progress Bar */}
                <div className="mt-5 pt-3 border-t border-slate-200/60 flex items-center gap-3">
                  <span className="text-[11px] font-mono text-slate-500">
                    {isPlaying ? "Playing..." : "0:00"}
                  </span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {activeScenario.duration}
                  </span>
                </div>
              </div>
            </div>

            {/* Playback Controls & Animated Waveform */}
            <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleTogglePlay(activeScenario)}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 group shrink-0"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current transition-transform group-hover:scale-110" />
                  )}
                  <span>
                    {isLoading
                      ? "Synthesizing Audio..."
                      : isPlaying
                      ? "Pause Audition"
                      : "Audition Harika's Voice"}
                  </span>
                </button>

                {/* Animated Equalizer Waveform */}
                <div className="flex items-end gap-1 h-8 px-3 py-1 bg-slate-50 rounded-xl border border-slate-200">
                  {[8, 16, 24, 12, 28, 18, 10, 22, 14, 20].map((baseHeight, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isPlaying ? "bg-emerald-600" : "bg-slate-300"
                      }`}
                      style={{
                        height: isPlaying ? `${Math.max(6, (baseHeight * (progress + 20)) % 28)}px` : "6px",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Two-Way Conversation Trigger */}
              {onOpenLiveModal && (
                <button
                  type="button"
                  onClick={onOpenLiveModal}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition"
                >
                  <Mic className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Talk with Harika in Browser</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Live Telecom Phone Dialer Card (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-[#064E3B] rounded-3xl p-6 sm:p-8 text-white shadow-2xl flex flex-col justify-between border border-slate-800">
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#34D399] animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Live Telephony Sandbox
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400">Vobiz Carrier</span>
              </div>

              <div className="my-6">
                <h3 className="font-heading text-xl sm:text-2xl font-bold text-white mb-2">
                  Call Your Phone Right Now
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your Indian mobile number. Our telephony line (+91 80 7158 2667) will dial your phone immediately so you can talk to Harika in Telugu.
                </p>
              </div>

              <form onSubmit={handleInstantPhoneCall} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Recipient Mobile Number (India +91)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-400 font-semibold text-sm pointer-events-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="63053 67443"
                      className="w-full pl-14 pr-4 py-3.5 rounded-2xl bg-slate-950/80 border border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={callStatus === "calling" || !phoneNumber.trim()}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 active:scale-98"
                >
                  {callStatus === "calling" ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                      <span>Dialing Telecom Trunk...</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4 fill-current" />
                      <span>Call My Phone Now</span>
                    </>
                  )}
                </button>
              </form>

              {/* Call Feedback Notification */}
              {callMessage && (
                <div
                  className={`mt-4 p-3.5 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in duration-200 ${
                    callStatus === "success"
                      ? "bg-emerald-950/90 border border-emerald-500/40 text-emerald-200"
                      : "bg-red-950/90 border border-red-500/40 text-red-200"
                  }`}
                >
                  {callStatus === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Radio className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{callMessage}</span>
                </div>
              )}
            </div>

            {/* Telemetry Footer Strip */}
            <div className="pt-6 mt-6 border-t border-slate-800 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
              <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Caller DID</span>
                <span className="text-white font-mono font-semibold">+91 80 7158</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Agent Model</span>
                <span className="text-emerald-400 font-semibold">Harika (Sonic)</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-500 block">Carrier</span>
                <span className="text-white font-semibold">Vobiz SIP</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
