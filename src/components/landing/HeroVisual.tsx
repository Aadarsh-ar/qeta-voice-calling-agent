"use client";

import React, { useState } from "react";
import { Phone, Radio, Activity } from "lucide-react";

export function HeroVisual() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative w-full max-w-[620px] aspect-square flex items-center justify-center select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Ambient Radial Glow */}
      <div className="absolute inset-0 bg-radial from-emerald-200/40 via-emerald-100/20 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Concentric Orbital Rings */}
      <div className="absolute w-[92%] h-[92%] rounded-full border border-emerald-300/40 pointer-events-none animate-[spin_60s_linear_infinite]" />
      <div className="absolute w-[75%] h-[75%] rounded-full border border-dashed border-emerald-400/35 pointer-events-none animate-[spin_40s_linear_infinite_reverse]" />
      <div className="absolute w-[58%] h-[58%] rounded-full border border-emerald-300/30 pointer-events-none" />

      {/* Orbital Glowing Nodes */}
      <div className="absolute top-[14%] right-[22%] w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10B981] animate-pulse" />
      <div className="absolute bottom-[24%] left-[18%] w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#059669]" />
      <div className="absolute top-[52%] left-[8%] w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_10px_#34D399]" />

      {/* ─── Centerpiece: Emerald 3D Flowing Torus & Soundwave Ribbon (SVG) ─── */}
      <svg
        viewBox="0 0 600 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_20px_45px_rgba(4,120,87,0.18)]"
      >
        <defs>
          {/* Waveform Gradients */}
          <linearGradient id="waveGrad1" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#34D399" stopOpacity="0.1" />
            <stop offset="25%" stopColor="#10B981" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#059669" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#047857" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#34D399" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="torusGradOuter" x1="150" y1="150" x2="450" y2="450" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="25%" stopColor="#10B981" />
            <stop offset="60%" stopColor="#047857" />
            <stop offset="90%" stopColor="#064E3B" />
            <stop offset="100%" stopColor="#022C22" />
          </linearGradient>

          <linearGradient id="torusGradInner" x1="220" y1="200" x2="380" y2="400" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A7F3D0" />
            <stop offset="40%" stopColor="#059669" />
            <stop offset="100%" stopColor="#064E3B" />
          </linearGradient>

          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#D1FAE5" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ECFDF5" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Dynamic Horizontal Soundwave Flow (Multiple undulating paths) */}
        <path
          d="M 20 300 C 120 220, 200 380, 300 300 C 400 220, 480 380, 580 300"
          stroke="url(#waveGrad1)"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          className="transition-transform duration-700 ease-out"
        />
        <path
          d="M 10 290 C 110 200, 190 400, 300 290 C 410 180, 490 390, 590 290"
          stroke="url(#waveGrad1)"
          strokeWidth="2"
          strokeOpacity="0.6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 30 310 C 130 240, 210 360, 300 310 C 390 260, 470 370, 570 310"
          stroke="url(#waveGrad1)"
          strokeWidth="2.2"
          strokeOpacity="0.75"
          fill="none"
          strokeLinecap="round"
        />
        {/* Soft wave ribbon fill underneath */}
        <path
          d="M 20 300 C 120 220, 200 380, 300 300 C 400 220, 480 380, 580 300 L 580 330 C 480 410, 400 250, 300 330 C 200 410, 120 250, 20 330 Z"
          fill="url(#waveGrad1)"
          opacity="0.15"
        />

        {/* Central Core Glow */}
        <circle cx="300" cy="300" r="140" fill="url(#centerGlow)" />

        {/* ─── 3D Metallic Emerald Ring / Torus Form ─── */}
        {/* Outer Ring Shadow / Depth */}
        <circle cx="305" cy="305" r="105" stroke="#022C22" strokeWidth="38" opacity="0.3" fill="none" />

        {/* Main Emerald Torus Ring */}
        <circle
          cx="300"
          cy="300"
          r="105"
          stroke="url(#torusGradOuter)"
          strokeWidth="36"
          fill="none"
          strokeLinecap="round"
        />

        {/* Inner Interlocking Sculptural Ribbon Layer */}
        <path
          d="M 225 240 C 265 190, 340 190, 375 240 C 410 290, 370 360, 310 375 C 250 390, 210 330, 225 270"
          stroke="url(#torusGradInner)"
          strokeWidth="22"
          strokeLinecap="round"
          fill="none"
          className="drop-shadow-[0_4px_12px_rgba(6,78,59,0.35)]"
        />

        {/* Metallic Highlight Arc on Ring */}
        <path
          d="M 230 225 A 105 105 0 0 1 370 225"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeOpacity="0.45"
          strokeLinecap="round"
          fill="none"
        />

        {/* Light Reflection Glint */}
        <ellipse cx="255" cy="220" rx="14" ry="4" transform="rotate(-30 255 220)" fill="#FFFFFF" opacity="0.75" />
      </svg>

      {/* ─── Floating UI Badge #1: AI Speaking (Top-Left of Visual) ─── */}
      <div className="absolute top-[8%] left-[10%] sm:top-[10%] sm:left-[8%] floating-ui-badge animate-float-slow">
        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
          <div className="flex items-center gap-[2px] h-3">
            <span className="w-[2.5px] bg-emerald-600 rounded-full animate-eq-1" />
            <span className="w-[2.5px] bg-emerald-600 rounded-full animate-eq-2" />
            <span className="w-[2.5px] bg-emerald-600 rounded-full animate-eq-3" />
            <span className="w-[2.5px] bg-emerald-600 rounded-full animate-eq-4" />
          </div>
        </div>
        <span className="text-[11px] sm:text-xs font-bold tracking-wider text-slate-800 uppercase">
          AI Speaking...
        </span>
      </div>

      {/* ─── Floating UI Badge #2: Real Time (Top-Right of Visual) ─── */}
      <div className="absolute top-[22%] right-[2%] sm:right-[4%] floating-ui-badge animate-float-delayed">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-ping opacity-75" />
        <span className="text-[11px] sm:text-xs font-bold tracking-wider text-slate-800 uppercase -ml-1">
          Real Time
        </span>
      </div>

      {/* ─── Floating UI Badge #3: Human-like Conversations (Bottom-Right of Visual) ─── */}
      <div className="absolute bottom-[16%] right-[4%] sm:bottom-[18%] sm:right-[6%] floating-ui-badge animate-float-slow">
        <div className="w-7 h-7 rounded-full bg-emerald-100/90 text-emerald-800 flex items-center justify-center shrink-0">
          <Phone className="w-3.5 h-3.5" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] sm:text-[11px] font-bold tracking-wider text-slate-900 uppercase leading-tight">
            Human-like
          </span>
          <span className="text-[9px] sm:text-[10px] font-semibold tracking-wider text-emerald-700 uppercase leading-tight">
            Conversations
          </span>
        </div>
      </div>
    </div>
  );
}
