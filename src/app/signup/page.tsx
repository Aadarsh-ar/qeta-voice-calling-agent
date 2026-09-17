"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, User, Building2, CheckCircle2, ShieldCheck, Bot } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState("TELUGU_ENGLISH");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const handleQuickTrial = () => {
    setIsLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col justify-between p-6 sm:p-10 selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Header */}
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Logo href="/" size="md" />
        <Link
          href="/"
          className="text-xs font-semibold text-slate-500 hover:text-emerald-800 transition"
        >
          ← Back to website
        </Link>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-auto pt-6 pb-10">
        <div className="ref-card p-8 sm:p-10 bg-white shadow-xl">
          <div className="text-center mb-7">
            <div className="ref-pill mb-4">
              <span className="ref-pill-dot" />
              <span>START 14-DAY TRIAL</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
              Create your voice intelligence account
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Deploy your first autonomous conversational voice agent in minutes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Your Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Aadarsh Kumar"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Business / Company Name
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  placeholder="ABC Electronics"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Primary Conversational Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition bg-white"
              >
                <option value="TELUGU_ENGLISH">Telugu & Tenglish (Bilingual Indian Mix)</option>
                <option value="TELUGU">Pure Telugu (తెలుగు)</option>
                <option value="ENGLISH">Indian English</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-emerald-primary w-full text-xs py-3 mt-4"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Workspace...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Create Workspace & Agent</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </form>

          {/* Instant Trial Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <span className="relative px-3 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Or Fast Trial
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickTrial}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-emerald-300/80 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition shadow-xs"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-700" />
            <span>1-Click Launch Instant Free Trial</span>
          </button>

          <p className="text-center text-xs text-slate-500 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-emerald-800 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          No credit card required
        </span>
        <span>•</span>
        <span>100 free testing minutes</span>
      </div>
    </div>
  );
}
