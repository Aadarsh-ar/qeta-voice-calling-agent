"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Zap,
  CheckCircle2,
  Clock,
  Download,
  IndianRupee,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/Header";

export default function BillingPage() {
  const [minutesUsed, setMinutesUsed] = useState(3840);
  const [totalMinutes, setTotalMinutes] = useState(5000);
  const [rechargeToast, setRechargeToast] = useState<string | null>(null);

  const handleTopup = (mins: number, cost: number) => {
    setTotalMinutes((prev) => prev + mins);
    setRechargeToast(`Successfully topped up ${mins.toLocaleString()} minutes for ₹${cost.toLocaleString()}!`);
    setTimeout(() => setRechargeToast(null), 3500);
  };

  const invoices = [
    {
      id: "INV-2026-089",
      date: "Sep 01, 2026",
      plan: "Growth SaaS Tier (Monthly) + Cloned Voice",
      amount: "₹34,999",
      status: "PAID",
    },
    {
      id: "INV-2026-054",
      date: "Aug 01, 2026",
      plan: "Growth SaaS Tier (Monthly)",
      amount: "₹34,999",
      status: "PAID",
    },
    {
      id: "INV-2026-021",
      date: "Jul 15, 2026",
      plan: "Starter SaaS Tier + 1,000 Min Booster",
      amount: "₹20,999",
      status: "PAID",
    },
  ];

  const percentUsed = Math.round((minutesUsed / totalMinutes) * 100);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen text-slate-900">
      <Header
        title="Billing"
        subtitle="Manage your voice minutes quota, subscription plan, and payment invoices"
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-8">
        {rechargeToast && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {rechargeToast}
            </span>
            <button onClick={() => setRechargeToast(null)} className="text-emerald-600 hover:text-emerald-900">
              ✕
            </button>
          </div>
        )}

        {/* Current Plan Overview Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  Current Subscription
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 font-heading mt-2">
                  Growth Plan
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Includes 3 Dedicated Voice Employees, Cloned Cartesia AD Voice & Vobiz Priority Routing.
                </p>
              </div>

              <div className="text-right">
                <span className="text-2xl font-extrabold text-slate-900 font-heading">₹34,999</span>
                <span className="text-xs text-slate-500 block">/ month</span>
              </div>
            </div>

            {/* Minutes Meter */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  Voice Minutes Used: {minutesUsed.toLocaleString()} / {totalMinutes.toLocaleString()} mins
                </span>
                <span className="font-bold font-mono text-indigo-600">
                  {(totalMinutes - minutesUsed).toLocaleString()} mins remaining
                </span>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${percentUsed}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-400">
                Plan auto-renews on <strong className="text-slate-700">October 15, 2026</strong>. Unused minutes roll over.
              </p>
            </div>
          </div>

          {/* Quick Top-Up Booster */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Quick Minutes Top-Up
                </span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>

              <p className="mt-3 text-xs text-slate-300 leading-relaxed">
                Running low on outbound campaign minutes? Instantly add a booster pack to your balance.
              </p>

              <div className="mt-4 space-y-2.5">
                <button
                  onClick={() => handleTopup(1000, 6000)}
                  className="w-full p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs flex items-center justify-between transition group"
                >
                  <span className="font-semibold text-slate-200">+1,000 Extra Minutes</span>
                  <span className="font-bold text-white group-hover:text-emerald-400 font-mono">₹6,000</span>
                </button>

                <button
                  onClick={() => handleTopup(2500, 14000)}
                  className="w-full p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs flex items-center justify-between transition group"
                >
                  <span className="font-semibold text-slate-200">+2,500 Extra Minutes</span>
                  <span className="font-bold text-white group-hover:text-emerald-400 font-mono">₹14,000</span>
                </button>

                <button
                  onClick={() => handleTopup(5000, 25000)}
                  className="w-full p-3 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-xs flex items-center justify-between transition group"
                >
                  <span className="font-semibold text-indigo-200">+5,000 Bulk Minutes (Best Value)</span>
                  <span className="font-bold text-white group-hover:text-emerald-400 font-mono">₹25,000</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant Wallet Credit</span>
              </span>
              <span>GST 18% Applicable</span>
            </div>
          </div>
        </div>

        {/* Invoices and Payment History */}
        <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Invoices & Receipts</h3>
              <p className="text-xs text-slate-500">Tax invoices for Indian GST filings</p>
            </div>
            <span className="text-xs font-semibold text-slate-600">GSTIN: 36AAECQ1294F1Z8</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3.5">Invoice ID</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5">Amount</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{inv.id}</td>
                    <td className="px-6 py-4 text-slate-600">{inv.date}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{inv.plan}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-900">{inv.amount}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => alert(`Downloading GST tax invoice ${inv.id}...`)}
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                    </td>
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
