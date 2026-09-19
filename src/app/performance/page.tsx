"use client";

import React from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  PhoneCall,
  Star,
  Activity,
  CheckCircle2,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

export default function PerformancePage() {
  const latencyWaterfall = [
    { step: "1. Vobiz PSTN Telecom Audio Transit", time: "45 ms", percent: 12, color: "bg-blue-500" },
    { step: "2. Deepgram Nova-2 Speech-to-Text (ASR)", time: "88 ms", percent: 24, color: "bg-amber-500" },
    { step: "3. QETADOTIN Brain (Groq Llama-3.3-70B)", time: "112 ms", percent: 31, color: "bg-indigo-600" },
    { step: "4. Cartesia Cloned Neural TTS (8kHz)", time: "78 ms", percent: 22, color: "bg-violet-500" },
    { step: "5. Jitter Buffer & Outbound Handshake", time: "39 ms", percent: 11, color: "bg-emerald-500" },
  ];

  const agentScores = [
    { name: "Harika (Lead Qualification)", csat: "4.8 / 5", calls: "1,240", avgDuration: "2m 14s", conversion: "34%" },
    { name: "Rahul (Customer Support)", csat: "4.7 / 5", calls: "980", avgDuration: "1m 45s", conversion: "28%" },
    { name: "Sneha (Tele-sales & Renewal)", csat: "4.9 / 5", calls: "770", avgDuration: "3m 02s", conversion: "42%" },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Performance"
        subtitle="End-to-end telecom latency telemetry, CSAT satisfaction ratings, and agent conversions"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Top 4 Performance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Median Latency</span>
              <Zap className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">362 ms</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Sub-second real-time conversational</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Overall CSAT</span>
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">4.82 / 5</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">From 2,990 scored calls</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">First-Turn Success</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">99.4%</p>
            <p className="text-xs text-slate-500 mt-1">Zero immediate hang-ups</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Audio Quality</span>
              <Activity className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">4.3 MOS</p>
            <p className="text-xs text-violet-600 mt-1 font-medium">PSTN carrier crystal clarity</p>
          </div>
        </div>

        {/* Latency Waterfall Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Conversational Latency Waterfall</h3>
              <p className="text-xs text-slate-500">Breakdown of speech turnaround time from caller audio to agent response</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              Total: 362 ms
            </span>
          </div>

          <div className="space-y-4">
            {latencyWaterfall.map((item, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{item.step}</span>
                  <span className="font-mono font-bold text-slate-900">{item.time}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className={`${item.color} h-2.5 rounded-full transition-all duration-500`}
                    style={{ width: `${item.percent * 2.5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-center justify-between">
            <span className="font-medium">
              Target Human Response Threshold is &lt; 500 ms. QETADOTIN consistently beats this at 362 ms.
            </span>
            <span className="font-bold text-indigo-700">OPTIMAL</span>
          </div>
        </div>

        {/* Employee Performance Comparison Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Employee Performance Breakdown</h3>
            <p className="text-xs text-slate-500">Satisfaction ratings and conversation success across active voice agents</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Employee Name</th>
                  <th className="px-6 py-3.5">CSAT Score</th>
                  <th className="px-6 py-3.5">Total Calls Dialed</th>
                  <th className="px-6 py-3.5">Avg Duration</th>
                  <th className="px-6 py-3.5 text-right">Conversion Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentScores.map((agent, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-bold text-slate-900 text-sm">{agent.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200 inline-flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500" />
                        {agent.csat}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600">{agent.calls} calls</td>
                    <td className="px-6 py-4 font-mono text-slate-600">{agent.avgDuration}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 text-sm">{agent.conversion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
