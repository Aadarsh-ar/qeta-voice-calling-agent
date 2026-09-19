"use client";

import React, { useState } from "react";
import {
  PhoneIncoming,
  Phone,
  ShieldCheck,
  Bot,
  Clock,
  Settings2,
  CheckCircle2,
  Sparkles,
  PhoneForwarded,
  Save,
  Volume2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

export default function InboundCallsPage() {
  const [phoneNumber, setPhoneNumber] = useState("+91 80 7158 2667");
  const [assignedAgent, setAssignedAgent] = useState("cmu40722800014r20hvl070n3");
  const [greetingPrompt, setGreetingPrompt] = useState(
    "నమస్కారం! QETADOTIN కి స్వాగతం. నేను ప్రియ ని, మీకు ఎలా సహాయం చేయగలను? (Welcome to QETADOTIN, how can I assist you today?)"
  );
  const [humanFallbackNumber, setHumanFallbackNumber] = useState("+91 98480 99887");
  const [operatingHours, setOperatingHours] = useState("24_7");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const inboundHistory = [
    {
      id: "INB-301",
      caller: "+91 94401 23456",
      callerLocation: "Hyderabad, Telangana",
      duration: "1m 42s",
      intent: "Inquired about 3BHK pricing and amenities",
      status: "RESOLVED",
      time: "12 mins ago",
    },
    {
      id: "INB-302",
      caller: "+91 98850 78901",
      callerLocation: "Vijayawada, AP",
      duration: "2m 15s",
      intent: "Requested callback from senior manager",
      status: "ESCALATED",
      time: "1 hour ago",
    },
    {
      id: "INB-303",
      caller: "+91 98200 45678",
      callerLocation: "Bengaluru, Karnataka",
      duration: "58s",
      intent: "Office address & directions inquiry",
      status: "RESOLVED",
      time: "3 hours ago",
    },
  ];

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Inbound Calls"
        subtitle="Manage virtual DID phone numbers, inbound IVR routing rules, and AI receptionist greetings"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {/* Top Active DID Status Card */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl border border-indigo-500/20">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <PhoneIncoming className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Inbound Telephony DID
                </span>
                <h3 className="text-2xl font-extrabold font-mono tracking-tight mt-0.5">{phoneNumber}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Carrier: Vobiz Telecom PSTN • Bangalore (080) Local Trunk</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
                Full-Duplex Sub-300ms
              </span>
              <span className="px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold">
                Telugu Cloned Voice
              </span>
            </div>
          </div>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Settings Form */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Inbound Routing Rules</h3>
                  <p className="text-xs text-slate-500">Configure how incoming calls are answered</p>
                </div>
              </div>
              {savedSuccess && (
                <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                  Settings Saved!
                </span>
              )}
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Receptionist Employee
                </label>
                <select
                  value={assignedAgent}
                  onChange={(e) => setAssignedAgent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                >
                  <option value="cmu40722800014r20hvl070n3">Harika — Lead Qualification & Reception (Telugu/Tenglish)</option>
                  <option value="cmu40722800024r20hvl070n4">Rahul — Customer Support & Inquiry (English)</option>
                  <option value="cmu40722800034r20hvl070n5">Sneha — Tele-sales & Payment Renewal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Opening Inbound Greeting (Telugu & English)
                </label>
                <textarea
                  rows={3}
                  value={greetingPrompt}
                  onChange={(e) => setGreetingPrompt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Synthesized immediately when the customer dials your DID phone number.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Operating Hours</label>
                  <select
                    value={operatingHours}
                    onChange={(e) => setOperatingHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  >
                    <option value="24_7">24/7 Always Active (Autonomous)</option>
                    <option value="biz_hours">Standard Business Hours (9 AM - 8 PM IST)</option>
                    <option value="weekdays">Monday - Friday Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Human Fallback Escalation Number
                  </label>
                  <input
                    type="tel"
                    value={humanFallbackNumber}
                    onChange={(e) => setHumanFallbackNumber(e.target.value)}
                    placeholder="+91 98480 12345"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2 mt-4"
              >
                <Save className="w-4 h-4" />
                <span>Save Inbound Telephony Rules</span>
              </button>
            </form>
          </div>

          {/* Quick Info & Telephony Architecture */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
              <h4 className="font-bold text-slate-900 text-sm">How Inbound Calling Works</h4>
              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <p>Customer dials <strong>+91 80 7158 2667</strong> from their mobile or landline.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <p>Vobiz telecom routes the SIP trunk via WebSockets to QETADOTIN within 180ms.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <p>Harika answers in Telugu or English, resolves queries, and captures caller contact details.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    4
                  </div>
                  <p>If requested, call is warm-transferred directly to your human sales desk without disconnect.</p>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>
                Inbound calls are billed at your standard plan rate of 1 minute per conversation minute with zero extra IVR fees.
              </span>
            </div>
          </div>
        </div>

        {/* Inbound Call History */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">Recent Inbound Call Records</h3>
            <span className="text-xs text-slate-500">Live Vobiz Telecom Logs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Caller Number</th>
                  <th className="px-6 py-3.5">Location</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Inquiry Summary</th>
                  <th className="px-6 py-3.5">Outcome</th>
                  <th className="px-6 py-3.5 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inboundHistory.map((call) => (
                  <tr key={call.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{call.caller}</td>
                    <td className="px-6 py-4 text-slate-600">{call.callerLocation}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">{call.duration}</td>
                    <td className="px-6 py-4 text-slate-700 max-w-xs truncate">{call.intent}</td>
                    <td className="px-6 py-4">
                      {call.status === "RESOLVED" && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                          Resolved by AI
                        </span>
                      )}
                      {call.status === "ESCALATED" && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                          Transferred
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-400 font-mono text-[11px]">{call.time}</td>
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
