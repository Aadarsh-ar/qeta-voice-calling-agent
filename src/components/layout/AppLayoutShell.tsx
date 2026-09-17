"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { LayoutProvider, useLayout } from "@/components/layout/LayoutContext";

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isCollapsed } = useLayout();

  const isPublicPage =
    pathname === "/" ||
    pathname === "/landing" ||
    pathname === "/pricing" ||
    pathname === "/login" ||
    pathname === "/signup";

  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] text-slate-900 flex flex-col selection:bg-emerald-100 selection:text-emerald-900 w-full">
        {children}
      </div>
    );
  }

  return (
    <div className="bg-[#FAFAF8] text-slate-900 min-h-screen antialiased flex selection:bg-emerald-100 selection:text-emerald-900 w-full overflow-x-hidden">
      <Sidebar />
      <main
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 w-full bg-[#FAFAF8] min-w-0 ${
          isCollapsed ? "ml-0 md:ml-20" : "ml-0 md:ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <LayoutProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </LayoutProvider>
  );
}
