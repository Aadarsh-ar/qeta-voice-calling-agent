"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, PhoneCall, Radio, Sparkles } from "lucide-react";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onOpenTestAgent?: () => void;
  onOpenRealCall?: () => void;
  onOpenRealPhoneCall?: () => void;
  children?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  onOpenTestAgent,
  onOpenRealCall,
  onOpenRealPhoneCall,
  children,
}: HeaderProps) {
  const [isRealCallModalOpen, setIsRealCallModalOpen] = useState(false);

  const handleTriggerRealCall = () => {
    const trigger = onOpenRealCall || onOpenRealPhoneCall;
    if (trigger) {
      trigger();
    } else {
      setIsRealCallModalOpen(true);
    }
  };

  return (
    <>
      <header className="h-16 border-b border-[#EAEBE8] bg-[#FAFAF8]/95 backdrop-blur-md sticky top-0 z-30 px-6 md:px-8 flex items-center justify-between shadow-xs">
        <div>
          <h1 className="font-heading text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            {title}
          </h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-normal">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-3">
          {/* Live Pipeline Status Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#EAEBE8] text-[11px] font-semibold text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telephony Active</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-bold">Telugu & English</span>
          </div>

          {children}

          {/* Test Real Phone */}
          <button
            onClick={handleTriggerRealCall}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-emerald-100/70 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/80 transition shadow-xs active:scale-98"
            title="Make a real phone call via Vobiz"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
            <span>Call Phone</span>
          </button>

          {onOpenTestAgent && (
            <button
              onClick={onOpenTestAgent}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 transition shadow-xs active:scale-98"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              <span>Test in Browser</span>
            </button>
          )}

          <Link
            href="/agents/new"
            className="btn-emerald-primary text-xs px-4 py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Agent</span>
          </Link>
        </div>
      </header>

      <RealPhoneCallModal
        isOpen={isRealCallModalOpen}
        onClose={() => setIsRealCallModalOpen(false)}
      />
    </>
  );
}
