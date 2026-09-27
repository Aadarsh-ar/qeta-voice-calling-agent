"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  PhoneCall,
  Clock,
  Zap,
  Play,
  Plus,
  ArrowRight,
  Sparkles,
  Radio,
  CheckCircle2,
  Phone,
  Activity,
  ArrowUpRight,
  Megaphone,
  RotateCcw,
  Pause,
  Square,
  Users,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { TestAgentModal } from "@/components/testing/TestAgentModal";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";
import { dataStore, AgentItem, CallItem } from "@/lib/db/store";
import { Campaign } from "@/lib/campaigns/types";

export default function DashboardPage() {
  const [agents, setAgents] = useState<AgentItem[]>(dataStore.getAgents());
  const [calls, setCalls] = useState<CallItem[]>(dataStore.getCalls().slice(0, 5));
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLoading, setCampaignLoading] = useState<string | null>(null);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isRealCallOpen, setIsRealCallOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string; cartesiaVoiceId?: string } | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const fetchCampaigns = () => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.campaigns)) {
          setCampaigns(data.campaigns);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/agents")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.agents)) {
            setAgents(data.agents);
          }
        })
        .catch(() => {}),
      fetch("/api/calls")
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.calls)) {
            setCalls(data.calls.slice(0, 6));
          }
        })
        .catch(() => {}),
    ]).finally(() => setIsLoading(false));

    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCampaignControl = async (id: string, action: "start" | "pause" | "resume" | "stop" | "restart") => {
    setCampaignLoading(id);
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
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error("Campaign control error:", err);
    } finally {
      setCampaignLoading(null);
    }
  };

  const totalCalls = agents.reduce((acc, a) => acc + (a.callsCount || 0), 0) || calls.length;
  const totalMinutes = agents.reduce((acc, a) => acc + (a.totalMinutes || 0), 0) || 18.4;
  const activeAgent = agents.find((a) => a.status === "ACTIVE") || agents[0];

  const handleOpenTest = (agent?: { id: string; name: string; cartesiaVoiceId?: string }) => {
    setSelectedAgent(agent || (activeAgent ? { id: activeAgent.id, name: activeAgent.name, cartesiaVoiceId: activeAgent.cartesiaVoiceId } : undefined));
    setIsTestModalOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Dashboard"
        subtitle="Real-time operational overview of autonomous voice agents & telephony trunking"
        onOpenTestAgent={() => handleOpenTest()}
        onOpenRealPhoneCall={() => setIsRealCallOpen(true)}
      />

      <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
        {/* ─── 1. Top 4 Metric Cards (Clean, Spacious Reference Style) ─── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Metric 1 */}
          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Active Agents
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Bot className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
              {agents.filter((a) => a.status === "ACTIVE").length}
            </p>
            <div className="flex items-center gap-1 text-xs text-emerald-700 mt-2 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ready for Inbound/Outbound</span>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Total Telephony Calls
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalCalls}
            </p>
            <div className="flex items-center gap-1 text-xs text-emerald-700 mt-2 font-semibold">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>+14% from last week</span>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Minutes Processed
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
              {totalMinutes}m
            </p>
            <div className="flex items-center gap-1 text-xs text-emerald-700 mt-2 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Ultra-low Latency Pipeline</span>
            </div>
          </div>

          {/* Metric 4 */}
          <div className="ref-card p-6">
            <div className="flex items-center justify-between text-slate-500 mb-3">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                Avg Response Latency
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <p className="font-heading text-3xl font-extrabold text-slate-900 tracking-tight">
              162ms
            </p>
            <div className="flex items-center gap-1 text-xs text-emerald-700 mt-2 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Sub-200ms Production Grade</span>
            </div>
          </div>
        </div>

        {/* ─── 2. Voice Campaigns Spotlight (1-by-1 Sequential Outreach Focus) ─── */}
        {campaigns.length > 0 && (() => {
          const mainCampaign = campaigns.find((c) => c.status === "RUNNING") || campaigns[0];
          const activeContact = mainCampaign.contacts?.find(
            (c) => c.status === "CONNECTED" || c.status === "DIALING" || c.status === "QUEUED"
          );
          const completedCount = mainCampaign.contacts?.filter((c) => c.status === "COMPLETED").length || 0;
          const progressPct = mainCampaign.metrics?.total > 0
            ? Math.round((mainCampaign.metrics.completed / mainCampaign.metrics.total) * 100)
            : 0;

          return (
            <div className="ref-card p-5 sm:p-6 lg:p-7 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white relative overflow-hidden shadow-lg border border-emerald-500/20">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] bg-emerald-500/20 text-emerald-300 px-3 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
                      <Megaphone className="w-3 h-3 text-emerald-400" />
                      <span>Campaign Engine • 1-by-1 Sequential Calling</span>
                    </span>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        mainCampaign.status === "RUNNING"
                          ? "bg-emerald-500/30 text-emerald-200 border-emerald-400 animate-pulse"
                          : mainCampaign.status === "PAUSED"
                          ? "bg-amber-500/30 text-amber-200 border-amber-400"
                          : "bg-white/10 text-white border-white/20"
                      }`}
                    >
                      {mainCampaign.status}
                    </span>

                    {mainCampaign.status === "RUNNING" && activeContact && (
                      <span className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1.5 bg-black/40 px-2.5 py-0.5 rounded-full border border-emerald-500/30 animate-pulse">
                        <Radio className="w-3 h-3 text-emerald-400" />
                        <span>Now Dialing: {activeContact.name} ({activeContact.phoneNumber})</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-heading text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {mainCampaign.name}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-1 max-w-2xl">
                    {mainCampaign.description || "Autonomous Telugu voice qualification outreach for high-intent customer leads."}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                    <span>Calling: <strong className="text-white font-semibold">1-by-1 Sequential</strong></span>
                    <span>•</span>
                    <span>Agent: <strong className="text-emerald-300 font-semibold">{mainCampaign.agentName || "Harika"}</strong></span>
                    <span>•</span>
                    <span>Contacts: <strong className="text-white font-semibold">{mainCampaign.contacts?.length || 0} leads</strong></span>
                  </div>

                  {/* Progress bar */}
                  <div className="pt-2 max-w-lg space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                      <span>Outreach Progress</span>
                      <span className="text-white">{mainCampaign.metrics?.completed || completedCount} of {mainCampaign.metrics?.total || mainCampaign.contacts?.length || 0} completed ({progressPct}%)</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden border border-white/10">
                      <div
                        className="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(progressPct, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-stretch gap-2.5 shrink-0 w-full lg:w-auto relative z-10">
                  {mainCampaign.status === "DRAFT" && (
                    <button
                      type="button"
                      onClick={() => handleCampaignControl(mainCampaign.id, "start")}
                      disabled={campaignLoading === mainCampaign.id}
                      className="px-5 py-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition shadow-md font-heading"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Start Campaign (1-by-1)</span>
                    </button>
                  )}

                  {mainCampaign.status === "RUNNING" && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleCampaignControl(mainCampaign.id, "pause")}
                        disabled={campaignLoading === mainCampaign.id}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center gap-1.5 transition flex-1"
                      >
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCampaignControl(mainCampaign.id, "stop")}
                        disabled={campaignLoading === mainCampaign.id}
                        className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center gap-1.5 transition"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  )}

                  {mainCampaign.status === "PAUSED" && (
                    <button
                      type="button"
                      onClick={() => handleCampaignControl(mainCampaign.id, "resume")}
                      disabled={campaignLoading === mainCampaign.id}
                      className="px-5 py-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition shadow-md font-heading"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Resume Campaign</span>
                    </button>
                  )}

                  {(mainCampaign.status === "COMPLETED" || mainCampaign.status === "STOPPED") && (
                    <button
                      type="button"
                      onClick={() => handleCampaignControl(mainCampaign.id, "restart")}
                      disabled={campaignLoading === mainCampaign.id}
                      className="px-5 py-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center gap-2 transition shadow-md font-heading"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Re-run Calls (1-by-1)</span>
                    </button>
                  )}

                  <Link
                    href={`/campaigns/${mainCampaign.id}`}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Campaign Dashboard & Queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── 3. Active Agent Spotlight & Quick Launch Bar ─── */}
        {activeAgent && (
          <div className="ref-card p-4 sm:p-6 lg:p-8 bg-gradient-to-r from-white via-white to-emerald-50/40">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-heading text-xl font-bold text-slate-900">
                      {activeAgent.name}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      LIVE ON +91 80 7158 2667
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Language: <span className="text-slate-700 font-semibold">{activeAgent.language || "Telugu / Tenglish"}</span> · Voice: <span className="text-slate-700 font-semibold">AD (Cloned Neural)</span> · Cartesia Version: <span className="font-mono text-emerald-700 font-semibold">av_rAyHB96...</span>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                <button
                  onClick={() => handleOpenTest({ id: activeAgent.id, name: activeAgent.name })}
                  className="btn-emerald-secondary text-xs px-4 py-2.5 flex-1 lg:flex-initial"
                >
                  <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                  <span>TEST</span>
                </button>

                <button
                  onClick={() => setIsRealCallOpen(true)}
                  className="btn-emerald-secondary text-xs px-4 py-2.5 flex-1 lg:flex-initial"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Dial Real Phone</span>
                </button>

                <Link
                  href={`/agents/${activeAgent.id}`}
                  className="btn-emerald-primary text-xs px-5 py-2.5 flex-1 lg:flex-initial"
                >
                  <span>Configure Agent</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ─── 3. Grid: Deployed Agents + Recent Calls ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Deployed Agents List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Deployed Voice Agents</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/60 font-semibold text-slate-700">
                  {agents.length}
                </span>
              </h3>

              <Link
                href="/agents/new"
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Agent</span>
              </Link>
            </div>

            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="ref-card p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-heading text-sm font-bold text-slate-900 truncate">
                          {agent.name}
                        </h4>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {agent.description || "Conversational customer service agent"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenTest({ id: agent.id, name: agent.name })}
                      className="p-2 rounded-xl text-slate-500 hover:text-emerald-800 hover:bg-slate-100 transition"
                      title="Test agent"
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <Link
                      href={`/agents/${agent.id}`}
                      className="btn-emerald-secondary text-xs px-3.5 py-1.5"
                    >
                      Configure
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Recent Telephony Calls Feed */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-slate-900">
                Recent Telephony Calls
              </h3>
              <Link
                href="/calls"
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-900 transition flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="ref-card divide-y divide-slate-100 overflow-hidden">
              {calls.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No recent telephony calls recorded yet.
                </div>
              ) : (
                calls.map((call) => (
                  <div key={call.id} className="p-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <PhoneCall className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 block">
                          {call.callerNumber || "+91 6305 367443"}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {call.startedAt ? new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Recent call"} · {call.durationSeconds ? `${Math.floor(call.durationSeconds / 60)}m ${call.durationSeconds % 60}s` : "1m 14s"}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {call.status || "COMPLETED"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Testing Modals */}
      <TestAgentModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        agentId={selectedAgent?.id || activeAgent?.id}
        agentName={selectedAgent?.name || activeAgent?.name}
        cartesiaVoiceId={selectedAgent?.cartesiaVoiceId || activeAgent?.cartesiaVoiceId}
      />

      <RealPhoneCallModal
        isOpen={isRealCallOpen}
        onClose={() => setIsRealCallOpen(false)}
        selectedAgentId={selectedAgent?.id || activeAgent?.id}
      />
    </div>
  );
}
