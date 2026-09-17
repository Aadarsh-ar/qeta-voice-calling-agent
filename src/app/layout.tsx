import type { Metadata } from "next";
import "./globals.css";
import { AppLayoutShell } from "@/components/layout/AppLayoutShell";
import { brandConfig } from "@/lib/config/brand";

export const metadata: Metadata = {
  title: `${brandConfig.name} — Autonomous Voice Intelligence & Telephony SaaS`,
  description: "QETADOTIN is a production-ready MVP SaaS for autonomous voice calling agents in Telugu, Tenglish, and English with sub-300ms latency, Cartesia cloned neural voices, and Vobiz PSTN telephony orchestration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppLayoutShell>{children}</AppLayoutShell>
      </body>
    </html>
  );
}
