"use client";

import React, { useState } from "react";
import {
  Zap,
  PhoneCall,
  User,
  Phone,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Bot,
  Sparkles,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";

interface LeadItem {
  id: string;
  name: string;
  phone: string;
  source: string;
  employee: string;
  status: "QUALIFIED" | "DIALING" | "FOLLOW_UP" | "NO_ANSWER";
  intent: string;
  time: string;
}

export default function InstantLeadsPage() {
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadSource, setLeadSource] = useState("Meta Ads (Facebook/Insta)");
  const [selectedAgent, setSelectedAgent] = useState("cmu40722800014r20hvl070n3");
  const [notes, setNotes] = useState("Interested in 3BHK Gated Villa near Financial District");
  const [isCalling, setIsCalling] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [recentLeads, setRecentLeads] = useState<LeadItem[]>([
    {
      id: "LEAD-901",
      name: "Srinivas Rao",
      phone: "+91 98480 22331",
      source: "Meta Ads (Hyd)",
      employee: "Priya (Telugu Cloned)",
      status: "QUALIFIED",
      intent: "Site Visit Confirmed this Saturday 11 AM",
      time: "2 mins ago",
    },
    {
      id: "LEAD-902",
      name: "Kavitha Reddy",
      phone: "+91 99890 44552",
      source: "Website Form",
      employee: "Priya (Telugu Cloned)",
      status: "FOLLOW_UP",
      intent: "Asked for brochure on WhatsApp first",
      time: "14 mins ago",
    },
    {
      id: "LEAD-903",
      name: "Vikram Malhotra",
      phone: "+91 98112 33445",
      source: "Google Search Ads",
      employee: "Rahul (Support/Sales)",
      status: "QUALIFIED",
      intent: "Ready for pricing quotation discussion",
      time: "28 mins ago",
    },
    {
      id: "LEAD-904",
      name: "Anand Verma",
      phone: "+91 97001 88990",
      source: "IndiaMART",
      employee: "Sneha (Renewal)",
      status: "NO_ANSWER",
      intent: "Auto-retry scheduled in 15 mins",
      time: "45 mins ago",
    },
  ]);

  const handleTriggerCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadPhone) return;

    setIsCalling(true);
    try {
      const formattedPhone = leadPhone.startsWith("+")
        ? leadPhone
        : `+91${leadPhone.replace(/^0+/, "")}`;

      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: formattedPhone,
          agentId: selectedAgent,
          businessContext: `Instant Lead: ${leadName || "Website Buyer"}, Source: ${leadSource}, Notes: ${notes}`,
        }),
      });

      const data = await res.json();

      const newLead: LeadItem = {
        id: `LEAD-${Math.floor(100 + Math.random() * 900)}`,
        name: leadName || "Direct Lead",
        phone: formattedPhone,
        source: leadSource,
        employee: "Priya (Telugu Cloned)",
        status: "DIALING",
        intent: notes || "Initial Inquiry Qualification",
        time: "Just now",
      };

      setRecentLeads([newLead, ...recentLeads]);
      setIsModalOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCalling(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText("https://qeta.in/api/webhooks/leads?key=qeta_live_sec_8921a9f");
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Instant Leads"
        subtitle="Trigger sub-15 second AI voice qualification calls to newly captured inbound leads"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Top Highlight Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Avg Speed to Call</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">12.4s</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">94% calls under 20 seconds</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Connect Rate</span>
              <PhoneCall className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">78.6%</p>
            <p className="text-xs text-indigo-600 mt-1 font-medium">Over Vobiz +91 PSTN DID</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Qualified Leads</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">342</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">+18% this week</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Native Language</span>
              <Sparkles className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">Telugu / Eng</p>
            <p className="text-xs text-violet-600 mt-1 font-medium">Cartesia AD Voice Cloned</p>
          </div>
        </div>

        {/* Two-column layout: Instant Lead Trigger Form + Webhook Integration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Instant Dialer Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Instant Lead Dialer</h3>
                  <p className="text-xs text-slate-500">Dispatch an immediate AI qualification call</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                DID Ready (+91 80 7158 2667)
              </span>
            </div>

            <form onSubmit={handleTriggerCall} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lead Name</label>
                  <input
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="e.g. Ramesh Chandra"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="+91 98480 12345"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lead Source</label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="Meta Ads (Facebook/Insta)">Meta Ads (Facebook/Insta)</option>
                    <option value="Website Form">Website Contact Form</option>
                    <option value="Google Search Ads">Google Search Ads</option>
                    <option value="IndiaMART / TradeIndia">IndiaMART / TradeIndia</option>
                    <option value="Manual Referral">Manual Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assign AI Voice Employee</label>
                  <select
                    value={selectedAgent}
                    onChange={(e) => setSelectedAgent(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="cmu40722800014r20hvl070n3">Priya — Lead Qualification (Telugu/Tenglish)</option>
                    <option value="cmu40722800024r20hvl070n4">Rahul — Customer Support & Inquiry (English)</option>
                    <option value="cmu40722800034r20hvl070n5">Sneha — Tele-sales & Payment Renewal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Context & Objectives</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What is this customer interested in? What questions should the agent ask?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isCalling}
                className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCalling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dialing Lead via Vobiz...</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-4 h-4" />
                    <span>Call Lead Instantly</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Webhook Automation Card */}
          <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-3xl p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  Automated Inbound Webhook
                </span>
                <span className="px-2 py-0.5 rounded-sm bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                  POST /leads
                </span>
              </div>

              <p className="mt-4 text-xs text-slate-300 leading-relaxed">
                Connect Facebook Lead Ads, Zapier, Webflow, or your CRM. Whenever a lead fills out your form, QETADOTIN dials them within seconds.
              </p>

              <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 relative group">
                <p className="text-[11px] text-slate-500 mb-1">Webhook Endpoint:</p>
                <p className="text-indigo-300 truncate">https://qeta.in/api/webhooks/leads</p>
                <button
                  onClick={copyWebhook}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedWebhook ? "Copied!" : "Copy Webhook URL"}</span>
                </button>
              </div>

              <div className="mt-6 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Supported Integrations</h4>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                    Meta Ads
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                    Zapier
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                    IndiaMART
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200">
                    HubSpot
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Automatic SLA: &lt; 15 seconds</span>
              <span className="text-emerald-400 font-medium">99.9% Delivery</span>
            </div>
          </div>
        </div>

        {/* Live Leads Queue Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Inbound Leads Activity</h3>
              <p className="text-xs text-slate-500">Live feed of leads processed by autonomous voice agents</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Direct Phone Test</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Lead Details</th>
                  <th className="px-6 py-3.5">Source</th>
                  <th className="px-6 py-3.5">Assigned Agent</th>
                  <th className="px-6 py-3.5">Outcome / Intent</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm">{lead.name}</p>
                      <p className="font-mono text-slate-500 text-[11px]">{lead.phone}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                        {lead.source}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                        <Bot className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{lead.employee}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{lead.intent}</td>
                    <td className="px-6 py-4">
                      {lead.status === "QUALIFIED" && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                          Qualified
                        </span>
                      )}
                      {lead.status === "FOLLOW_UP" && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                          Follow Up
                        </span>
                      )}
                      {lead.status === "DIALING" && (
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                          Dialing
                        </span>
                      )}
                      {lead.status === "NO_ANSWER" && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                          No Answer
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 font-mono text-[11px]">{lead.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RealPhoneCallModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedAgentId={selectedAgent}
      />
    </div>
  );
}
