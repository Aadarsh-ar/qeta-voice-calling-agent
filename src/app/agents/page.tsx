"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Bot,
  Plus,
  Play,
  Copy,
  Trash2,
  ExternalLink,
  Phone,
  PhoneCall,
  Radio,
  Search,
  CheckCircle2,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { TestAgentModal } from "@/components/testing/TestAgentModal";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";
import { dataStore, AgentItem } from "@/lib/db/store";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentItem[]>(dataStore.getAgents());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<{ id: string; name: string } | undefined>();
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [realCallAgentId, setRealCallAgentId] = useState<string | undefined>(undefined);
  const [isRealCallOpen, setIsRealCallOpen] = useState(false);

  // Sync with API on mount
  React.useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.agents)) {
          setAgents(data.agents);
        }
      })
      .catch((err) => console.error("Error fetching agents:", err));
  }, []);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.phoneNumber && a.phoneNumber.includes(searchQuery))
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleStatus = async (agentId: string) => {
    const target = agents.find((a) => a.id === agentId);
    if (!target) return;
    const newStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, status: newStatus as AgentItem["status"] } : a))
    );

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        dataStore.updateAgent(agentId, { status: newStatus as AgentItem["status"] });
        showToast(`Agent "${target.name}" is now ${newStatus === "ACTIVE" ? "Active" : "Paused"}`);
      } else {
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, status: target.status } : a))
        );
        showToast("Error updating status: " + (data.error || "Failed"));
      }
    } catch {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, status: target.status } : a))
      );
      showToast("Network error updating status");
    }
  };

  const handleDuplicate = async (agent: AgentItem) => {
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${agent.name} (Copy)`,
          description: agent.description,
          language: agent.language,
          systemPrompt: agent.systemPrompt,
          businessContext: agent.businessContext,
          cartesiaVoiceId: agent.cartesiaVoiceId,
          cartesiaVoiceName: agent.cartesiaVoiceName,
          phoneNumber: agent.phoneNumber,
          tools: agent.tools,
          businessProfile: agent.businessProfile,
        }),
      });
      const data = await res.json();
      if (data.success && data.agent) {
        setAgents((prev) => [data.agent, ...prev]);
        showToast(`Agent "${data.agent.name}" duplicated successfully!`);
      } else {
        showToast("Failed to duplicate agent");
      }
    } catch {
      showToast("Network error duplicating agent");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;
    const target = agentToDelete;
    setAgents((prev) => prev.filter((a) => a.id !== target.id));
    setAgentToDelete(null);

    try {
      const res = await fetch(`/api/agents/${target.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        dataStore.deleteAgent(target.id);
        showToast(`Agent "${target.name}" deleted.`);
      } else {
        const refresh = await fetch("/api/agents");
        const refData = await refresh.json();
        if (refData.agents) setAgents(refData.agents);
        showToast("Failed to delete agent: " + (data.error || "Server error"));
      }
    } catch {
      showToast("Network error deleting agent");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title="Voice Agents"
        subtitle="Manage, train, and test autonomous conversational voice agents"
        onOpenTestAgent={() => {
          setSelectedAgent(undefined);
          setIsTestModalOpen(true);
        }}
        onOpenRealPhoneCall={() => {
          setRealCallAgentId(undefined);
          setIsRealCallOpen(true);
        }}
      />

      <div className="p-4 sm:p-6 md:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {toastMessage}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agents by name, phone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white border border-[#EAEBE8] text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition shadow-xs"
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => {
                setRealCallAgentId(undefined);
                setIsRealCallOpen(true);
              }}
              className="btn-emerald-secondary text-xs px-4 py-2.5"
            >
              <PhoneCall className="w-3.5 h-3.5 text-emerald-700" />
              <span>Make a Call</span>
            </button>

            <Link
              href="/agents/new"
              className="btn-emerald-primary text-xs px-5 py-2.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Agent</span>
            </Link>
          </div>
        </div>

        {/* Empty State */}
        {filteredAgents.length === 0 && (
          <div className="p-12 text-center rounded-3xl bg-white border border-[#EAEBE8] space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 mx-auto flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="font-heading text-lg font-bold text-slate-900">No agents found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first Telugu AI voice calling agent using your cloned Cartesia voice.
            </p>
            <Link
              href="/agents/new"
              className="btn-emerald-primary text-xs px-5 py-2.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create Agent</span>
            </Link>
          </div>
        )}

        {/* Agents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <div
              key={agent.id}
              className="ref-card p-6 flex flex-col justify-between space-y-5 bg-white"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-slate-900 text-base tracking-tight">{agent.name}</h4>
                      <div
                        className="text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 mt-1 bg-emerald-100 text-emerald-800 border border-emerald-200 w-fit"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active & Ready
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                    {agent.language === "TELUGU_ENGLISH" ? "Telugu + English" : agent.language}
                  </span>
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {agent.description || "Autonomous conversational voice agent for customer operations."}
                </p>

                {/* Metadata tags */}
                <div className="space-y-2 pt-3 border-t border-slate-100 text-[11px]">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Voice Model:</span>
                    <span className="font-semibold text-slate-800">
                      {agent.cartesiaVoiceName || "AD (Cloned Neural)"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Phone Line:</span>
                    <span className="font-mono font-medium text-slate-800 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      {agent.phoneNumber && !agent.phoneNumber.includes("7136") ? agent.phoneNumber : "+91 80 7158 2667"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Performance:</span>
                    <span className="font-semibold text-slate-800">
                      {agent.callsCount} calls · {agent.totalMinutes} mins
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Link
                    href={`/agents/${agent.id}`}
                    className="btn-emerald-primary text-xs px-3.5 py-2 flex-1 text-center"
                  >
                    <span>Configure →</span>
                  </Link>

                  <button
                    onClick={() => {
                      setSelectedAgent({ id: agent.id, name: agent.name });
                      setIsTestModalOpen(true);
                    }}
                    className="btn-emerald-secondary text-xs px-3 py-2"
                    title="Test Agent Voice in Browser"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Test</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(agent)}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
                    title="Duplicate Agent"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setAgentToDelete({ id: agent.id, name: agent.name })}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete &quot;{agentToDelete.name}&quot;?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this agent? It will be removed from your database and Vobiz telephony line.
            </p>
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setAgentToDelete(null)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-sm"
              >
                Yes, Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modals */}
      <TestAgentModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        agentId={selectedAgent?.id}
        agentName={selectedAgent?.name}
      />

      <RealPhoneCallModal
        isOpen={isRealCallOpen}
        onClose={() => setIsRealCallOpen(false)}
        agentId={realCallAgentId}
      />
    </div>
  );
}
