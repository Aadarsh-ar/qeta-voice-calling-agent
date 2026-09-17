"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Building2,
  PhoneCall,
  Calendar,
  ShieldAlert,
  Headphones,
  ArrowRight,
  Play,
  Copy,
  Sparkles,
  Bot,
  CheckCircle2,
} from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Logo } from "@/components/brand/Logo";
import { LiveAgentAudioModal } from "@/components/landing/LiveAgentAudioModal";

interface TemplateItem {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  description: string;
  language: string;
  voice: string;
  greetingSample: string;
  recommendedFor: string;
  tools: string[];
}

const TEMPLATES: TemplateItem[] = [
  {
    id: "real-estate",
    title: "Real Estate Site Tour Coordinator",
    category: "Property & Construction",
    icon: Building2,
    description: "Calls inbound property inquiries within 10 seconds, answers pricing and floor plan questions, and books site visits.",
    language: "Telugu & Tenglish",
    voice: "AD (Cloned Neural)",
    greetingSample: "నమస్కారం అండి, QETADOTIN రియల్ ఎస్టేట్ నుంచి కాల్ చేస్తున్నాను. విల్లా సైట్ విజిట్ కోసం వివరాలు చెప్పమంటారా?",
    recommendedFor: "Builders, Real Estate Developers, Brokers",
    tools: ["capture_lead", "schedule_site_visit", "transfer_call"],
  },
  {
    id: "ecommerce-cod",
    title: "E-Commerce COD Order Verification",
    category: "Retail & Logistics",
    icon: PhoneCall,
    description: "Verifies delivery addresses, confirms Cash-On-Delivery readiness, and reschedules delivery slots automatically.",
    language: "Telugu & English",
    voice: "AD (Cloned Neural)",
    greetingSample: "హలో అండి! మీ ఆర్డర్ 4567 డెలివరీ కన్ఫర్మేషన్ కోసం కాల్ చేస్తున్నాను. రేపు మధ్యాహ్నం 2:00 PM కి అందుబాటులో ఉంటారా?",
    recommendedFor: "Shopify Brands, D2C Sellers, Logistics Hubs",
    tools: ["get_order_status", "confirm_cod", "reschedule_delivery"],
  },
  {
    id: "appointment-booking",
    title: "Healthcare & Clinic Scheduler",
    category: "Medical & Clinics",
    icon: Calendar,
    description: "Handles patient phone inquiries 24/7, books doctor slots, and sends appointment reminders via WhatsApp/SMS.",
    language: "Telugu / Tenglish",
    voice: "AD (Cloned Neural)",
    greetingSample: "నమస్కారం అండి! మీరు ఏ డాక్టర్ గారికి అపాయింట్‌మెంట్ తీసుకోవాలనుకుంటున్నారో చెప్పగలరా?",
    recommendedFor: "Clinics, Diagnostic Labs, Dental Studios",
    tools: ["check_doctor_availability", "book_slot", "send_sms_confirmation"],
  },
  {
    id: "customer-support",
    title: "Inbound Customer Support Agent",
    category: "Support & Helpdesk",
    icon: Headphones,
    description: "Resolves warranty claims, return policies, and business FAQs with zero customer waiting time.",
    language: "Telugu / Tenglish / English",
    voice: "AD (Cloned Neural)",
    greetingSample: "హలో అండి! నేను ABC Support నుంచి మాట్లాడుతున్నాను. మీ సమస్య ఏమిటో చెప్పండి, వెంటనే సహాయం చేస్తాను.",
    recommendedFor: "Electronics Retail, Consumer Brands, SaaS Companies",
    tools: ["lookup_knowledge_base", "escalate_to_human", "end_call"],
  },
];

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  const categories = ["ALL", "Property & Construction", "Retail & Logistics", "Medical & Clinics", "Support & Helpdesk"];

  const filtered = selectedCategory === "ALL"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      <LandingHeader />

      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-14">
            <div className="ref-pill mb-4">
              <span className="ref-pill-dot" />
              <span>PRE-TRAINED AGENT TEMPLATES</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Deploy battle-tested voice agents in one click.
            </h1>

            <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mb-8">
              Skip prompt engineering. Clone ready-to-use voice agents with pre-configured greetings, conversational knowledge, and CRM tools.
            </p>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    selectedCategory === cat
                      ? "bg-emerald-900 text-white shadow-xs"
                      : "bg-white border border-[#EAEBE8] text-slate-600 hover:text-slate-900 hover:border-slate-300"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Template Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {filtered.map((tpl) => {
              const Icon = tpl.icon;

              return (
                <div
                  key={tpl.id}
                  className="ref-card p-8 flex flex-col justify-between bg-white group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {tpl.category}
                      </span>
                    </div>

                    <h3 className="font-heading text-xl font-bold text-slate-900 mb-2">
                      {tpl.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed mb-6">
                      {tpl.description}
                    </p>

                    {/* Spoken Greeting Sample Box */}
                    <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-100 mb-6">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                        Spoken Opening Greeting
                      </span>
                      <p className="text-xs font-medium text-slate-800 italic leading-relaxed">
                        "{tpl.greetingSample}"
                      </p>
                    </div>

                    {/* Metadata Specs */}
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600 mb-8">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        🗣️ {tpl.language}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                        🎙️ {tpl.voice}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        ⚡ {tpl.tools.length} Tools Connected
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                    <button
                      onClick={() => setIsAudioModalOpen(true)}
                      className="btn-emerald-secondary text-xs px-4 py-2.5 flex-1"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Audition Voice</span>
                    </button>

                    <Link
                      href={`/agents/new?template=${tpl.id}`}
                      className="btn-emerald-primary text-xs px-4 py-2.5 flex-1"
                    >
                      <span>Clone to Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="py-12 bg-white border-t border-[#EAEBE8] text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <Logo href="/" size="sm" />
          <p>© {new Date().getFullYear()} QETADOTIN Technologies. All rights reserved.</p>
        </div>
      </footer>

      <LiveAgentAudioModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
      />
    </div>
  );
}
