"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, ShieldCheck, AlertCircle } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const nextUrl = searchParams.get("next") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        router.push(nextUrl);
        router.refresh();
      } else {
        setError(data.error || "Invalid credentials. Please try again.");
        setIsLoading(false);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsLoading(false);
    }
  };

  return (
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
          Enter your admin credentials to access the QETADOTIN console.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800 font-medium animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Admin Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@qeta.in"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition bg-white"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="password"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition bg-white"
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
              <span>Sign In to Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col justify-between p-6 sm:p-10 selection:bg-emerald-100 selection:text-emerald-900">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between">
        <Logo href="/" size="md" />
        <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-emerald-800 transition">
          Back to website
        </Link>
      </div>

      <div className="max-w-md w-full mx-auto my-auto pt-8 pb-12">
        <Suspense fallback={<div className="text-center text-xs text-slate-400 py-8">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>

      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400 flex items-center justify-center gap-4">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          Admin-Only Access
        </span>
        <span>Cartesia Cloned Voice Security</span>
      </div>
    </div>
  );
}
