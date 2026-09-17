import React from "react";
import Link from "next/link";

interface LogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ href = "/", size = "md", className = "" }: LogoProps) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  const markSize = isSm
    ? "w-6 h-6"
    : isLg
    ? "w-9 h-9"
    : "w-7 h-7";

  const textSize = isSm
    ? "text-sm tracking-[0.14em]"
    : isLg
    ? "text-xl tracking-[0.18em]"
    : "text-base tracking-[0.16em]";

  const content = (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Reference Dual-Pill Angled Icon Mark */}
      <div className={`relative ${markSize} flex items-center justify-center shrink-0`}>
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_2px_8px_rgba(5,150,105,0.25)]"
        >
          {/* Left pill, angled */}
          <rect
            x="7.5"
            y="7"
            width="8"
            height="22"
            rx="4"
            transform="rotate(-28 7.5 7)"
            fill="url(#qeta-grad-1)"
          />
          {/* Right pill, angled */}
          <rect
            x="19"
            y="7"
            width="8"
            height="22"
            rx="4"
            transform="rotate(-28 19 7)"
            fill="url(#qeta-grad-2)"
          />
          <defs>
            <linearGradient id="qeta-grad-1" x1="7.5" y1="7" x2="15.5" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#34D399" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
            <linearGradient id="qeta-grad-2" x1="19" y1="7" x2="27" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#059669" />
              <stop offset="1" stopColor="#064E3B" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Brand Wordmark */}
      <span className={`font-heading font-extrabold text-slate-900 uppercase ${textSize}`}>
        QETADOTIN
      </span>
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
