"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Sparkles, Phone, Zap, ShieldCheck } from "lucide-react";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Logo } from "@/components/brand/Logo";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      name: "Starter",
      description: "For small businesses deploying their first autonomous voice agent.",
      priceMonthly: "₹2,499",
      priceAnnual: "₹1,999",
      period: "/ month",
      badge: null,
      highlight: false,
      features: [
        "500 calling minutes included",
        "1 Indian PSTN phone number (+91)",
        "2 active voice agents",
        "Telugu, Tenglish & English support",
        "Cartesia Neural Cloned Voice (AD)",
        "Standard webhook & CRM integration",
        "Sub-200ms latency guarantee",
      ],
      ctaText: "Get Started",
      ctaLink: "/signup?plan=starter",
    },
    {
      name: "Growth",
      description: "For growing companies scaling outbound campaigns and inbound customer support.",
      priceMonthly: "₹7,999",
      priceAnnual: "₹6,499",
      period: "/ month",
      badge: "MOST POPULAR",
      highlight: true,
      features: [
        "2,000 calling minutes included",
        "3 Indian PSTN phone numbers (+91)",
        "10 active voice agents",
        "Custom voice cloning studio",
        "Dynamic SQL database tool execution",
        "Zero-latency conversational barge-in",
        "Priority Indian SIP trunk routing",
        "Dedicated Telegram/WhatsApp support",
      ],
      ctaText: "Start Free Trial",
      ctaLink: "/signup?plan=growth",
    },
    {
      name: "Enterprise",
      description: "For large contact centers and high-volume telecom deployments.",
      priceMonthly: "Custom",
      priceAnnual: "Custom",
      period: "",
      badge: "DEDICATED INFRA",
      highlight: false,
      features: [
        "Unlimited concurrent call capacity",
        "Dedicated Vobiz private SIP interconnect",
        "Custom regional language LLM fine-tuning",
        "99.95% telephony uptime SLA",
        "On-premise / hybrid database connectors",
        "SOC2 & ISO compliant call recording",
        "24/7 dedicated solutions engineer",
      ],
      ctaText: "Contact Sales",
      ctaLink: "/signup?plan=enterprise",
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
      <LandingHeader />

      <main className="flex-1 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          {/* Header */}
          <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-16">
            <div className="ref-pill mb-4">
              <span className="ref-pill-dot" />
              <span>TRANSPARENT TELEPHONY PRICING</span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 mb-6">
              Simple pricing for voice intelligence that scales with you.
            </h1>

            <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-2xl mb-8">
              Every plan includes Cartesia neural speech synthesis, Vobiz PSTN carrier connectivity, and sub-150ms real-time conversational processing.
            </p>

            {/* Toggle Monthly / Annual */}
            <div className="flex items-center gap-2 p-1.5 rounded-full bg-white border border-[#EAEBE8] shadow-xs">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
                  billingCycle === "monthly"
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly billing
              </button>
              <button
                onClick={() => setBillingCycle("annual")}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>Annual billing</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`ref-card p-8 flex flex-col justify-between relative ${
                  plan.highlight
                    ? "border-emerald-700 shadow-xl ring-2 ring-emerald-600/20 bg-white"
                    : "bg-white/80"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-emerald-800 text-white text-[10px] font-extrabold tracking-wider uppercase shadow-xs">
                    {plan.badge}
                  </div>
                )}

                <div>
                  <div className="mb-6">
                    <h3 className="font-heading text-xl font-bold text-slate-900 mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-8 pb-6 border-b border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="font-heading text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                        {billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly}
                      </span>
                      {plan.period && (
                        <span className="text-xs font-semibold text-slate-500">
                          {plan.period}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3.5 mb-8">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                      What's included
                    </span>
                    {plan.features.map((feat) => (
                      <div key={feat} className="flex items-start gap-3 text-xs text-slate-700">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={plan.ctaLink}
                  className={`w-full text-center py-3 rounded-full text-xs font-bold transition-all shadow-xs ${
                    plan.highlight
                      ? "btn-emerald-primary"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-800"
                  }`}
                >
                  {plan.ctaText} →
                </Link>
              </div>
            ))}
          </div>

          {/* Telephony Transparency Strip */}
          <div className="mt-16 p-8 rounded-3xl bg-white border border-[#EAEBE8] max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-heading text-sm font-bold text-slate-900">
                  Direct PSTN Telephony Rates
                </h4>
                <p className="text-xs text-slate-500">
                  Overage minutes billed transparently at ₹1.20 / min (inbound) and ₹1.40 / min (outbound) with no hidden carrier surcharges.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard"
              className="btn-emerald-secondary text-xs px-5 py-2.5 shrink-0"
            >
              View Rate Card
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-12 bg-white border-t border-[#EAEBE8] text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <Logo href="/" size="sm" />
          <p>© {new Date().getFullYear()} QETADOTIN Technologies. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
