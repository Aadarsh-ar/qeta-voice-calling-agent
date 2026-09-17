import React from "react";
import { Zap, Globe, Clock, ShieldCheck } from "lucide-react";

export function HeroValueStrip() {
  const items = [
    {
      icon: Zap,
      label: "REALTIME VOICE",
      sublabel: "<150ms instant streaming",
    },
    {
      icon: Globe,
      label: "MULTI-LANGUAGE",
      sublabel: "Telugu, Tenglish & English",
    },
    {
      icon: Clock,
      label: "24/7 AVAILABILITY",
      sublabel: "Never miss an incoming call",
    },
    {
      icon: ShieldCheck,
      label: "BUILT FOR BUSINESS",
      sublabel: "PSTN Telephony & CRM Tools",
    },
  ];

  return (
    <div className="w-full border-t border-[#EAEBE8] py-8 sm:py-10 bg-[#FAFAF8]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isLast = index === items.length - 1;

            return (
              <div
                key={item.label}
                className={`flex flex-col items-center text-center px-4 ${
                  !isLast ? "md:border-r md:border-[#E5E7EB]" : ""
                }`}
              >
                {/* Circular Icon Container */}
                <div className="w-12 h-12 rounded-full bg-emerald-100/70 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-xs mb-3 transition-transform hover:scale-105 duration-200">
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>

                {/* Primary Metric Label */}
                <span className="text-[11px] sm:text-[12px] font-extrabold tracking-[0.14em] text-slate-900 uppercase">
                  {item.label}
                </span>

                {/* Subtle Sub-label */}
                <span className="text-[11px] font-medium text-slate-500 mt-0.5">
                  {item.sublabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
