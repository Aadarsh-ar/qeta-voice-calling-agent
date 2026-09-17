"use client";

import React, { useState } from "react";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Upload,
  CheckCircle2,
  Clock,
  BarChart3,
  PhoneCall,
  Users,
  Bot,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

interface CampaignItem {
  id: string;
  name: string;
  employee: string;
  totalContacts: number;
  completedCalls: number;
  answerRate: string;
  conversionRate: string;
  status: "RUNNING" | "PAUSED" | "COMPLETED";
  createdAt: string;
}

export default function BulkCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([
    {
      id: "CMP-101",
      name: "Hyderabad Villas - Weekend Site Visit Drive",
      employee: "Priya (Telugu Cloned)",
      totalContacts: 1500,
      completedCalls: 1240,
      answerRate: "79.4%",
      conversionRate: "24.8%",
      status: "RUNNING",
      createdAt: "Today, 10:00 AM",
    },
    {
      id: "CMP-102",
      name: "Q3 SaaS Subscription Renewal Reminder",
      employee: "Sneha (Renewal)",
      totalContacts: 640,
      completedCalls: 640,
      answerRate: "82.1%",
      conversionRate: "41.5%",
      status: "COMPLETED",
      createdAt: "Yesterday",
    },
    {
      id: "CMP-103",
      name: "Unpaid COD Order Verification Blast",
      employee: "Rahul (Support/Sales)",
      totalContacts: 850,
      completedCalls: 310,
      answerRate: "74.0%",
      conversionRate: "68.2%",
      status: "PAUSED",
      createdAt: "Sep 14, 2026",
    },
  ]);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("cmu40722800014r20hvl070n3");
  const [csvFileName, setCsvFileName] = useState("");

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName) return;

    const newCamp: CampaignItem = {
      id: `CMP-${Math.floor(100 + Math.random() * 900)}`,
      name: newCampaignName,
      employee: "Priya (Telugu Cloned)",
      totalContacts: 500,
      completedCalls: 0,
      answerRate: "0.0%",
      conversionRate: "0.0%",
      status: "RUNNING",
      createdAt: "Just now",
    };

    setCampaigns([newCamp, ...campaigns]);
    setIsNewModalOpen(false);
    setNewCampaignName("");
    setCsvFileName("");
  };

  const toggleCampaignStatus = (id: string) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            status: c.status === "RUNNING" ? "PAUSED" : "RUNNING",
          };
        }
        return c;
      })
    );
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Bulk Campaigns"
        subtitle="Orchestrate high-volume outbound voice campaigns powered by autonomous AI employees"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Top Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Total Broadcasts</span>
              <Megaphone className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">2,990</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">+1,240 calls dialed today</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Average Pickup Rate</span>
              <PhoneCall className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">78.5%</p>
            <p className="text-xs text-slate-500 mt-1">Verified PSTN Caller ID (+91)</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Conversion Rate</span>
              <BarChart3 className="w-4 h-4 text-violet-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">32.4%</p>
            <p className="text-xs text-emerald-600 mt-1 font-medium">Qualified / Confirmed appointments</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider">Live Channels</span>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 font-heading">25 / 50</p>
            <p className="text-xs text-indigo-600 mt-1 font-medium">Vobiz SIP Concurrent Trunks</p>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Active Outbound Campaigns</h3>
            <p className="text-xs text-slate-500">Scheduled and executing dialer batches</p>
          </div>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create Bulk Campaign</span>
          </button>
        </div>

        {/* Campaigns List */}
        <div className="space-y-4">
          {campaigns.map((camp) => {
            const progress = Math.round((camp.completedCalls / camp.totalContacts) * 100);

            return (
              <div
                key={camp.id}
                className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs hover:border-slate-300 transition"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-slate-900 text-base">{camp.name}</h4>
                      {camp.status === "RUNNING" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Running
                        </span>
                      )}
                      {camp.status === "PAUSED" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                          Paused
                        </span>
                      )}
                      {camp.status === "COMPLETED" && (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-indigo-600" />
                        {camp.employee}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {camp.createdAt}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {camp.status !== "COMPLETED" && (
                      <button
                        onClick={() => toggleCampaignStatus(camp.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                          camp.status === "RUNNING"
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {camp.status === "RUNNING" ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Resume</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar and metrics */}
                <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  <div className="md:col-span-2">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">
                        Progress: {camp.completedCalls} / {camp.totalContacts} calls
                      </span>
                      <span className="font-bold text-slate-800">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[11px] text-slate-500 font-medium">Answer Rate</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{camp.answerRate}</p>
                  </div>

                  <div className="text-center p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="text-[11px] text-slate-500 font-medium">Conversion Rate</p>
                    <p className="text-sm font-bold text-emerald-600 mt-0.5">{camp.conversionRate}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* New Campaign Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Create Bulk Voice Campaign</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Hyderabad Open House Invite Drive"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Voice Employee</label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  <option value="cmu40722800014r20hvl070n3">Priya — Lead Qualification (Telugu/Tenglish)</option>
                  <option value="cmu40722800024r20hvl070n4">Rahul — Customer Support & Inquiry (English)</option>
                  <option value="cmu40722800034r20hvl070n5">Sneha — Tele-sales & Payment Renewal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Upload Contacts (CSV)</label>
                <div className="p-6 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl text-center cursor-pointer transition">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-700 font-medium">
                    {csvFileName || "Click to upload .csv file with Phone, Name, Context columns"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Accepts up to 10,000 numbers per batch</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCsvFileName(e.target.files[0].name);
                      }
                    }}
                    className="hidden"
                    id="csv-file"
                  />
                  <label
                    htmlFor="csv-file"
                    className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-semibold text-xs cursor-pointer"
                  >
                    Select File
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                >
                  Launch Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
