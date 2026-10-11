"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { unlockAudio } from "@/lib/audio/unlock";

interface LandingHeaderProps {
  onOpenTestAgent?: () => void;
}

export function LandingHeader({ onOpenTestAgent }: LandingHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTestAgentClick = () => {
    unlockAudio();
    if (onOpenTestAgent) onOpenTestAgent();
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#FAFAF8]/90 backdrop-blur-md border-b border-[#EAEBE8] transition-all">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <Logo href="/" size="md" />

        {/* Center: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-slate-700">
          <Link
            href="#product"
            className="hover:text-emerald-800 transition-colors py-1"
          >
            Product
          </Link>
          <Link
            href="#solutions"
            className="hover:text-emerald-800 transition-colors py-1"
          >
            Solutions
          </Link>
          <Link
            href="/pricing"
            className="hover:text-emerald-800 transition-colors py-1"
          >
            Pricing
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-4">
          {onOpenTestAgent && (
            <button
              type="button"
              onClick={handleTestAgentClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/80 transition cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>Talk to Priya</span>
            </button>
          )}
          <Link
            href="/login"
            className="text-[14px] font-medium text-slate-800 hover:text-emerald-800 transition-colors px-2 py-1"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="btn-emerald-primary text-[13px] px-5 py-2.5 shadow-sm"
          >
            <span>Get started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 transition"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Slide-down Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-6 py-6 space-y-4 shadow-xl">
          <nav className="flex flex-col space-y-3 text-[15px] font-medium text-slate-800">
            <Link
              href="#product"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-emerald-800 transition"
            >
              Product
            </Link>
            <Link
              href="#solutions"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-emerald-800 transition"
            >
              Solutions
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-emerald-800 transition"
            >
              Pricing
            </Link>
          </nav>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
            {onOpenTestAgent && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleTestAgentClick();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 font-semibold text-sm border border-emerald-200 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Test Live Voice Agent</span>
              </button>
            )}
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2 text-sm font-semibold text-slate-700 hover:text-emerald-800 transition"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-emerald-primary w-full text-center text-sm py-2.5"
            >
              <span>Get started</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
