"use client";

import React, { useState } from "react";
import {
  Settings,
  Building,
  User,
  Shield,
  CreditCard,
  Sliders,
  CheckCircle2,
  Trash2,
  Save,
  AlertTriangle,
  X,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { defaultProviderRates, ProviderRate } from "@/lib/config/pricing";

export default function SettingsPage() {
  const [rates, setRates] = useState<Record<string, ProviderRate>>(defaultProviderRates);
  const [activeTab, setActiveTab] = useState<"organization" | "pricing" | "security">("organization");
  const [companyName, setCompanyName] = useState("QETADOTIN Technologies Inc.");
  const [billingEmail, setBillingEmail] = useState("admin@qeta.in");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDeleteOrgModalOpen, setIsDeleteOrgModalOpen] = useState(false);

  React.useEffect(() => {
    try {
      const savedName = localStorage.getItem("qetadotin_org_name");
      const savedEmail = localStorage.getItem("qetadotin_org_email");
      const savedRates = localStorage.getItem("qetadotin_provider_rates");
      if (savedName) setCompanyName(savedName);
      if (savedEmail) setBillingEmail(savedEmail);
      if (savedRates) setRates(JSON.parse(savedRates));
    } catch {
      // ignore
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRateChange = (key: string, newRate: number) => {
    setRates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        rate: newRate,
      },
    }));
  };

  const handleSaveRates = () => {
    try {
      localStorage.setItem("qetadotin_provider_rates", JSON.stringify(rates));
    } catch {
      // ignore
    }
    showToast("Provider pricing matrix updated and saved!");
  };

  const handleSaveProfile = () => {
    try {
      localStorage.setItem("qetadotin_org_name", companyName);
      localStorage.setItem("qetadotin_org_email", billingEmail);
    } catch {
      // ignore
    }
    showToast("Organization profile changes saved successfully!");
  };

  const handleDeleteOrgConfirm = () => {
    setIsDeleteOrgModalOpen(false);
    showToast("Organization deletion request processed.");
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Settings"
        subtitle="Manage your organization profile, telephony rate matrix, and security policies"
      />

      <div className="p-6 md:p-8 max-w-5xl w-full mx-auto space-y-6">
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            {toastMessage}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="border-b border-[#EAEBE8] flex items-center gap-2">
          {[
            { id: "organization", label: "Organization", icon: Building },
            { id: "pricing", label: "Pricing Rates", icon: Sliders },
            { id: "security", label: "Security", icon: Shield },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
                  isActive
                    ? "border-emerald-700 text-emerald-900 bg-emerald-50/60 rounded-t-xl"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Organization */}
        {activeTab === "organization" && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Organization Profile</h3>
                <p className="text-xs text-slate-500">Manage company information and billing contact.</p>
              </div>
              <button
                onClick={handleSaveProfile}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
              >
                <Save className="w-3.5 h-3.5" /> Save Profile
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Organization Slug</label>
                <input
                  type="text"
                  defaultValue="qetadotin-org"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Billing Email</label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Primary Telephony Region</label>
                <input
                  type="text"
                  defaultValue="India (ap-south-1) • Vobiz Mumbai"
                  disabled
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Provider Pricing Config */}
        {activeTab === "pricing" && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Dynamic Provider Pricing Matrix
                </h3>
                <p className="text-xs text-slate-500">
                  Update unit rates to reflect changing provider contracts or billing changes.
                </p>
              </div>

              <button
                onClick={handleSaveRates}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
              >
                Save Pricing Matrix
              </button>
            </div>

            <div className="space-y-3">
              {Object.entries(rates).map(([key, item]) => (
                <div
                  key={key}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 uppercase text-[11px] tracking-wider text-indigo-700">
                      {item.provider} ({item.unit})
                    </h4>
                    <p className="text-slate-500 text-xs">{item.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">{item.currency}</span>
                    <input
                      type="number"
                      step="0.001"
                      value={item.rate}
                      onChange={(e) => handleRateChange(key, parseFloat(e.target.value) || 0)}
                      className="w-28 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono font-bold text-right focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-slate-400 text-[11px]">/ {item.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Security */}
        {activeTab === "security" && (
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6 text-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">Security & Multi-Tenant Isolation</h3>
              <p className="text-slate-500 leading-relaxed mt-1">
                Every request is scoped to your organization tenant. Provider API keys (Cartesia, Groq, Sarvam, Vobiz) are stored securely on the server and never exposed to the client.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-rose-600 font-bold mb-2">Danger Zone</h4>
              <button
                onClick={() => setIsDeleteOrgModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Delete Organization & Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Organization Modal */}
      {isDeleteOrgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Organization?</h3>
            </div>
            <p className="text-xs text-slate-600">
              This action will permanently delete all agents, call logs, phone numbers, and credentials.
            </p>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsDeleteOrgModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrgConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
