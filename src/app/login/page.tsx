"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, CheckCircle2, Bot, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@qeta.in");
  const [password, setPassword] = useState("••••••••••••");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 600);
  };

  const handleQuickDemo = () => {
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
      <div className="max-w-md w-full mx-auto my-auto pt-8 pb-12">
        <div className="ref-card p-8 sm:p-10 bg-white shadow-xl">
          <div className="text-center mb-8">
            <div className="ref-pill mb-4">
              <span className="ref-pill-dot" />
              <span>QETADOTIN CONSOLE</span>
            </div>
            <h1 className="font-heading text-2xl font-bold text-slate-900 tracking-tight">
              Sign in to your voice workspace
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Enter your credentials to manage active voice agents and telephony trunks.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <a href="#" className="text-[11px] font-semibold text-emerald-700 hover:underline">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-emerald-primary w-full text-xs py-3 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Authorizing...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Access Divider */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <span className="relative px-3 bg-white text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Or Fast Demo
            </span>
          </div>

          <button
            type="button"
            onClick={handleQuickDemo}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full border border-emerald-300/80 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition shadow-xs"
          >
            <Bot className="w-3.5 h-3.5 text-emerald-700" />
            <span>1-Click Demo Access to Workspace</span>
          </button>

          <p className="text-center text-xs text-slate-500 mt-6">
            Don't have an account?{" "}
            <Link href="/signup" className="font-bold text-emerald-800 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Footer info */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          SOC2 Type II Certified
        </span>
        <span>•</span>
        <span>Cartesia Cloned Voice Security</span>
      </div>
    </div>
  );
}
