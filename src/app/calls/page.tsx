"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Search,
  Filter,
  Calendar,
  IndianRupee,
  Clock,
  ArrowRight,
  Sparkles,
  Phone,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";
import { dataStore, CallItem } from "@/lib/db/store";

export default function CallsPage() {
  const [calls, setCalls] = useState<CallItem[]>(dataStore.getCalls());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  React.useEffect(() => {
    fetch("/api/calls")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.calls)) {
          setCalls(data.calls);
        }
      })
      .catch((err) => console.error("Error fetching calls:", err));
  }, []);

  const filteredCalls = calls.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesSearch =
      c.callNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.callerNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.agentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Call History"
        subtitle="View and inspect recent telephony calls, durations, transcripts, and cost metrics"
        onOpenRealPhoneCall={() => setIsPhoneModalOpen(true)}
      />

      <div className="p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        {/* Top Action Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#EAEBE8] rounded-full overflow-x-auto w-full md:w-auto shadow-xs">
            {["ALL", "COMPLETED", "IN_PROGRESS", "FAILED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  statusFilter === status
                    ? "bg-emerald-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by phone number, agent, ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-[#EAEBE8] text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 shadow-xs"
              />
            </div>

            <button
              onClick={() => setIsPhoneModalOpen(true)}
              className="btn-emerald-primary text-xs px-5 py-2.5 shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Make a Call</span>
            </button>
          </div>
        </div>

        {/* Calls Table */}
        <div className="ref-card overflow-hidden bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAFAF8] border-b border-[#EAEBE8] text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Call ID</th>
                <th className="px-5 py-3.5">Date & Time</th>
                <th className="px-5 py-3.5">Customer Number</th>
                <th className="px-5 py-3.5">Agent</th>
                <th className="px-5 py-3.5">Duration</th>
                <th className="px-5 py-3.5">Language</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Cost</th>
                <th className="px-5 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCalls.map((call) => (
                <tr key={call.id} className="hover:bg-emerald-50/30 transition">
                  <td className="px-5 py-4 font-mono font-bold text-emerald-800">
                    {call.callNumber}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {new Date(call.startedAt).toLocaleString([], {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-5 py-4 font-mono font-medium text-slate-800 flex items-center gap-1.5">
                    {call.callerNumber}
                    {call.isDemo && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                        DEMO
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-800 font-medium">{call.agentName}</td>
                  <td className="px-5 py-4 font-mono text-slate-600">
                    {Math.floor(call.durationSeconds / 60)}:
                    {String(call.durationSeconds % 60).padStart(2, "0")}
                  </td>
                  <td className="px-5 py-4 text-slate-700">{call.language}</td>
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ● {call.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono font-semibold text-slate-900">
                    ₹{call.estimatedCost.toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/calls/${call.id}`}
                      className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold transition inline-flex items-center gap-1"
                    >
                      View Call <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RealPhoneCallModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
      />
    </div>
  );
}
