"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Play,
  ArrowRight,
  ShieldCheck,
  Zap,
  PhoneCall,
  CheckCircle2,
  Globe,
  Clock,
  Sparkles,
  Bot,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { HeroValueStrip } from "@/components/landing/HeroValueStrip";
import { LiveVoiceShowcase } from "@/components/landing/LiveVoiceShowcase";
import { LiveAgentAudioModal } from "@/components/landing/LiveAgentAudioModal";
import { Logo } from "@/components/brand/Logo";

export default function HomePage() {
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      {/* ─── 1. Header (Matching Reference Navigation) ─── */}
      <LandingHeader />

      {/* ─── 2. Hero Section (Pixel-Aligned to Reference Image) ─── */}
      <section className="relative pt-8 pb-16 lg:pt-14 lg:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Editorial Headline & CTAs */}
            <div className="lg:col-span-6 flex flex-col items-start text-left z-10">
              {/* Reference Pill Badge: ● AI VOICE AGENTS */}
              <div className="ref-pill mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <span className="ref-pill-dot" />
                <span>AI VOICE AGENTS</span>
              </div>

              {/* Main Headline (Exact Reference Typography) */}
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-[4.25rem] font-bold text-slate-900 tracking-[-0.035em] leading-[1.08] mb-6">
                Conversations<br />
                that move<br />
                <span className="text-emerald-700 font-bold">business forward.</span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-slate-600 font-normal leading-relaxed max-w-xl mb-8">
                AI voice agents that call, answer, qualify, book and support — so you never miss an opportunity.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                {/* Primary CTA */}
                <Link
                  href="/login"
                  className="btn-emerald-primary text-sm sm:text-base px-7 py-3.5 shadow-md group"
                >
                  <span>Get started</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </Link>

                {/* Secondary CTA (Interactive Audio Audition) */}
                <button
                  type="button"
                  onClick={() => setIsAudioModalOpen(true)}
                  className="btn-emerald-secondary text-sm sm:text-base px-6 py-3.5 group"
                >
                  <span className="w-6 h-6 rounded-full bg-emerald-100/90 text-emerald-800 flex items-center justify-center shrink-0 -ml-1 transition-transform group-hover:scale-105">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </span>
                  <span>Listen to a live agent</span>
                </button>
              </div>
            </div>

            {/* Right Column: Hero Visual (3D Emerald Torus + Flowing Waveform + Badges) */}
            <div className="lg:col-span-6 flex items-center justify-center lg:justify-end">
              <HeroVisual />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. Hero Value Strip (4 Metric Columns with Separators) ─── */}
      <HeroValueStrip />

      {/* ─── 3.5. Live Voice Audition & Telephony Showcase ─── */}
      <LiveVoiceShowcase onOpenLiveModal={() => setIsAudioModalOpen(true)} />

      {/* ─── 4. Product Section: Enterprise Voice Solutions ─── */}
      <section id="solutions" className="py-20 lg:py-28 bg-white border-b border-[#EAEBE8]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-16">
            <div className="ref-pill mb-4">
              <span className="ref-pill-dot" />
              <span>INDUSTRY SOLUTIONS</span>
            </div>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-4">
              Engineered for high-volume conversational workloads.
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              From real estate site tours to e-commerce delivery confirmations, deploy purpose-built voice agents in minutes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="ref-card p-8 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200/80 flex items-center justify-center text-emerald-700 mb-6">
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="font-heading text-xl font-bold text-slate-900 mb-2">
                  Real Estate & Site Visits
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Calls inbound leads within 10 seconds, answers pricing and floor plan questions in Telugu, and schedules site tours automatically.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
                <span>94% Lead Qualification Rate</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 2 */}
            <div className="ref-card p-8 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200/80 flex items-center justify-center text-emerald-700 mb-6">
                  <PhoneCall className="w-6 h-6" />
                </div>
                <h3 className="font-heading text-xl font-bold text-slate-900 mb-2">
                  E-Commerce COD Verification
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Confirms cash-on-delivery orders, verifies shipping addresses, and reschedules delivery slots, reducing RTO returns by 38%.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
                <span>Zero-Wait Order Verification</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Card 3 */}
            <div className="ref-card p-8 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 border border-emerald-200/80 flex items-center justify-center text-emerald-700 mb-6">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="font-heading text-xl font-bold text-slate-900 mb-2">
                  Healthcare & Clinic Appointments
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed mb-6">
                  Answers patient queries 24/7, books doctor appointments, and sends instant SMS confirmations without human receptionist delays.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700">
                <span>24/7 Telephony Availability</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. Technology & Architecture Section ─── */}
      <section id="product" className="py-20 lg:py-28 bg-[#FAFAF8] border-b border-[#EAEBE8]">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="ref-pill">
                <span className="ref-pill-dot" />
                <span>VOICE INFRASTRUCTURE</span>
              </div>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
                Extreme low-latency telephony runtime with human conversational pacing.
              </h2>
              <p className="text-slate-600 text-base leading-relaxed">
                QETADOTIN delivers state-of-the-art neural voice streaming with enterprise-grade telephony for real-time natural conversations.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-heading text-sm font-bold text-slate-900">
                      Pre-Warmed 0ms Starter Greeting
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      8kHz μ-law audio cached in server RAM delivers instant spoken greetings upon call answer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-heading text-sm font-bold text-slate-900">
                      Real-Time Barge-In Interruption
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Subscribed to telephony audio clear signals; when customers speak, the agent yields instantly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-heading text-sm font-bold text-slate-900">
                      Enterprise CRM & Database Tools
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Executes live SQL queries, lead capture, and call transfers without leaving the conversational thread.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              {/* Visual Pipeline Stack Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl">
                <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Live Telephony Engine
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Vobiz DID +91 80 7158 2667
                  </span>
                </div>

                <div className="space-y-4 py-6">
                  <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <div>
                        <span className="font-heading text-sm font-bold text-slate-900 block">
                          PSTN Inbound Call Pickup
                        </span>
                        <span className="text-xs text-slate-500">
                          Vobiz SIP Carrier Webhook · 10ms Answer
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-emerald-700">0ms</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        2
                      </div>
                      <div>
                        <span className="font-heading text-sm font-bold text-slate-900 block">
                          Cartesia Sonic-3.6 Synthesis
                        </span>
                        <span className="text-xs text-slate-500">
                          Cloned Telugu Neural Model AD · 8kHz μ-law
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-emerald-700">162ms</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        3
                      </div>
                      <div>
                        <span className="font-heading text-sm font-bold text-slate-900 block">
                          Conversational Intelligence & RAG
                        </span>
                        <span className="text-xs text-slate-500">
                          Groq 70B Versatile + Postgres Knowledge Store
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-emerald-700">312ms</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Total Conversational Turn Latency
                  </span>
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    Grade: Production Realtime
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. Final Call-to-Action Banner ─── */}
      <section className="py-20 lg:py-28 bg-[#064E3B] text-white relative overflow-hidden">
        {/* Subtle radial glow overlay */}
        <div className="absolute inset-0 bg-radial from-emerald-500/20 via-transparent to-transparent blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 sm:px-8 text-center relative z-10">
          <h2 className="font-heading text-3xl sm:text-5xl font-bold tracking-tight mb-6 text-white">
            Ready to deploy conversations that move business forward?
          </h2>
          <p className="text-emerald-100/90 text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Create an agent in under 2 minutes, connect your phone number, and automate customer phone calls with human-like accuracy.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-emerald-950 font-bold text-sm sm:text-base hover:bg-emerald-50 transition shadow-xl hover:scale-105 active:scale-95 duration-200"
            >
              <span>Get started with QETADOTIN</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-emerald-400/50 text-white font-semibold text-sm sm:text-base hover:bg-emerald-800/60 transition"
            >
              <span>Explore Interactive Console</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 7. Clean Footer ─── */}
      <footer className="py-12 bg-white border-t border-[#EAEBE8] text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <Logo href="/" size="sm" />

          <div className="flex items-center gap-6 font-medium text-slate-600">
            <Link href="/templates" className="hover:text-emerald-800 transition">
              Templates
            </Link>
            <Link href="/pricing" className="hover:text-emerald-800 transition">
              Pricing
            </Link>
            <Link href="/dashboard" className="hover:text-emerald-800 transition">
              Console
            </Link>
            <Link href="/settings" className="hover:text-emerald-800 transition">
              Settings
            </Link>
          </div>

          <p>© {new Date().getFullYear()} QETADOTIN Technologies. All rights reserved.</p>
        </div>
      </footer>

      {/* ─── Interactive Live Agent Audio Modal ─── */}
      <LiveAgentAudioModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />
    </div>
  );
}
