"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Megaphone,
  Play,
  Pause,
  Square,
  RotateCcw,
  ArrowLeft,
  PhoneCall,
  Users,
  CheckCircle2,
  Clock,
  BarChart3,
  Bot,
  Search,
  Filter,
  Sparkles,
  PhoneForwarded,
  MessageSquare,
  TrendingUp,
  AlertCircle,
  PhoneOff,
  Calendar,
  X,
  Radio,
  Sliders,
  Check,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Campaign, CampaignContact } from "@/lib/campaigns/types";

export default function CampaignDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const campaignId = resolvedParams.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedContact, setSelectedContact] = useState<CampaignContact | null>(null);

  // Poll campaign state every 1.5 seconds for live progress
  const fetchCampaign = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      const data = await res.json();
      if (data.success && data.campaign) {
        setCampaign(data.campaign);
        // If modal is open, keep selectedContact synced
        if (selectedContact) {
          const updated = data.campaign.contacts.find((c: CampaignContact) => c.id === selectedContact.id);
          if (updated) setSelectedContact(updated);
        }
      }
    } catch (err) {
      console.error("Error fetching campaign:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
    const interval = setInterval(fetchCampaign, 1500);
    return () => clearInterval(interval);
  }, [campaignId]);

  // Campaign control actions (Start, Pause, Resume, Stop)
  const handleControl = async (action: "start" | "pause" | "resume" | "stop") => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCampaign();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error("Control error:", err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
        <Header title="Campaign Dashboard" />
        <div className="p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading campaign telemetry...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
        <Header title="Campaign Not Found" />
        <div className="p-12 text-center max-w-md mx-auto">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Campaign Not Found</h3>
          <p className="text-xs text-slate-500 mt-1">The requested campaign does not exist or has been deleted.</p>
          <Link href="/campaigns" className="btn-emerald-primary text-xs px-4 py-2 mt-4 inline-block">
            Return to Campaigns
          </Link>
        </div>
      </div>
    );
  }

  const metrics = campaign.metrics || {
    total: campaign.contacts.length,
    completed: 0,
    answered: 0,
    noAnswer: 0,
    busy: 0,
    failed: 0,
    interested: 0,
    callbacks: 0,
    inProgress: 0,
  };

  const progressPct =
    metrics.total > 0 ? Math.min(100, Math.round((metrics.completed / metrics.total) * 100)) : 0;

  const inFlightCount = campaign.contacts.filter(
    (c) => c.status === "DIALING" || c.status === "CONNECTED" || c.status === "QUEUED"
  ).length;

  const filteredContacts = campaign.contacts.filter((c) => {
    let matchesStatus = true;
    if (statusFilter === "IN_PROGRESS") {
      matchesStatus = c.status === "DIALING" || c.status === "CONNECTED" || c.status === "QUEUED";
    } else if (statusFilter === "COMPLETED") {
      matchesStatus = c.status === "COMPLETED";
    } else if (statusFilter === "RETRYING") {
      matchesStatus = c.status === "RETRYING";
    } else if (statusFilter === "INTERESTED") {
      matchesStatus = c.outcome === "Interested";
    } else if (statusFilter === "CALLBACK") {
      matchesStatus = c.outcome === "Callback";
    } else if (statusFilter === "FAILED") {
      matchesStatus = c.status === "FAILED" || c.status === "NO_ANSWER" || c.status === "BUSY";
    }

    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phoneNumber.includes(searchQuery) ||
      JSON.stringify(c.customData || {}).toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
      <Header
        title={campaign.name}
        subtitle={`AI Agent: ${campaign.agentName || "Harika"} • ${campaign.concurrency} concurrent channels`}
      >
        <div className="flex items-center gap-2">
          <Link
            href="/campaigns"
            className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">All Campaigns</span>
          </Link>
        </div>
      </Header>

      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Control Bar & Live Pipeline State */}
        <div className="bg-white rounded-3xl border border-[#E8EAE6] p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border flex items-center gap-1.5 ${
                  campaign.status === "RUNNING"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : campaign.status === "PAUSED"
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : campaign.status === "COMPLETED"
                    ? "bg-blue-50 text-blue-800 border-blue-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {campaign.status === "RUNNING" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
                <span>{campaign.status}</span>
              </span>

              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-emerald-700" />
                <span>{campaign.agentName}</span>
              </span>

              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Concurrency: {campaign.concurrency}</span>
              </span>

              {inFlightCount > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <Radio className="w-3 h-3 text-emerald-600" />
                  <span>{inFlightCount} In-Flight Calls</span>
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 pt-1">
              Max Retries: <strong className="text-slate-700">{campaign.maxRetries}</strong> • Retry Delay:{" "}
              <strong className="text-slate-700">{campaign.retryDelaySeconds}s</strong> • Pacing:{" "}
              <strong className="text-slate-700">{campaign.callDelaySeconds}s between calls</strong>
            </p>
          </div>

          {/* Controls Toolbar: Start, Pause, Resume, Stop */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            {campaign.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => handleControl("start")}
                disabled={actionLoading === "start"}
                className="btn-emerald-primary text-xs px-4 py-2.5 flex items-center gap-2 shadow-sm flex-1 sm:flex-initial justify-center"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Campaign</span>
              </button>
            )}

            {campaign.status === "RUNNING" && (
              <>
                <button
                  type="button"
                  onClick={() => handleControl("pause")}
                  disabled={actionLoading === "pause"}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-2 transition shadow-sm flex-1 sm:flex-initial justify-center"
                >
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleControl("stop")}
                  disabled={actionLoading === "stop"}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 transition shadow-sm flex-1 sm:flex-initial justify-center"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Campaign</span>
                </button>
              </>
            )}

            {campaign.status === "PAUSED" && (
              <>
                <button
                  type="button"
                  onClick={() => handleControl("resume")}
                  disabled={actionLoading === "resume"}
                  className="btn-emerald-primary text-xs px-4 py-2.5 flex items-center gap-2 shadow-sm flex-1 sm:flex-initial justify-center"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Resume Campaign</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleControl("stop")}
                  disabled={actionLoading === "stop"}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 transition shadow-sm flex-1 sm:flex-initial justify-center"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {campaign.status === "STOPPED" && (
              <button
                type="button"
                onClick={() => handleControl("resume")}
                disabled={actionLoading === "resume"}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2 transition shadow-sm flex-1 sm:flex-initial justify-center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Resume Remaining Calls</span>
              </button>
            )}

            {campaign.status === "COMPLETED" && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 px-3 py-2 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>All Calls Completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Progress Bar */}
        <div className="bg-white rounded-2xl border border-[#E8EAE6] p-4 sm:p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-700">Campaign Execution Progress</span>
            <span className="text-slate-900 font-bold">
              {metrics.completed} of {metrics.total} processed ({progressPct}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                campaign.status === "RUNNING"
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600"
                  : "bg-slate-500"
              }`}
              style={{ width: `${Math.max(progressPct, 1)}%` }}
            />
          </div>
        </div>

        {/* 8 Metric KPI Cards (as specified: Total, Completed, Answered, No-Answer, Busy, Failed, Interested, Callbacks) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* 1. Total Contacts */}
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-slate-900 mt-1">{metrics.total}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Contacts in list</div>
          </div>

          {/* 2. Completed */}
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed</div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-emerald-800 mt-1">{metrics.completed}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Calls finished</div>
          </div>

          {/* 3. Answered */}
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Answered</div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-blue-700 mt-1">{metrics.answered}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Conversations</div>
          </div>

          {/* 4. No-Answer */}
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">No Answer</div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-amber-700 mt-1">{metrics.noAnswer}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Unanswered</div>
          </div>

          {/* 5. Busy */}
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Busy</div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-purple-700 mt-1">{metrics.busy}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Line engaged</div>
          </div>

          {/* 6. Failed */}
          <div className="bg-white rounded-2xl border border-[#E8EAE6] p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Failed</div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-rose-700 mt-1">{metrics.failed}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Trunk errors</div>
          </div>

          {/* 7. Interested */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              <span>Interested</span>
              <Sparkles className="w-3 h-3 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-emerald-900 mt-1">{metrics.interested}</div>
            <div className="text-[10px] text-emerald-700 mt-0.5">High intent leads</div>
          </div>

          {/* 8. Callbacks */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-3.5 shadow-xs">
            <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
              <span>Callbacks</span>
              <RotateCcw className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-heading text-blue-900 mt-1">{metrics.callbacks}</div>
            <div className="text-[10px] text-blue-700 mt-0.5">Follow-up requested</div>
          </div>
        </div>

        {/* Contacts Table Container */}
        <div className="bg-white rounded-3xl border border-[#E8EAE6] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold font-heading text-slate-900">Campaign Contacts & Live Calls</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time queue execution, call progress, retries, and conversation outcomes.
              </p>
            </div>

            <div className="w-full sm:w-72 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search contact, number, or notes..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {[
              { id: "ALL", label: `All (${campaign.contacts.length})` },
              { id: "IN_PROGRESS", label: `Dialing (${inFlightCount})` },
              { id: "COMPLETED", label: `Completed (${metrics.completed})` },
              { id: "INTERESTED", label: `Interested (${metrics.interested})` },
              { id: "CALLBACK", label: `Callbacks (${metrics.callbacks})` },
              { id: "RETRYING", label: `Retrying` },
              { id: "FAILED", label: `Unreachable / Failed` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition ${
                  statusFilter === tab.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5">Contact Name</th>
                    <th className="py-3 px-3.5">Phone Number</th>
                    <th className="py-3 px-3.5">Language</th>
                    <th className="py-3 px-3.5">Custom Data</th>
                    <th className="py-3 px-3.5">Call Status</th>
                    <th className="py-3 px-3.5">Duration</th>
                    <th className="py-3 px-3.5">Outcome</th>
                    <th className="py-3 px-3.5 text-center">Retries</th>
                    <th className="py-3 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                        No contacts found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => {
                      return (
                        <tr
                          key={contact.id}
                          className="hover:bg-slate-50/70 transition cursor-pointer"
                          onClick={() => setSelectedContact(contact)}
                        >
                          {/* Name */}
                          <td className="py-3 px-3.5 font-bold text-slate-900">
                            {contact.name}
                          </td>

                          {/* Phone */}
                          <td className="py-3 px-3.5 font-mono text-slate-700">
                            {contact.phoneNumber}
                          </td>

                          {/* Language */}
                          <td className="py-3 px-3.5 text-slate-600">
                            {contact.language}
                          </td>

                          {/* Custom Data */}
                          <td className="py-3 px-3.5 text-slate-500 max-w-[200px] truncate">
                            {Object.entries(contact.customData || {})
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" • ") || "—"}
                          </td>

                          {/* Call Status Badge */}
                          <td className="py-3 px-3.5">
                            {contact.status === "CONNECTED" ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full animate-pulse border border-emerald-300">
                                <Radio className="w-3 h-3 text-emerald-700" />
                                <span>Connected</span>
                              </span>
                            ) : contact.status === "DIALING" ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full border border-blue-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                                <span>Dialing</span>
                              </span>
                            ) : contact.status === "RETRYING" ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                                <RotateCcw className="w-3 h-3 text-amber-700 animate-spin" />
                                <span>Retrying</span>
                              </span>
                            ) : contact.status === "COMPLETED" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            ) : contact.status === "NO_ANSWER" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                                <PhoneOff className="w-3 h-3 text-slate-500" />
                                <span>No Answer</span>
                              </span>
                            ) : contact.status === "BUSY" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-200">
                                <span>Busy</span>
                              </span>
                            ) : contact.status === "FAILED" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                                <span>Failed</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                                <span>Queued</span>
                              </span>
                            )}
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-3.5 font-mono text-slate-700">
                            {contact.durationSeconds > 0
                              ? `${Math.floor(contact.durationSeconds / 60)}m ${contact.durationSeconds % 60}s`
                              : "—"}
                          </td>

                          {/* Outcome */}
                          <td className="py-3 px-3.5">
                            {contact.outcome === "Interested" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                <Sparkles className="w-3 h-3 text-emerald-600" />
                                <span>Interested</span>
                              </span>
                            ) : contact.outcome === "Callback" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                                <RotateCcw className="w-3 h-3 text-blue-600" />
                                <span>Callback</span>
                              </span>
                            ) : contact.outcome === "Pending" ? (
                              <span className="text-[11px] text-slate-400 italic">Pending</span>
                            ) : (
                              <span className="text-[11px] text-slate-600">{contact.outcome}</span>
                            )}
                          </td>

                          {/* Retries */}
                          <td className="py-3 px-3.5 text-center font-mono text-xs text-slate-600">
                            {contact.retriesCount} / {contact.maxRetries}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3.5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedContact(contact);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ─── TRANSCRIPT & CALL DETAILS MODAL ─── */}
      {selectedContact && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedContact(null)}
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <PhoneCall className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-heading">
                    {selectedContact.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {selectedContact.phoneNumber} • {selectedContact.language}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedContact(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Call Summary Banner */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-700">AI Call Classification</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedContact.outcome === "Interested"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : selectedContact.outcome === "Callback"
                        ? "bg-blue-100 text-blue-900 border border-blue-300"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    Outcome: {selectedContact.outcome}
                  </span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {selectedContact.summary || "Call initiated through Vobiz telephony trunk."}
                </p>

                {selectedContact.customerIntent && (
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    Customer Intent: <strong className="text-slate-800">{selectedContact.customerIntent}</strong>
                  </div>
                )}
              </div>

              {/* Telephony Metadata */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Call Duration</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedContact.durationSeconds > 0
                      ? `${Math.floor(selectedContact.durationSeconds / 60)}m ${selectedContact.durationSeconds % 60}s`
                      : "—"}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Retries Used</div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {selectedContact.retriesCount} of {selectedContact.maxRetries}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Carrier ID</div>
                  <div className="font-mono text-[10px] text-slate-700 mt-0.5 truncate" title={selectedContact.vobizCallId || "Vobiz PSTN"}>
                    {selectedContact.vobizCallId ? selectedContact.vobizCallId.slice(0, 14) + "..." : "Vobiz PSTN"}
                  </div>
                </div>
              </div>

              {/* Custom Lead Data */}
              {selectedContact.customData && Object.keys(selectedContact.customData).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Custom Contact Attributes</span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(selectedContact.customData).map(([k, v]) => (
                      <span key={k} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                        <strong>{k}:</strong> {String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Turn-by-Turn Conversation Transcript */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Turn-by-Turn Conversation Transcript</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {selectedContact.transcripts?.length || 0} spoken turns
                  </span>
                </div>

                {(!selectedContact.transcripts || selectedContact.transcripts.length === 0) ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                    {selectedContact.status === "DIALING" || selectedContact.status === "QUEUED"
                      ? "Call is currently dialing. Transcripts will stream in real time once answered."
                      : "No audio turns recorded for this attempt."}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedContact.transcripts.map((turn, idx) => (
                      <div
                        key={turn.id || idx}
                        className={`p-3.5 rounded-2xl text-xs space-y-1 ${
                          turn.role === "AI"
                            ? "bg-emerald-50/70 border border-emerald-200 text-emerald-950 ml-4"
                            : "bg-slate-100 border border-slate-200 text-slate-900 mr-4"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[10px] uppercase tracking-wider">
                          <span className={turn.role === "AI" ? "text-emerald-800" : "text-slate-600"}>
                            {turn.role === "AI" ? `${campaign.agentName || "AI Agent"} (Voice)` : `${selectedContact.name} (Caller)`}
                          </span>
                          {turn.time && <span className="text-slate-400 font-normal">{turn.time}</span>}
                        </div>
                        <p className="leading-relaxed text-slate-800">{turn.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedContact(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
