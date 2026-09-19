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
  Settings,
  Layers,
  ChevronLeft,
  ChevronRight,
  Radio,
  ExternalLink,
  Sparkles,
  Megaphone,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { TestAgentModal } from "@/components/testing/TestAgentModal";
import { useLayout } from "@/components/layout/LayoutContext";

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
  const {
    isMobileNavOpen,
    closeMobileNav,
    isCollapsed,
    toggleCollapsed,
  } = useLayout();
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  const sections: NavSection[] = [
    {
      title: "Workspace",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Campaigns", href: "/campaigns", icon: Megaphone, badge: "New" },
        { label: "Voice Agents", href: "/agents", icon: Bot },
        { label: "Call History", href: "/calls", icon: PhoneCall },
        { label: "Templates", href: "/templates", icon: Layers },
      ],
    },
    {
      title: "Telephony",
      items: [
        { label: "Phone Numbers", href: "/phone-numbers", icon: Phone, badge: "+91" },
      ],
    },
    {
      title: "Platform",
      items: [
        { label: "Analytics", href: "/analytics", icon: BarChart3 },
        { label: "Settings", href: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileNavOpen && (
        <div
          onClick={closeMobileNav}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300 animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Aside element */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-[#FAFAF8] border-r border-[#EAEBE8] flex flex-col justify-between transition-all duration-300 ${
          /* Mobile Drawer Positioning */
          isMobileNavOpen
            ? "translate-x-0 w-72 max-w-[85vw] shadow-2xl"
            : "-translate-x-full md:translate-x-0"
        } ${
          /* Desktop Widths */
          isCollapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        {/* Top Header & Brand */}
        <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
          <div className="h-16 flex items-center justify-between px-4 border-b border-[#EAEBE8] shrink-0 sticky top-0 bg-[#FAFAF8]/95 backdrop-blur-md z-10">
            {/* Logo */}
            <div className="flex items-center gap-2">
              {(!isCollapsed || isMobileNavOpen) ? (
                <Logo href="/" size="sm" />
              ) : (
                <div className="mx-auto">
                  <Logo href="/" size="sm" />
                </div>
              )}
            </div>

            {/* Desktop Collapse Toggle */}
            <button
              onClick={toggleCollapsed}
              className="hidden md:flex text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            {/* Mobile Close Button */}
            <button
              onClick={closeMobileNav}
              className="md:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition"
              title="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grouped Navigation Sections */}
          <div className="p-3 space-y-4">
            {sections.map((sec) => (
              <div key={sec.title} className="space-y-1">
                {(!isCollapsed || isMobileNavOpen) && (
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
                      onClick={closeMobileNav}
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
                      {(!isCollapsed || isMobileNavOpen) && (
                        <span className="flex-1 flex items-center justify-between min-w-0">
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100/70 text-emerald-800 border border-emerald-200 shrink-0 ml-1">
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

        {/* Bottom Section: Quick Test */}
        <div className="p-3 border-t border-[#EAEBE8] shrink-0 bg-[#FAFAF8]">
          <button
            onClick={() => {
              closeMobileNav();
              setIsTestModalOpen(true);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-emerald-900 bg-emerald-100/60 hover:bg-emerald-100 border border-emerald-200/80 transition-all text-left group"
          >
            <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse shrink-0" />
            {(!isCollapsed || isMobileNavOpen) && <span className="truncate">Test Agent in Browser</span>}
          </button>
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
