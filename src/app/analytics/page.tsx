"use client";

import React from "react";
import {
  PhoneCall,
  Clock,
  IndianRupee,
  TrendingUp,
  Bot,
  Zap,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { dataStore } from "@/lib/db/store";

export default function AnalyticsPage() {
  const agents = dataStore.getAgents();
  const totalCalls = agents.reduce((acc, a) => acc + a.callsCount, 0);
  const totalMinutes = agents.reduce((acc, a) => acc + a.totalMinutes, 0);
  const totalCost = agents.reduce((acc, a) => acc + a.estimatedCost, 0);
  const avgDuration = totalCalls > 0 ? (totalMinutes / totalCalls).toFixed(1) : "0";

  const providerCostBreakdown = [
    { provider: "Vobiz Telephony", percent: 45, cost: totalCost * 0.45, color: "bg-emerald-900" },
    { provider: "Cartesia Voice (TTS)", percent: 25, cost: totalCost * 0.25, color: "bg-emerald-700" },
    { provider: "Sarvam Speech (STT)", percent: 18, cost: totalCost * 0.18, color: "bg-emerald-500" },
    { provider: "Groq Intelligence", percent: 7, cost: totalCost * 0.07, color: "bg-emerald-300" },
    { provider: "Infrastructure", percent: 5, cost: totalCost * 0.05, color: "bg-slate-300" },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Analytics"
        subtitle="Track telephony calls, spoken minutes, and provider cost metrics"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* 4 Clean Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Total Calls
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">{totalCalls}</p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 mt-2 font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>99.4% Connection Rate</span>
            </div>
          </div>

          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Call Minutes
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
              {Number(totalMinutes).toFixed(1)} <span className="text-base font-normal text-slate-500">mins</span>
            </p>
            <p className="text-xs text-slate-500 mt-2 font-medium">Avg: {avgDuration} mins / call</p>
          </div>

          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Total Cost
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <IndianRupee className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              ₹{totalCost.toFixed(2)}
            </p>
            <p className="text-xs text-slate-500 mt-2 font-medium">~₹1.80 / minute average</p>
          </div>

          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Average Latency
              </span>
              <div className="w-8 h-8 rounded-full bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
              162ms
            </p>
            <p className="text-xs text-emerald-700 mt-2 font-semibold">Sub-200ms Cartesia Sonic</p>
          </div>
        </div>

        {/* Provider Cost Distribution */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Cost by Service</h3>
            <span className="text-xs text-slate-500 font-medium">Current Month</span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
            {providerCostBreakdown.map((item) => (
              <div
                key={item.provider}
                style={{ width: `${item.percent}%` }}
                className={`${item.color} transition-all`}
                title={`${item.provider}: ${item.percent}% (₹${item.cost.toFixed(2)})`}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
            {providerCostBreakdown.map((item) => (
              <div
                key={item.provider}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-slate-700 font-medium">{item.provider}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900">₹{item.cost.toFixed(2)}</span>
                  <span className="text-[10px] text-slate-500 block">{item.percent}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Performance Summary */}
        <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">Agent Performance</h3>
          <div className="divide-y divide-slate-100">
            {agents.map((agent) => (
              <div key={agent.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">{agent.name}</span>
                    <span className="text-slate-500 text-[11px] font-mono">{agent.phoneNumber || "No number"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-8 pt-2 sm:pt-0 border-t border-slate-50 sm:border-0 text-left">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Calls</span>
                    <span className="font-bold text-slate-800">{agent.callsCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Minutes</span>
                    <span className="font-bold text-slate-800">{agent.totalMinutes}m</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Cost</span>
                    <span className="font-bold text-slate-900 font-mono">
                      ₹{agent.estimatedCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
