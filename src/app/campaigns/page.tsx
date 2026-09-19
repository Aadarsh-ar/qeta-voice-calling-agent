"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  BarChart3,
  PhoneCall,
  Users,
  Bot,
  Calendar,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Search,
  Filter,
  Sparkles,
  PhoneForwarded,
  Square,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Campaign } from "@/lib/campaigns/types";

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      if (data.success && Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    const timer = setInterval(fetchCampaigns, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleControl = async (id: string, action: "start" | "pause" | "resume" | "stop", e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActionLoading(`${id}_${action}`);
    try {
      const res = await fetch(`/api/campaigns/${id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCampaigns();
      } else {
        alert(data.error || "Could not perform action");
      }
    } catch (err) {
      console.error("Action error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  // Aggregated platform metrics
  const totalContacts = campaigns.reduce((acc, c) => acc + (c.metrics?.total || 0), 0);
  const totalCompleted = campaigns.reduce((acc, c) => acc + (c.metrics?.completed || 0), 0);
  const totalAnswered = campaigns.reduce((acc, c) => acc + (c.metrics?.answered || 0), 0);
  const totalInterested = campaigns.reduce((acc, c) => acc + (c.metrics?.interested || 0), 0);
  const activeCount = campaigns.filter((c) => c.status === "RUNNING").length;

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.agentName && c.agentName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        title="Voice Campaigns"
        subtitle="Manage autonomous AI phone calling campaigns, bulk outreach queues, and contact outcomes"
      >
        <Link
          href="/campaigns/new"
          className="btn-emerald-primary text-xs px-3.5 sm:px-4 py-2 flex items-center gap-1.5 shadow-xs transition transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Campaign</span>
        </Link>
      </Header>

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Campaigns</span>
              <Megaphone className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">{campaigns.length}</span>
              {activeCount > 0 && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {activeCount} Running
                </span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Contacts</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">{totalContacts.toLocaleString()}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Across all campaigns</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calls Completed</span>
              <PhoneCall className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-heading text-emerald-800">{totalCompleted.toLocaleString()}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {totalContacts > 0 ? `${Math.round((totalCompleted / totalContacts) * 100)}% overall completion` : "No calls yet"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Answer Rate</span>
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-heading text-slate-900">
                {totalCompleted > 0 ? `${Math.round((totalAnswered / totalCompleted) * 100)}%` : "0%"}
              </span>
              <p className="text-[11px] text-slate-500 mt-0.5">{totalAnswered} answered calls</p>
            </div>
          </div>

          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white rounded-2xl p-4 shadow-md">
            <div className="flex items-center justify-between text-emerald-200">
              <span className="text-xs font-semibold uppercase tracking-wider">Interested Leads</span>
              <Sparkles className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="mt-2">
              <span className="text-2xl sm:text-3xl font-bold font-heading text-white">{totalInterested}</span>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">Positive conversions</p>
            </div>
          </div>
        </div>

        {/* Search, Filter & Quick Action Bar */}
        <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns, agents, or descriptions..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {["ALL", "RUNNING", "PAUSED", "COMPLETED", "DRAFT"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  statusFilter === status
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {status === "ALL" ? "All Campaigns" : status}
              </button>
            ))}
          </div>
        </div>

        {/* Campaigns List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading campaigns & telemetry...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E8EAE6] p-12 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
              <Megaphone className="w-7 h-7 text-emerald-700" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-heading">No campaigns found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "No campaigns matched your search filter. Try clearing your query."
                : "Create your first bulk voice calling campaign to start qualifying leads and reaching customers."}
            </p>
            <div className="mt-6">
              <Link
                href="/campaigns/new"
                className="btn-emerald-primary text-xs px-4 py-2.5 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Campaign</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredCampaigns.map((camp) => {
              const progressPct =
                camp.metrics?.total > 0
                  ? Math.round((camp.metrics.completed / camp.metrics.total) * 100)
                  : 0;

              return (
                <Link
                  key={camp.id}
                  href={`/campaigns/${camp.id}`}
                  className="bg-white rounded-2xl border border-[#E8EAE6] hover:border-emerald-500/50 hover:shadow-md transition p-5 sm:p-6 block relative group"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Campaign info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            camp.status === "RUNNING"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : camp.status === "PAUSED"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : camp.status === "COMPLETED"
                              ? "bg-blue-50 text-blue-800 border-blue-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {camp.status === "RUNNING" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          )}
                          {camp.status}
                        </span>

                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Bot className="w-3 h-3 text-slate-500" />
                          {camp.agentName || "AI Voice Agent"}
                        </span>

                        <span className="text-[11px] text-slate-400 font-mono">
                          {camp.id}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900 font-heading group-hover:text-emerald-800 transition truncate">
                        {camp.name}
                      </h3>

                      {camp.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          {camp.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                        <span>Concurrency: <strong className="text-slate-700">{camp.concurrency} calls</strong></span>
                        <span>•</span>
                        <span>Max Retries: <strong className="text-slate-700">{camp.maxRetries}</strong></span>
                        <span>•</span>
                        <span>Language: <strong className="text-slate-700">{camp.agentLanguage || "Telugu"}</strong></span>
                      </div>
                    </div>

                    {/* Middle: Progress & Stats */}
                    <div className="lg:w-72 shrink-0 space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-600">Progress</span>
                        <span className="text-slate-900">
                          {camp.metrics?.completed || 0} / {camp.metrics?.total || 0} ({progressPct}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            camp.status === "RUNNING"
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                              : "bg-slate-400"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(progressPct, 0))}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-1 text-center pt-1">
                        <div>
                          <div className="text-[10px] text-slate-400">Answered</div>
                          <div className="text-xs font-bold text-slate-800">{camp.metrics?.answered || 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Interested</div>
                          <div className="text-xs font-bold text-emerald-700">{camp.metrics?.interested || 0}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">Callbacks</div>
                          <div className="text-xs font-bold text-blue-700">{camp.metrics?.callbacks || 0}</div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Controls & CTA */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                      {camp.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={(e) => handleControl(camp.id, "start", e)}
                          disabled={actionLoading === `${camp.id}_start`}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 transition shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start</span>
                        </button>
                      )}

                      {camp.status === "RUNNING" && (
                        <button
                          type="button"
                          onClick={(e) => handleControl(camp.id, "pause", e)}
                          disabled={actionLoading === `${camp.id}_pause`}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 transition shadow-xs"
                        >
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          <span>Pause</span>
                        </button>
                      )}

                      {camp.status === "PAUSED" && (
                        <button
                          type="button"
                          onClick={(e) => handleControl(camp.id, "resume", e)}
                          disabled={actionLoading === `${camp.id}_resume`}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5 transition shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume</span>
                        </button>
                      )}

                      {camp.status === "RUNNING" && (
                        <button
                          type="button"
                          onClick={(e) => handleControl(camp.id, "stop", e)}
                          disabled={actionLoading === `${camp.id}_stop`}
                          className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                          title="Stop Campaign"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                        </button>
                      )}

                      <div className="flex items-center text-xs font-semibold text-emerald-700 group-hover:translate-x-0.5 transition px-2">
                        <span>Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
