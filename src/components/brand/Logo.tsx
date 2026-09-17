import React from "react";
import Link from "next/link";

interface LogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  hideText?: boolean;
}

export function Logo({
  href = "/",
  size = "md",
  className = "",
  hideText = false,
}: LogoProps) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  const markSize = isSm
    ? "w-6 h-6 rounded-lg p-0.5"
    : isLg
    ? "w-9 h-9 rounded-2xl p-1"
    : "w-7 h-7 rounded-xl p-0.5";

  const textSize = isSm
    ? "text-sm tracking-[0.14em]"
    : isLg
    ? "text-xl tracking-[0.18em]"
    : "text-base tracking-[0.16em]";

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Official QETADOTIN Iconic Logo Mark */}
      <div
        className={`relative ${markSize} bg-black flex items-center justify-center shrink-0 overflow-hidden shadow-sm border border-black/10 transition-transform group-hover:scale-105`}
      >
        <img
          src="/logo-mark.png"
          alt="QETADOTIN Logo"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Brand Wordmark */}
      {!hideText && (
        <span className={`font-heading font-extrabold text-slate-900 uppercase ${textSize}`}>
          QETADOTIN
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
