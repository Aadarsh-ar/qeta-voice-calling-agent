"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublicPage =
    pathname === "/" ||
    pathname === "/landing" ||
    pathname === "/pricing" ||
    pathname === "/templates" ||
    pathname === "/login" ||
    pathname === "/signup";

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAF8] text-slate-900 min-h-screen antialiased flex selection:bg-emerald-100 selection:text-emerald-900 w-full">
      <Sidebar />
      <main className="flex-1 ml-20 md:ml-64 min-h-screen flex flex-col transition-all duration-300 w-full bg-[#FAFAF8]">
        {children}
      </main>
    </div>
  );
}
