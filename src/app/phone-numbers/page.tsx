"use client";

import React, { useState } from "react";
import {
  Phone,
  Plus,
  Bot,
  CheckCircle2,
  X,
  Trash2,
  Radio,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";
import { dataStore, PhoneNumberItem, AgentItem } from "@/lib/db/store";

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumberItem[]>(dataStore.getPhoneNumbers());
  const [agents, setAgents] = useState<AgentItem[]>(dataStore.getAgents());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingNumber, setIsAddingNumber] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [numberToDelete, setNumberToDelete] = useState<PhoneNumberItem | null>(null);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [numberToAssign, setNumberToAssign] = useState<PhoneNumberItem | null>(null);
  const [newNumberInput, setNewNumberInput] = useState("+91 80 7158 2667");
  const [selectedAgentId, setSelectedAgentId] = useState("agent_telugu_sales");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync phone numbers and agents from API on mount
  React.useEffect(() => {
    fetch("/api/phone-numbers")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.phoneNumbers)) {
          setNumbers(data.phoneNumbers);
        }
      })
      .catch((err) => console.error("Error fetching phone numbers:", err));

    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.agents)) {
          setAgents(data.agents);
          if (data.agents.length > 0) setSelectedAgentId(data.agents[0].id);
        }
      })
      .catch((err) => console.error("Error fetching agents:", err));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleAddNumber = async () => {
    setAddModalError(null);
    if (!newNumberInput.trim() || newNumberInput.length < 10) {
      setAddModalError("Please enter a valid E.164 phone number (e.g. +91 80 7158 2667)");
      return;
    }

    setIsAddingNumber(true);
    try {
      const res = await fetch("/api/phone-numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          e164Number: newNumberInput.trim(),
          assignedAgentId: selectedAgentId,
        }),
      });
      const data = await res.json();
      if (data.success && data.phoneNumber) {
        setNumbers((prev) => [data.phoneNumber, ...prev]);
        setIsAddModalOpen(false);
        setNewNumberInput("+91 ");
        showToast(`Phone number "${data.phoneNumber.e164Number}" connected successfully!`);
      } else {
        setAddModalError(data.error || "Failed to add phone number. Check carrier status.");
      }
    } catch {
      setAddModalError("Network error connecting phone number. Please try again.");
    } finally {
      setIsAddingNumber(false);
    }
  };

  const handleSaveAssignment = async (agentId: string) => {
    if (!numberToAssign) return;
    const targetAgent = agents.find((a) => a.id === agentId);

    // Optimistic update
    setNumbers((prev) =>
      prev.map((n) =>
        n.id === numberToAssign.id
          ? {
              ...n,
              assignedAgentId: agentId,
              assignedAgentName: targetAgent ? targetAgent.name : "Unassigned",
            }
          : n
      )
    );

    try {
      const res = await fetch("/api/phone-numbers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: numberToAssign.id,
          assignedAgentId: agentId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Assigned ${numberToAssign.e164Number} to ${targetAgent?.name || "Unassigned"}`);
      }
    } catch {
      showToast("Error updating assignment");
    } finally {
      setNumberToAssign(null);
    }
  };

  const handleToggleNumberStatus = async (numId: string) => {
    const target = numbers.find((n) => n.id === numId);
    if (!target) return;
    const nextStatus = target.status === "Active" ? ("Inactive" as const) : ("Active" as const);

    setNumbers((prev) =>
      prev.map((n) => (n.id === numId ? { ...n, status: nextStatus } : n))
    );

    try {
      await fetch("/api/phone-numbers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: numId, status: nextStatus }),
      });
      showToast(`${target.e164Number} is now ${nextStatus}`);
    } catch {
      showToast("Error toggling number status");
    }
  };

  const handleDeleteNumber = (numId: string) => {
    const target = numbers.find((n) => n.id === numId);
    if (target) {
      setNumberToDelete(target);
    }
  };

  const handleConfirmDelete = async () => {
    if (!numberToDelete) return;
    const numId = numberToDelete.id;
    const numStr = numberToDelete.e164Number;
    setNumbers((prev) => prev.filter((n) => n.id !== numId));
    setNumberToDelete(null);

    try {
      await fetch(`/api/phone-numbers?id=${numId}`, {
        method: "DELETE",
      });
      showToast(`Phone number ${numStr} released.`);
    } catch {
      showToast("Error releasing phone number");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Phone Numbers"
        subtitle="Manage telephony carrier DIDs and assign them to autonomous voice agents"
        onOpenRealPhoneCall={() => setIsPhoneModalOpen(true)}
      />

      <div className="p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            {toastMessage}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-900 tracking-tight">Connected Telephony Numbers</h3>
            <p className="text-xs text-slate-500">Carrier numbers routed to your live conversational voice agents.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPhoneModalOpen(true)}
              className="btn-emerald-secondary text-xs px-4 py-2.5"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span>Make a Call</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-emerald-primary text-xs px-5 py-2.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Number</span>
            </button>
          </div>
        </div>

        {/* Numbers Table */}
        <div className="ref-card overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[650px]">
              <thead className="bg-[#FAFAF8] border-b border-[#EAEBE8] text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">Provider</th>
                  <th className="px-5 py-3.5">Assigned Agent</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {numbers.map((num) => (
                  <tr key={num.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-indigo-600" />
                      {num.e164Number}
                    </td>
                    <td className="px-5 py-4 text-slate-600 font-medium">{num.provider}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-slate-900 font-semibold">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        {num.assignedAgentName || "Unassigned"}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggleNumberStatus(num.id)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 w-max transition ${
                          num.status === "Active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        }`}
                        title="Click to toggle status"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            num.status === "Active" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {num.status}
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setIsPhoneModalOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition"
                        >
                          Dial (+91)
                        </button>
                        <button
                          onClick={() => setNumberToAssign(num)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition"
                        >
                          Assign Agent
                        </button>
                        <button
                          onClick={() => handleDeleteNumber(num.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
                          title="Release Phone Number"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assign Agent Modal */}
      {numberToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Assign Agent to {numberToAssign.e164Number}
              </h3>
              <button
                onClick={() => setNumberToAssign(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Select which AI voice agent answers inbound calls arriving on this phone line.
            </p>

            <div className="space-y-2 pt-2 text-xs">
              {agents.map((a) => (
                <div
                  key={a.id}
                  onClick={() => handleSaveAssignment(a.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                    numberToAssign.assignedAgentId === a.id
                      ? "bg-indigo-50 border-indigo-500 text-indigo-900 font-semibold"
                      : "bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Bot className="w-4 h-4 text-indigo-600" />
                    <span>{a.name}</span>
                  </div>
                  {numberToAssign.assignedAgentId === a.id && (
                    <span className="text-[10px] text-indigo-700 font-semibold">Active</span>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setNumberToAssign(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Number Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Connect Vobiz Number</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Enter your provisioned Vobiz phone number in E.164 international format.
            </p>

            {addModalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {addModalError}
              </div>
            )}

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Phone Number (E.164)</label>
                <input
                  type="text"
                  value={newNumberInput}
                  onChange={(e) => setNewNumberInput(e.target.value)}
                  placeholder="+91 80 7158 2667"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono focus:bg-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Route to Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.language === "TELUGU_ENGLISH" ? "Telugu + English" : a.language})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNumber}
                disabled={isAddingNumber}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition disabled:opacity-50"
              >
                {isAddingNumber ? "Connecting Number..." : "Connect Number"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {numberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Release Number {numberToDelete.e164Number}?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to release this phone number? Inbound calls will no longer route to your AI voice agents.
            </p>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setNumberToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs transition"
              >
                Yes, Release Number
              </button>
            </div>
          </div>
        </div>
      )}

      <RealPhoneCallModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
      />
    </div>
  );
}
