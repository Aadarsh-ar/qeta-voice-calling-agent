"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  Phone,
  Zap,
  BarChart3,
  Blocks,
  Settings,
  Layers,
  ChevronLeft,
  ChevronRight,
  Radio,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { TestAgentModal } from "@/components/testing/TestAgentModal";

interface NavSection {
  title: string;
  items: {
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const sections: NavSection[] = [
    {
      title: "Workspace",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Voice Agents", href: "/agents", icon: Bot },
        { label: "Call History", href: "/calls", icon: PhoneCall },
        { label: "Templates", href: "/templates", icon: Layers },
      ],
    },
    {
      title: "Telephony",
      items: [
        { label: "Phone Numbers", href: "/phone-numbers", icon: Phone, badge: "+91" },
        { label: "Calling Channels", href: "/calling", icon: Zap },
      ],
    },
    {
      title: "Platform",
      items: [
        { label: "Analytics", href: "/analytics", icon: BarChart3 },
        { label: "Integrations", href: "/integrations", icon: Blocks },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <>
      <aside
        className={`fixed top-0 left-0 z-40 h-screen transition-all duration-300 border-r border-[#EAEBE8] bg-[#FAFAF8] flex flex-col justify-between ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Top Header & Brand */}
        <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#EAEBE8] shrink-0 sticky top-0 bg-[#FAFAF8]/95 backdrop-blur-md z-10">
            {!collapsed && <Logo href="/" size="sm" />}

            {collapsed && (
              <div className="mx-auto">
                <Logo href="/" size="sm" />
              </div>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Grouped Navigation Sections */}
          <div className="p-3 space-y-4">
            {sections.map((sec) => (
              <div key={sec.title} className="space-y-1">
                {!collapsed && (
                  <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                    {sec.title}
                  </div>
                )}
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                        isActive
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-200/80 shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/80 border border-transparent"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? "text-emerald-700 stroke-[2.2]" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      {!collapsed && (
                        <span className="flex-1 flex items-center justify-between">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200">
                              {item.badge}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section: Quick Test & Public Link */}
        <div className="p-3 border-t border-[#EAEBE8] space-y-2 shrink-0 bg-[#FAFAF8]">
          {/* Test Agent in Browser Button */}
          <button
            onClick={() => setIsTestModalOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-900 bg-emerald-100/60 hover:bg-emerald-100 border border-emerald-200/80 transition-all text-left group"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse shrink-0" />
            {!collapsed && <span className="truncate">Test Agent in Browser</span>}
          </button>

          {/* Carrier & Cloned Voice Pill */}
          {!collapsed && (
            <div className="px-3 py-1.5 rounded-xl bg-white border border-[#EAEBE8] text-[10px] flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-1 font-semibold text-slate-700 truncate">
                <Sparkles className="w-3 h-3 text-emerald-600" />
                Cartesia AD Cloned
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                +91 DID Live
              </span>
            </div>
          )}

          {/* Public Home Link */}
          <Link
            href="/"
            className="flex items-center justify-between px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:text-emerald-800 transition"
          >
            {!collapsed && <span>View Marketing Page</span>}
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </aside>

      {/* Interactive Browser Test Modal */}
      <TestAgentModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
      />
    </>
  );
}
