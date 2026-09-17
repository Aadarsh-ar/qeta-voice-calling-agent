"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, PhoneCall, Radio, Menu } from "lucide-react";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";
import { useLayout } from "@/components/layout/LayoutContext";

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
  const { setIsMobileNavOpen } = useLayout();

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
      <header className="h-16 border-b border-[#EAEBE8] bg-[#FAFAF8]/95 backdrop-blur-md sticky top-0 z-30 px-3 sm:px-6 md:px-8 flex items-center justify-between shadow-xs gap-2">
        {/* Left: Mobile Toggle & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition shrink-0"
            aria-label="Open mobile navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <h1 className="font-heading text-base sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight truncate flex items-center gap-2">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 font-normal truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Pipeline Status Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#EAEBE8] text-[11px] font-semibold text-slate-700 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telephony Active</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-bold">Telugu & English</span>
          </div>

          {children}

          {/* Test Real Phone */}
          <button
            type="button"
            onClick={handleTriggerRealCall}
            className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-full text-xs font-semibold bg-emerald-100/70 hover:bg-emerald-100 text-emerald-900 border border-emerald-300/80 transition shadow-xs active:scale-98"
            title="Make a real phone call via Vobiz"
          >
            <PhoneCall className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="hidden xs:inline sm:inline">Call Phone</span>
          </button>

          {onOpenTestAgent && (
            <button
              type="button"
              onClick={onOpenTestAgent}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition shadow-xs active:scale-98"
            >
              <Radio className="w-3.5 h-3.5 text-indigo-600 animate-pulse shrink-0" />
              <span>TEST</span>
            </button>
          )}

          <Link
            href="/agents/new"
            className="btn-emerald-primary text-xs px-3 sm:px-4 py-2 flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Create Agent</span>
            <span className="sm:hidden">New</span>
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
