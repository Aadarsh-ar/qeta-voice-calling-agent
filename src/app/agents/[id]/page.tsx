"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Play,
  Languages,
  Mic2,
  FileText,
  Building2,
  Phone,
  Wrench,
  Clock,
  IndianRupee,
  PhoneCall,
  Save,
  CheckCircle2,
  Trash2,
  Copy,
  Rocket,
  Pause,
  AlertTriangle,
  X,
  Plus,
  Volume2,
  Sparkles,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { TestAgentModal } from "@/components/testing/TestAgentModal";
import { RealPhoneCallModal } from "@/components/calling/RealPhoneCallModal";
import { AgentItem, dataStore } from "@/lib/db/store";
import { AgentStatus, AgentLanguage } from "@/lib/types/models";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);
  const agentId = resolvedParams.id;

  const [agent, setAgent] = useState<AgentItem | undefined>(dataStore.getAgent(agentId));
  const [isLoading, setIsLoading] = useState(!agent);
  const [activeTab, setActiveTab] = useState<
    "overview" | "instructions" | "voice" | "knowledge" | "tools" | "phone" | "activity"
  >("overview");
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isRealCallOpen, setIsRealCallOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Form state
  const [name, setName] = useState(agent?.name || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.systemPrompt || "");
  const [businessContext, setBusinessContext] = useState(agent?.businessContext || "");
  const [selectedPhone, setSelectedPhone] = useState(agent?.phoneNumber || "+91 80 7158 2667");
  const [tools, setTools] = useState(agent?.tools || []);
  const [cartesiaAgentId, setCartesiaAgentId] = useState(
    agent?.cartesiaAgentId || (agent?.id?.startsWith("agent_") ? agent.id : "agent_GaiYMgB9Bj9kaKW1tUgqSQ")
  );
  const [language, setLanguage] = useState<AgentLanguage>(
    (agent?.language as AgentLanguage) || AgentLanguage.TELUGU_ENGLISH
  );
  const [cartesiaVoiceId, setCartesiaVoiceId] = useState(
    agent?.cartesiaVoiceId || "f9945b75-0f3b-448d-ba9e-3d22c229a68e"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<"idle" | "saving" | "syncing" | "ready" | "error">("idle");
  const [syncStatus, setSyncStatus] = useState<{
    synced: boolean;
    cartesiaVersionId?: string;
    lastSyncedAt?: string;
    error?: string;
  } | null>(null);
  const defaultTrainingExamples = [
    {
      question: "నా ఆర్డర్ ఇంకా రాలేదు, ఎప్పుడు వస్తుంది?",
      replay: "అర్థమైంది అండి! మీ ఆర్డర్ డెలివరీ స్టేటస్ వెంటనే చూస్తాను. మీ ఆర్డర్ ఐడీ లేదా రిజిస్టర్డ్ మొబైల్ నంబర్ చెప్పగలరా?",
    },
    {
      question: "నా దగ్గర ఆర్డర్ నంబర్ లేదు, మీరే చెప్పండి",
      replay: "ఖచ్చితంగా అండి! మీ పూర్తి పేరు లేదా ఏ ఐటమ్ ఆర్డర్ చేశారో చెబితే నేను సిస్టమ్‌లో వెతికి వివరాలు చెబుతాను.",
    },
    {
      question: "నాకు డెమో కావాలి లేదా మాట్లాడాలి",
      replay: "చాలా సంతోషం అండి! రేపు ఉదయం 10:30 కి లేదా సాయంత్రం 4 గంటలకు మీకు ఏ సమయం అనుకూలంగా ఉంటుంది?",
    },
    {
      question: "నాకు రీఫండ్ ఎప్పుడు వస్తుంది?",
      replay: "రీఫండ్ ప్రాసెస్ 5 నుండి 7 పని దినాలలో మీ ఖాతాకు జమ అవుతుంది అండి. మీ ఆర్డర్ నంబర్ ధృవీకరించగలరా?",
    },
    {
      question: "మీ ధర ఎంత ఉంటుంది?",
      replay: "మా స్టార్టర్ ప్యాకేజ్ నెలకు ₹15,000 మాత్రమే అండి, ఇందులో 2,000 కాలింగ్ నిమిషాలు ఉంటాయి.",
    },
  ];

  const defaultPolicies = {
    refundPolicy: "రీఫండ్లు ఆర్డర్ డెలివరీ అయిన 7 రోజులలోపు మాత్రమే వర్తిస్తాయి. ఉత్పత్తి అసలైన స్థితిలో ఉండాలి.",
    cancellationPolicy: "ఆర్డర్ షిప్పింగ్ కావడానికి ముందే కాల్ చేసి ఉచితంగా రద్దు చేసుకోవచ్చు.",
    deliveryPolicy: "ఆర్డర్లు ఆర్డర్ చేసిన 2 నుండి 4 పని దినాలలో డెలివరీ చేయబడతాయి.",
    warrantyPolicy: "అన్ని హార్డ్‌వేర్ పరికరాలకు 1 సంవత్సరం రీప్లేస్‌మెంట్ వారంటీ ఉంటుంది.",
  };

  const [businessProfile, setBusinessProfile] = useState(
    agent?.businessProfile || {
      businessName: "Vaani Enterprises",
      description: "AI Voice Automation Platform for Regional Languages.",
      productsServices: "Telugu AI calling agents, automated lead qualification, customer service bots.",
      workingHours: "ఉదయం 9:00 AM నుండి సాయంత్రం 7:00 PM వరకు",
      location: "Hitec City, Hyderabad",
      contactInfo: "contact@vaani.ai, +91 80 7158 2667",
      faqs: [
        {
          question: "మీ ధర ఎంత ఉంటుంది?",
          answer: "మా స్టార్టర్ ప్యాకేజ్ నెలకు ₹15,000 మాత్రమే, ఇందులో 2,000 కాలింగ్ నిమిషాలు ఉంటాయి.",
        },
      ],
    }
  );

  const [trainingExamples, setTrainingExamples] = useState<{ question: string; replay: string }[]>(
    agent?.businessProfile?.trainingExamples || defaultTrainingExamples
  );

  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(
    agent?.businessProfile?.faqs || [
      {
        question: "మీ ధర ఎంత ఉంటుంది?",
        answer: "మా స్టార్టర్ ప్యాకేజ్ నెలకు ₹15,000 మాత్రమే, ఇందులో 2,000 కాలింగ్ నిమిషాలు ఉంటాయి.",
      },
    ]
  );

  const [policies, setPolicies] = useState(
    (agent?.businessProfile as any)?.policies || defaultPolicies
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    // 1. Initial check from local store
    const local = dataStore.getAgent(agentId);
    if (local) {
      setAgent(local);
      setName(local.name);
      setDescription(local.description);
      setSystemPrompt(local.systemPrompt);
      setBusinessContext(local.businessContext || "");
      setSelectedPhone(local.phoneNumber || "+91 80 7158 2667");
      setTools(local.tools);
      if (local.cartesiaAgentId) setCartesiaAgentId(local.cartesiaAgentId);
      if (local.language) setLanguage(local.language as AgentLanguage);
      if (local.cartesiaVoiceId) setCartesiaVoiceId(local.cartesiaVoiceId);
      if (local.businessProfile) {
        setBusinessProfile(local.businessProfile);
        if (local.businessProfile.trainingExamples?.length) {
          setTrainingExamples(local.businessProfile.trainingExamples);
        }
        if (local.businessProfile.faqs?.length) {
          setFaqs(local.businessProfile.faqs);
        }
        if ((local.businessProfile as any).policies) {
          setPolicies((local.businessProfile as any).policies);
        }
      }
    }

    // 2. Fetch from backend API to ensure fresh data from Neon DB
    fetch(`/api/agents/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.agent) {
          setAgent(data.agent);
          setName(data.agent.name);
          setDescription(data.agent.description || "");
          setSystemPrompt(data.agent.systemPrompt);
          setBusinessContext(data.agent.businessContext || "");
          setSelectedPhone(data.agent.phoneNumber || "+91 80 7158 2667");
          setTools(data.agent.tools || []);
          if (data.agent.cartesiaAgentId) setCartesiaAgentId(data.agent.cartesiaAgentId);
          if (data.agent.language) setLanguage(data.agent.language as AgentLanguage);
          if (data.agent.cartesiaVoiceId) setCartesiaVoiceId(data.agent.cartesiaVoiceId);
          if (data.agent.businessProfile) {
            setBusinessProfile(data.agent.businessProfile);
            if (data.agent.businessProfile.trainingExamples?.length) {
              setTrainingExamples(data.agent.businessProfile.trainingExamples);
            }
            if (data.agent.businessProfile.faqs?.length) {
              setFaqs(data.agent.businessProfile.faqs);
            }
            if (data.agent.businessProfile.policies) {
              setPolicies(data.agent.businessProfile.policies);
            }
          }
        }
      })
      .catch((err) => console.error("Error fetching agent detail:", err))
      .finally(() => setIsLoading(false));
  }, [agentId]);

  if (isLoading && !agent) {
    return (
      <div className="p-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400 font-medium">Loading agent configuration...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center">
          <Bot className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Agent not found</h2>
        <p className="text-xs text-slate-400">The agent may have been deleted or does not exist.</p>
        <Link
          href="/agents"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Agents
        </Link>
      </div>
    );
  }

  // Action: Save Changes & Training Data with Official Cartesia Synchronization
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveStep("saving");
    setSyncStatus(null);
    try {
      const updatedProfile = {
        ...businessProfile,
        faqs,
        policies,
        trainingExamples,
      };

      // Transition to syncing with Cartesia
      setTimeout(() => {
        setSaveStep((current) => (current === "saving" ? "syncing" : current));
      }, 250);

      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          systemPrompt,
          businessContext,
          language,
          cartesiaVoiceId,
          cartesiaAgentId,
          phoneNumber: selectedPhone,
          tools,
          businessProfile: updatedProfile,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.synced) {
        dataStore.updateAgent(agent.id, {
          name,
          description,
          systemPrompt,
          businessContext,
          language,
          cartesiaVoiceId,
          cartesiaAgentId: data.cartesiaAgentId || cartesiaAgentId,
          phoneNumber: selectedPhone,
          tools,
          businessProfile: updatedProfile,
        });
        setBusinessProfile(updatedProfile);
        setAgent((prev) =>
          prev
            ? {
                ...prev,
                name,
                description,
                systemPrompt,
                businessContext,
                language,
                cartesiaVoiceId,
                cartesiaAgentId: data.cartesiaAgentId || cartesiaAgentId,
                phoneNumber: selectedPhone,
                tools,
                businessProfile: updatedProfile,
              }
            : undefined
        );
        setSyncStatus({
          synced: true,
          cartesiaVersionId: data.cartesiaVersionId,
          lastSyncedAt: new Date().toLocaleTimeString(),
        });
        setSaveStep("ready");
        showToast(`Ready • Synchronized with Cartesia! (Version: ${data.cartesiaVersionId || "Active"})`);
        setTimeout(() => setSaveStep("idle"), 3500);
      } else {
        const errorMsg = data.error || "Cartesia synchronization rejected configuration.";
        setSaveStep("error");
        setSyncStatus({
          synced: false,
          error: `Could not sync agent with Cartesia: ${errorMsg}`,
        });
        showToast(`Could not sync agent with Cartesia: ${errorMsg}`);
        setTimeout(() => setSaveStep("idle"), 4500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error during Cartesia sync";
      setSaveStep("error");
      setSyncStatus({
        synced: false,
        error: `Could not sync agent with Cartesia: ${msg}`,
      });
      showToast(`Could not sync agent with Cartesia: ${msg}`);
      setTimeout(() => setSaveStep("idle"), 4500);
    } finally {
      setIsSaving(false);
    }
  };

  // Helper handlers for Few-Shot Training Studio
  const handleAddTrainingExample = () => {
    setTrainingExamples((prev) => [
      ...prev,
      {
        question: "కస్టమర్ అడిగే ప్రశ్న...",
        replay: "ఖచ్చితంగా అండి! నేను మీకు ఎలా సహాయపడగలను?",
      },
    ]);
  };

  const handleUpdateTrainingExample = (index: number, field: "question" | "replay", val: string) => {
    setTrainingExamples((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleDeleteTrainingExample = (index: number) => {
    setTrainingExamples((prev) => prev.filter((_, i) => i !== index));
  };

  // Helper handlers for FAQs
  const handleAddFAQ = () => {
    setFaqs((prev) => [...prev, { question: "కొత్త ప్రశ్న...", answer: "సమాధానం..." }]);
  };

  const handleUpdateFAQ = (index: number, field: "question" | "answer", val: string) => {
    setFaqs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleDeleteFAQ = (index: number) => {
    setFaqs((prev) => prev.filter((_, i) => i !== index));
  };

  // Action: Deploy / Pause Agent — Section 18: Never show Deployed until actual deployment succeeds
  const handleToggleDeploy = async () => {
    setIsDeploying(true);
    const newStatus = agent.status === AgentStatus.ACTIVE ? AgentStatus.INACTIVE : AgentStatus.ACTIVE;

    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, phoneNumber: selectedPhone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        dataStore.updateAgent(agent.id, { status: newStatus });
        setAgent((prev) => (prev ? { ...prev, status: newStatus } : undefined));
        showToast(
          newStatus === AgentStatus.ACTIVE
            ? `🚀 Agent "${agent.name}" is now DEPLOYED and ACTIVE on ${selectedPhone}!`
            : `⏸ Agent "${agent.name}" has been PAUSED.`
        );
      } else {
        showToast("Failed to update deployment: " + (data.error || "Error"));
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Network error";
      showToast("Could not deploy agent: " + errorMsg);
    } finally {
      setIsDeploying(false);
    }
  };

  // Render unified save button with Section 18 progression: Saving... -> Syncing with Cartesia... -> Ready
  const renderSaveButton = (label: string = "Save Changes") => (
    <button
      onClick={handleSaveAll}
      disabled={isSaving}
      className={`btn-emerald-primary text-xs px-4 py-2 transition ${
        saveStep === "error"
          ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
          : "disabled:opacity-50"
      }`}
    >
      {saveStep === "saving" ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Saving...
        </>
      ) : saveStep === "syncing" ? (
        <>
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Syncing with Cartesia...
        </>
      ) : saveStep === "ready" ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Ready
        </>
      ) : (
        <>
          <Save className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </button>
  );

  // Action: Duplicate Agent
  const handleDuplicate = async () => {
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
        showToast(`Agent duplicated as "${data.agent.name}"!`);
        router.push(`/agents/${data.agent.id}`);
      } else {
        showToast("Failed to duplicate agent: " + (data.error || "Error"));
      }
    } catch {
      showToast("Network error duplicating agent");
    }
  };

  // Action: Delete Agent
  const handleDeleteConfirm = async () => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        dataStore.deleteAgent(agent.id);
        setIsDeleteDialogOpen(false);
        showToast(`Agent "${agent.name}" has been permanently deleted.`);
        setTimeout(() => {
          router.push("/agents");
        }, 500);
      } else {
        showToast("Failed to delete agent: " + (data.error || "Error"));
      }
    } catch {
      showToast("Network error deleting agent");
    }
  };

  // Action: Toggle Tool
  const handleToggleTool = async (toolIndex: number) => {
    const updated = [...tools];
    updated[toolIndex] = { ...updated[toolIndex], isEnabled: !updated[toolIndex].isEnabled };
    setTools(updated);

    try {
      await fetch(`/api/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updated }),
      });
      dataStore.updateAgent(agent.id, { tools: updated });
      showToast(
        `Tool "${updated[toolIndex].name}" ${updated[toolIndex].isEnabled ? "enabled" : "disabled"}`
      );
    } catch {
      showToast("Error updating tool status");
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Bot },
    { id: "instructions", label: "Instructions", icon: FileText },
    { id: "voice", label: "Voice Engine", icon: Mic2 },
    { id: "knowledge", label: "Business Knowledge", icon: Building2 },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "phone", label: "Phone & Telephony", icon: Phone },
    { id: "activity", label: "Call Activity", icon: PhoneCall },
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#FAFAF8] min-h-screen text-slate-900">
      <Header
        title={agent.name}
        subtitle="Manage instructions, knowledge, tools, and call routing"
        onOpenTestAgent={() => setIsTestModalOpen(true)}
        onOpenRealCall={() => setIsRealCallOpen(true)}
      />

      <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {toastMessage}
          </div>
        )}

        {/* Official Cartesia Synchronization Status Banner */}
        {syncStatus?.synced && (
          <div className="p-4 rounded-xl bg-emerald-50/90 border border-emerald-300 text-emerald-950 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-slate-900">Cartesia Agent Synchronized & Confirmed</div>
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  Agent ID: <span className="font-mono font-bold text-indigo-700">{cartesiaAgentId}</span> • Version: <span className="font-mono">{syncStatus.cartesiaVersionId || "Active"}</span> • Synced: {syncStatus.lastSyncedAt}
                </div>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-emerald-200/70 text-emerald-900 text-[10px] font-bold uppercase tracking-wider">
              Telephony Ready
            </span>
          </div>
        )}

        {syncStatus?.error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-rose-900">Cartesia Synchronization Failed</div>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  {syncStatus.error} (Configuration was NOT marked as synchronized)
                </div>
              </div>
            </div>
            <button
              onClick={() => setSyncStatus(null)}
              className="p-1 rounded-lg text-rose-500 hover:text-rose-800 hover:bg-rose-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Back Link & Header Banner */}
        <div className="space-y-3">
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Agents
          </Link>

          {/* Top Overview Banner with Action Buttons */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{agent.name}</h2>
                  <button
                    onClick={handleToggleDeploy}
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 transition ${
                      agent.status === AgentStatus.ACTIVE
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                    }`}
                    title="Click to toggle status"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === AgentStatus.ACTIVE ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                      }`}
                    />
                    {agent.status === AgentStatus.ACTIVE ? "Active & Ready" : "Paused"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{agent.description}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
                  <span className="font-mono text-slate-800 font-semibold">{agent.phoneNumber || "+91 80 7158 2667"}</span>
                  <span>•</span>
                  <span className="text-indigo-600 font-semibold">{agent.cartesiaVoiceName || "AD (Cloned)"}</span>
                  <span>•</span>
                  <span>Telugu & English</span>
                </div>
              </div>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Call Real Indian Phone */}
              <button
                onClick={() => setIsRealCallOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition shadow-xs"
                title="Call your phone number via Vobiz"
              >
                <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                Call Phone
              </button>

              {/* Deploy / Pause Button */}
              <button
                onClick={handleToggleDeploy}
                disabled={isDeploying}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
                  agent.status === AgentStatus.ACTIVE
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20"
                }`}
                title={agent.status === AgentStatus.ACTIVE ? "Pause live calling" : "Deploy live to telephony"}
              >
                {agent.status === AgentStatus.ACTIVE ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pause Agent
                  </>
                ) : (
                  <>
                    <Rocket className="w-3.5 h-3.5" />
                    {isDeploying ? "Deploying..." : "Deploy Agent"}
                  </>
                )}
              </button>

              {/* Test Agent in browser */}
              <button
                onClick={() => setIsTestModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Test in Browser
              </button>

              {/* Duplicate Agent */}
              <button
                onClick={handleDuplicate}
                className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
                title="Duplicate Agent"
              >
                <Copy className="w-4 h-4" />
              </button>

              {/* Delete Agent */}
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition"
                title="Delete Agent"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 3 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-500 text-xs block font-medium">Total Calls</span>
              <span className="text-lg font-bold text-slate-900">{agent.callsCount} calls</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-500 text-xs block font-medium">Spoken Minutes</span>
              <span className="text-lg font-bold text-slate-900">{agent.totalMinutes} mins</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <span className="text-slate-500 text-xs block font-medium">Usage Cost</span>
              <span className="text-lg font-bold text-slate-900 font-mono">₹{agent.estimatedCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                  isActive
                    ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panes */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Agent Details</h4>
                  <p className="text-xs text-slate-500">Name, description, and assigned phone line.</p>
                </div>
                {renderSaveButton("Save Agent")}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Assigned Phone Line</label>
                  <select
                    value={selectedPhone}
                    onChange={(e) => setSelectedPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="+91 80 7158 2667">+91 80 7158 2667 (Vobiz Line 1)</option>
                    <option value="+91 80 4735 9182">+91 80 4735 9182 (Vobiz Line 2)</option>
                    <option value="+91 40 6829 4410">+91 40 6829 4410 (Hyderabad Line)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 flex items-center justify-between">
                    <span>Cartesia Voice Agent ID</span>
                    <span className="text-[10px] text-indigo-600 font-mono font-normal">api.cartesia.ai</span>
                  </label>
                  <input
                    type="text"
                    value={cartesiaAgentId}
                    onChange={(e) => setCartesiaAgentId(e.target.value)}
                    placeholder="e.g. agent_GaiYMgB9Bj9kaKW1tUgqSQ"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Spoken Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TELUGU_ENGLISH">Telugu & Tenglish (Bilingual Conversational)</option>
                    <option value="TELUGU">Telugu (Pure)</option>
                    <option value="ENGLISH">Indian English</option>
                    <option value="HINDI">Hindi / Hinglish</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Voice & Speech Settings
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">TTS Engine:</span>
                      <span className="text-slate-900 font-semibold">Cartesia Sonic</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Cloned Voice:</span>
                      <span className="text-slate-900 font-semibold">{agent.cartesiaVoiceName || "AD"}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200">
                      <span className="text-slate-500">Voice Synthesis:</span>
                      <span className="text-emerald-700 font-semibold">Ready</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">STT Engine:</span>
                      <span className="text-slate-900 font-semibold">Sarvam Saaras Realtime</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                    Telugu Speech Normalizer
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Numbers, times, and currency amounts are automatically converted into natural spoken Telugu before voice playback.
                  </p>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-indigo-700 space-y-1">
                    <div>₹25,000 → ఇరవై ఐదు వేల రూపాయలు</div>
                    <div>10:30 AM → ఉదయం పది గంటల ముప్పై నిమిషాలకు</div>
                    <div>B2B → బీ టు బీ</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Instructions & Training Tab */}
          {activeTab === "instructions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Agent Persona & Core Instructions</h4>
                  <p className="text-xs text-slate-500">
                    Define agent identity, tone, guidelines, and specific telephone behavior.
                  </p>
                </div>

                {renderSaveButton("Save Instructions & Training")}
              </div>

              {/* System Prompt Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Core System Prompt & Direct Instructions
                </label>
                <textarea
                  rows={8}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="మీరు సేల్స్ లేదా సపోర్ట్ అసిస్టెంట్..."
                  className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 text-xs font-sans leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>

              {/* Human Conversational Excellence & CSAT Guidelines Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/60 to-violet-50/40 border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Human Conversational Excellence & CSAT Engine (Active at Runtime)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white border border-indigo-100/80 shadow-2xs">
                    <div className="font-bold text-slate-900 mb-0.5">Empathetic Replays</div>
                    <p className="text-[11px] text-slate-600">
                      Acknowledges customer with warmth (&ldquo;అవునండి&rdquo;, &ldquo;ఖచ్చితంగా అండి&rdquo;) before answering.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-indigo-100/80 shadow-2xs">
                    <div className="font-bold text-slate-900 mb-0.5">Single Question Flow</div>
                    <p className="text-[11px] text-slate-600">
                      Asks strictly 1 clear question at a time so caller is never overwhelmed.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-indigo-100/80 shadow-2xs">
                    <div className="font-bold text-slate-900 mb-0.5">Adaptive Recovery</div>
                    <p className="text-[11px] text-slate-600">
                      If caller says &ldquo;మీరే చెప్పండి&rdquo;, gracefully asks for name or phone without looping.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-indigo-100/80 shadow-2xs">
                    <div className="font-bold text-slate-900 mb-0.5">Spoken Brevity</div>
                    <p className="text-[11px] text-slate-600">
                      Keeps speech to 1-2 natural sentences (under 25 words) for natural phone cadence.
                    </p>
                  </div>
                </div>
              </div>

              {/* Few-Shot Training Scenarios Studio */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Few-Shot Training Scenarios (Questions & Replays)
                      </h4>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                        {trainingExamples.length} Active Scenarios
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Train the agent with sample customer questions and the exact human-like replies it should give.
                    </p>
                  </div>

                  <button
                    onClick={handleAddTrainingExample}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Training Scenario
                  </button>
                </div>

                <div className="space-y-3">
                  {trainingExamples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5 transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                          Scenario #{idx + 1}
                        </span>
                        {trainingExamples.length > 1 && (
                          <button
                            onClick={() => handleDeleteTrainingExample(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                            title="Delete scenario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            When Customer Asks:
                          </label>
                          <input
                            type="text"
                            value={ex.question}
                            onChange={(e) => handleUpdateTrainingExample(idx, "question", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                            placeholder="e.g. నా ఆర్డర్ ఎప్పుడు వస్తుంది?"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Agent Should Replay (Human-like Telugu/Tenglish Response & Question):
                          </label>
                          <textarea
                            rows={2}
                            value={ex.replay}
                            onChange={(e) => handleUpdateTrainingExample(idx, "replay", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                            placeholder="e.g. అర్థమైంది అండి! మీ ఆర్డర్ నంబర్ చెప్పగలరా?"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === "voice" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Voice Synthesis</h4>
                  <p className="text-xs text-slate-500">Cartesia neural voice model for natural Telugu speech.</p>
                </div>
                <button
                  onClick={() => setIsTestModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Audition Voice
                </button>
              </div>

              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Cloned Voice Name:</span>
                  <span className="font-semibold text-slate-900">AD (Telugu Cloned Voice)</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Voice Engine Status:</span>
                  <span className="font-semibold text-emerald-700">Active & Ready</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Language:</span>
                  <span className="font-semibold text-slate-900">Telugu (te)</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500">Output Encoding:</span>
                  <span className="font-mono text-slate-900">pcm_s16le @ 16,000 Hz</span>
                </div>
              </div>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === "tools" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Agent Tools</h4>
                  <p className="text-xs text-slate-500">Toggle automated actions your agent can perform during calls.</p>
                </div>
                {renderSaveButton("Save Tools")}
              </div>

              <div className="space-y-2.5">
                {tools.map((t, idx) => (
                  <div
                    key={t.name}
                    onClick={() => handleToggleTool(idx)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      t.isEnabled
                        ? "bg-indigo-50/60 border-indigo-200"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div>
                      <span className="font-bold text-slate-900 text-xs">{t.name}</span>
                      <p className="text-xs text-slate-500">{t.description}</p>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-md font-semibold border ${
                        t.isEnabled
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {t.isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Knowledge Tab */}
          {activeTab === "knowledge" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Business Knowledge, Policies & FAQs</h4>
                  <p className="text-xs text-slate-500">
                    Grounded knowledge used by the agent to answer customer inquiries accurately.
                  </p>
                </div>
                {renderSaveButton("Save Knowledge & Policies")}
              </div>

              {/* Core Business Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Business Name</label>
                  <input
                    type="text"
                    value={businessProfile.businessName}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, businessName: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Working Hours</label>
                  <input
                    type="text"
                    value={businessProfile.workingHours}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, workingHours: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Office Location</label>
                  <input
                    type="text"
                    value={businessProfile.location || ""}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, location: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Email & Phone</label>
                  <input
                    type="text"
                    value={businessProfile.contactInfo || ""}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, contactInfo: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1">Products & Services</label>
                  <input
                    type="text"
                    value={businessProfile.productsServices}
                    onChange={(e) =>
                      setBusinessProfile({ ...businessProfile, productsServices: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Customer Service & Business Policies */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Customer Service Policies (Grounded In Spoken Responses)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <label className="block font-bold text-slate-700">Return & Refund Policy</label>
                    <textarea
                      rows={2}
                      value={policies.refundPolicy || ""}
                      onChange={(e) => setPolicies({ ...policies, refundPolicy: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 7 రోజుల లోపు రిటర్న్ అభ్యర్థించవచ్చు..."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <label className="block font-bold text-slate-700">Cancellation Policy</label>
                    <textarea
                      rows={2}
                      value={policies.cancellationPolicy || ""}
                      onChange={(e) => setPolicies({ ...policies, cancellationPolicy: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. డిస్పాచ్ కావడానికి ముందే ఆర్డర్ రద్దు చేసుకోవచ్చు..."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <label className="block font-bold text-slate-700">Delivery Timelines</label>
                    <textarea
                      rows={2}
                      value={policies.deliveryPolicy || ""}
                      onChange={(e) => setPolicies({ ...policies, deliveryPolicy: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 2 నుండి 4 పని దినాలలో డెలివరీ..."
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <label className="block font-bold text-slate-700">Warranty & Guarantee</label>
                    <textarea
                      rows={2}
                      value={policies.warrantyPolicy || ""}
                      onChange={(e) => setPolicies({ ...policies, warrantyPolicy: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 1 సంవత్సరం రీప్లేస్‌మెంట్ వారంటీ..."
                    />
                  </div>
                </div>
              </div>

              {/* Interactive Business FAQs */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">Frequently Asked Questions (FAQs)</h4>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                        {faqs.length} FAQs
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      The agent grounds its factual answers in these verified questions and answers.
                    </p>
                  </div>

                  <button
                    onClick={handleAddFAQ}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add FAQ
                  </button>
                </div>

                <div className="space-y-3">
                  {faqs.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5 transition hover:border-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                          FAQ #{idx + 1}
                        </span>
                        {faqs.length > 1 && (
                          <button
                            onClick={() => handleDeleteFAQ(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition"
                            title="Delete FAQ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Question:</label>
                          <input
                            type="text"
                            value={f.question}
                            onChange={(e) => handleUpdateFAQ(idx, "question", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                            placeholder="e.g. మీ ధర ఎంత?"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Answer:</label>
                          <textarea
                            rows={2}
                            value={f.answer}
                            onChange={(e) => handleUpdateFAQ(idx, "answer", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                            placeholder="e.g. మా స్టార్టర్ ప్యాకేజ్ నెలకు ₹15,000 మాత్రమే..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Phone Tab */}
          {activeTab === "phone" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Phone Assignment</h4>
                  <p className="text-xs text-slate-500">Select the phone number connected to this agent.</p>
                </div>
                <button
                  onClick={handleSaveAll}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  <Save className="w-3.5 h-3.5" /> Save Line
                </button>
              </div>

              <div className="space-y-2.5">
                {["+91 80 7158 2667", "+91 80 4735 9182", "+91 40 6829 4410"].map((num) => (
                  <div
                    key={num}
                    onClick={() => setSelectedPhone(num)}
                    className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                      selectedPhone === num
                        ? "bg-indigo-50/70 border-indigo-500 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Phone className="w-4 h-4 text-indigo-600" />
                      <div>
                        <span className="font-mono text-sm font-bold text-slate-900">{num}</span>
                        <span className="text-[10px] text-slate-500 block">Vobiz Carrier Line</span>
                      </div>
                    </div>
                    {selectedPhone === num && (
                      <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Assigned
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-900">Call Activity</h4>
              <p className="text-xs text-slate-500">Recent calls handled by this agent.</p>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
                Call #10284 • 154s • ₹5.82 •{" "}
                <Link href="/calls/call_10284" className="text-indigo-600 underline font-semibold">
                  Inspect Conversation & Latency Breakdown →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Voice Agent?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <span className="font-bold text-slate-900 font-mono">&quot;{agent.name}&quot;</span>? All associated
              prompts and configuration will be removed from your database.
            </p>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs"
              >
                Yes, Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Agent Modals */}
      <TestAgentModal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        agentId={agent.id}
        agentName={agent.name}
      />

      <RealPhoneCallModal
        isOpen={isRealCallOpen}
        onClose={() => setIsRealCallOpen(false)}
        selectedAgentId={agent.id}
      />
    </div>
  );
}
