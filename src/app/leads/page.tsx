"use client";

import React, { useState } from "react";
import {
  Target,
  Search,
  Filter,
  Download,
  PhoneCall,
  Flame,
  Clock,
  CheckCircle2,
  Calendar,
  Bot,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";

interface QualifiedLead {
  id: string;
  name: string;
  phone: string;
  location: string;
  agent: string;
  intentScore: number;
  sentiment: "HOT" | "WARM" | "NEUTRAL" | "UNQUALIFIED";
  summary: string;
  nextStep: string;
  date: string;
}

export default function LeadsResultsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [callTargetPhone, setCallTargetPhone] = useState("");

  const leads: QualifiedLead[] = [
    {
      id: "L-101",
      name: "Suresh Babu",
      phone: "+91 98480 34567",
      location: "Gachibowli, Hyderabad",
      agent: "Priya (Telugu Cloned)",
      intentScore: 95,
      sentiment: "HOT",
      summary: "Wants 4BHK East facing villa. Budget ₹3.2 Cr approved with HDFC home loan.",
      nextStep: "Site visit booked Saturday 11:30 AM",
      date: "Sep 16, 2026",
    },
    {
      id: "L-102",
      name: "Ananya Rao",
      phone: "+91 99890 12389",
      location: "Madhapur, Hyderabad",
      agent: "Priya (Telugu Cloned)",
      intentScore: 88,
      sentiment: "HOT",
      summary: "Asked for floor plans on WhatsApp. Ready to visit this Sunday.",
      nextStep: "Floor plan PDF sent via WhatsApp",
      date: "Sep 16, 2026",
    },
    {
      id: "L-103",
      name: "Karthik Varma",
      phone: "+91 98221 44556",
      location: "Kukatpally, Hyderabad",
      agent: "Rahul (Support/Sales)",
      intentScore: 72,
      sentiment: "WARM",
      summary: "Checking payment plans and bank EMI offers. Will discuss with family tonight.",
      nextStep: "Follow-up scheduled Thursday 4 PM",
      date: "Sep 15, 2026",
    },
    {
      id: "L-104",
      name: "Lakshmi Narayana",
      phone: "+91 97001 55667",
      location: "Vijayawada, AP",
      agent: "Priya (Telugu Cloned)",
      intentScore: 65,
      sentiment: "WARM",
      summary: "Comparing with another builder in Kollur. Interested in clubhouse amenities.",
      nextStep: "Brochure dispatched",
      date: "Sep 15, 2026",
    },
    {
      id: "L-105",
      name: "Rohan Kapoor",
      phone: "+91 98110 99881",
      location: "Bengaluru, Karnataka",
      agent: "Sneha (Renewal)",
      intentScore: 40,
      sentiment: "NEUTRAL",
      summary: "Inquired about commercial retail shop leasing. Budget lower than available units.",
      nextStep: "Sent to commercial desk",
      date: "Sep 14, 2026",
    },
  ];

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === "ALL" || lead.sentiment === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const handleQuickCall = (phone: string) => {
    setCallTargetPhone(phone);
    setIsPhoneModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Leads & Results"
        subtitle="Review qualified leads, sentiment analysis, and AI conversation outcomes"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Leads Dialed</span>
              <Target className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">1,840</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">+142 new today</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Hot Leads (&gt;80%)</span>
              <Flame className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">412</p>
            <p className="text-xs text-rose-600 mt-1 font-medium">Ready for immediate site visits</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Site Visits Booked</span>
              <Calendar className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">128</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Scheduled for this weekend</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Qualification Rate</span>
              <TrendingUp className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">68.4%</p>
            <p className="text-xs text-violet-600 mt-1 font-medium">Filtered out invalid inquiries</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search leads by name, phone, or intent..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:outline-hidden"
              >
                <option value="ALL">All Sentiments</option>
                <option value="HOT">Hot Leads Only</option>
                <option value="WARM">Warm Leads</option>
                <option value="NEUTRAL">Neutral</option>
              </select>

              <button
                onClick={() => alert("Exporting all qualified leads to CSV...")}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border-t border-slate-100 pt-3">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Lead Contact</th>
                  <th className="py-3 px-4">AI Employee</th>
                  <th className="py-3 px-4">Intent Score</th>
                  <th className="py-3 px-4">Sentiment</th>
                  <th className="py-3 px-4">Conversation Summary</th>
                  <th className="py-3 px-4">Next Step</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition group">
                    <td className="py-4 px-4">
                      <p className="font-bold text-slate-900 text-sm">{lead.name}</p>
                      <p className="font-mono text-slate-500 text-[11px]">{lead.phone}</p>
                      <p className="text-[11px] text-slate-400">{lead.location}</p>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <Bot className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{lead.agent}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-slate-900">{lead.intentScore}%</span>
                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              lead.intentScore > 80
                                ? "bg-rose-500"
                                : lead.intentScore > 60
                                ? "bg-amber-500"
                                : "bg-slate-400"
                            }`}
                            style={{ width: `${lead.intentScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      {lead.sentiment === "HOT" && (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 inline-flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          Hot Lead
                        </span>
                      )}
                      {lead.sentiment === "WARM" && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                          Warm
                        </span>
                      )}
                      {lead.sentiment === "NEUTRAL" && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                          Neutral
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-slate-700 max-w-xs leading-relaxed">{lead.summary}</td>

                    <td className="py-4 px-4 font-medium text-indigo-700">{lead.nextStep}</td>

                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => handleQuickCall(lead.phone)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition"
                      >
                        <PhoneCall className="w-3 h-3" />
                        <span>Call</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RealPhoneCallModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        selectedAgentId="cmu40722800014r20hvl070n3"
      />
    </div>
  );
}
